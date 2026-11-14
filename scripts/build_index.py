"""Build the static sky index of every public SPHEREx exposure.

The web app uses this index to find, without any server, which exposures cover a
position. It is a set of small binary files, one per sky cell, plus a manifest.
Nothing about releases is hard-coded: the archive's observation table is read as it is.

    python scripts/build_index.py            # update: download only what is new, then rebuild
    python scripts/build_index.py --full     # download the whole observation table again
    python scripts/build_index.py --build    # rebuild from the index as it is (no archive access)
    python scripts/build_index.py --force    # accept a result with far fewer exposures than before

An update starts from the index that is already published (web/index/), asks the archive how
many exposures each release holds, and downloads only releases that are new or have grown.
If the archive cannot be reached, or the result looks wrong, nothing is written.

Layout of web/index/:
  manifest.json            releases, week folders, processing versions, grid
  c/<band>_<bin>.bin       exposures whose image centre falls in that sky cell,
                           18 bytes each, little-endian:
                           ra f4 | dec f4 | (mjd - 60000) f4 | week u2 | sequence u2 |
                           (sub << 4 | detector) u1 | (retry << 7 | release) u1
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import struct
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "index"
TAP = "https://irsa.ipac.caltech.edu/TAP/sync"
S3 = "https://nasa-irsa-spherex.s3.amazonaws.com/"
CHUNK_DAYS = 7
CELL_DEG = 6.0          # sky cell size
REC = struct.Struct("<fffHHBB")
COLS = "obs_id, obs_collection, energy_bandpassname, s_ra, s_dec, t_min"

# One exposure: (release, week, sequence, sub, detector) -> (ra, dec, mjd)
Key = tuple[str, str, int, int, int]


def mjd_now() -> float:
    return time.time() / 86400.0 + 40587.0


# ------------------------------------------------------------------ the archive
def tap(query: str, timeout: int = 240, tries: int = 5) -> list[dict]:
    """Run one query on the archive and return its rows. Raises if the archive keeps failing."""
    last = "no answer"
    for attempt in range(tries):
        try:
            r = requests.get(TAP, params={"QUERY": query, "FORMAT": "CSV"}, timeout=timeout)
            text = r.text
            if r.status_code == 200 and not text.lstrip().startswith("<"):
                return list(csv.DictReader(io.StringIO(text)))
            last = f"HTTP {r.status_code}: {text[:80]!r}"
        except requests.RequestException as e:
            last = type(e).__name__
        if attempt < tries - 1:
            time.sleep([10, 30, 60, 120][min(attempt, 3)])
    raise RuntimeError(f"archive query failed ({last})")


def fetch_rows(where: str, t0: float, t1: float) -> list[dict]:
    """Rows with t0 <= t_min < t1. A slice that keeps failing is cut in half and tried again."""
    q = f"SELECT {COLS} FROM spherex.obscore WHERE calib_level=2 AND {where} AND t_min >= {t0} AND t_min < {t1}"
    try:
        return tap(q, tries=3)
    except RuntimeError:
        if t1 - t0 <= 1.0:
            raise
        mid = (t0 + t1) / 2
        return fetch_rows(where, t0, mid) + fetch_rows(where, mid, t1)


def fetch_range(where: str, t0: float, t1: float, label: str) -> list[dict]:
    rows, a = [], math.floor(t0)
    while a < t1:
        b = min(a + CHUNK_DAYS, math.ceil(t1) + 1)
        got = fetch_rows(where, a, b)
        rows += got
        print(f"  {label}: MJD {a}-{b}: {len(got)} rows", flush=True)
        a = b
    return rows


def parse(rows: list[dict]) -> dict[Key, tuple[float, float, float]]:
    out: dict[Key, tuple[float, float, float]] = {}
    for r in rows:
        m = re.match(r"^(\d{4}W\d+_\w+?)_(\d+)_(\d+)$", r["obs_id"])
        band = r["energy_bandpassname"]
        if not m or not band.startswith("SPHEREx-D"):
            continue
        out[(r["obs_collection"], m.group(1), int(m.group(2)), int(m.group(3)), int(band[-1]))] = (
            float(r["s_ra"]), float(r["s_dec"]), float(r["t_min"]))
    return out


# ------------------------------------------------------------------ the published index
def load_index() -> tuple[dict[Key, tuple[float, float, float]], dict | None]:
    """Read web/index/ back into exposures. Returns ({}, None) when there is no index yet."""
    path = OUT / "manifest.json"
    if not path.exists():
        return {}, None
    man = json.loads(path.read_text(encoding="utf-8"))
    rels, weeks, recs = [r["name"] for r in man["releases"]], man["weeks"], {}
    for cell in (OUT / "c").glob("*.bin"):
        buf = cell.read_bytes()
        for ra, dec, t, wi, seq, sd, rr in REC.iter_unpack(buf[: len(buf) // REC.size * REC.size]):
            recs[(rels[rr & 127], weeks[wi], seq, sd >> 4, sd & 15)] = (ra, dec, t + 60000.0)
    return recs, man


def rank(release: str) -> tuple[int, int]:
    """Which release to keep when the same exposure is in two: a data release over a quick release, then the newer."""
    m = re.match(r"^spherex_([a-z]+)(\d+)", release)
    return (2 if m and m.group(1) == "dr" else 1, int(m.group(2)) if m else 0)


# ------------------------------------------------------------------ the open data bucket
def s3_list(params: dict) -> str:
    for attempt in range(5):
        try:
            r = requests.get(S3, params=params, timeout=60)
            if r.status_code == 200:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"could not list the open data bucket ({params.get('prefix')})")


def s3_prefixes(prefix: str) -> list[str]:
    out, token = [], None
    while True:
        params = {"list-type": "2", "delimiter": "/", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        xml = s3_list(params)
        out += re.findall(r"<CommonPrefixes><Prefix>([^<]+)</Prefix>", xml)
        m = re.search(r"<NextContinuationToken>([^<]+)<", xml)
        if not m:
            return out
        token = m.group(1)


def s3_keys(prefix: str) -> list[str]:
    out, token = [], None
    while True:
        params = {"list-type": "2", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        xml = s3_list(params)
        out += re.findall(r"<Key>([^<]+)</Key>", xml)
        m = re.search(r"<NextContinuationToken>([^<]+)<", xml)
        if not m:
            return out
        token = m.group(1)


# ------------------------------------------------------------------ update
def update(old: dict[Key, tuple[float, float, float]], full: bool) -> dict[Key, tuple[float, float, float]]:
    """Bring the list of exposures up to date with the archive, downloading as little as possible."""
    summary = {r["obs_collection"]: (int(r["n"]), float(r["t0"]), float(r["t1"])) for r in tap(
        "SELECT obs_collection, COUNT(*) AS n, MIN(t_min) AS t0, MAX(t_min) AS t1 FROM spherex.obscore "
        "WHERE calib_level=2 GROUP BY obs_collection", timeout=600)}
    if not summary:
        raise RuntimeError("the archive lists no releases")
    print("archive:", {k: v[0] for k, v in sorted(summary.items())}, flush=True)
    new: dict[Key, tuple[float, float, float]] = {}
    for rel, (n, t0, t1) in sorted(summary.items()):
        have = {k: v for k, v in old.items() if k[0] == rel}
        where = f"obs_collection='{rel}'"
        if have and not full:
            if len(have) == n:
                print(f"  {rel}: unchanged ({n} exposures)", flush=True)
                new.update(have)
                continue
            # a release normally grows at its newest end: fetch from a little before what we have
            start = max(v[2] for v in have.values()) - 3.0
            merged = {**have, **parse(fetch_range(where, start, t1, rel))}
            if len(merged) == n:
                print(f"  {rel}: {len(merged) - len(have)} new exposures", flush=True)
                new.update(merged)
                continue
            print(f"  {rel}: the archive has {n}, the update gives {len(merged)}: reading the whole release", flush=True)
        got = parse(fetch_range(where, t0, t1, rel))
        if abs(len(got) - n) > max(5, 0.001 * n):
            raise RuntimeError(f"{rel}: read {len(got)} exposures, the archive says {n}")
        new.update(got)
    for rel in sorted({k[0] for k in old} - set(summary)):
        print(f"  {rel}: no longer in the archive, dropped", flush=True)
    return new


# ------------------------------------------------------------------ build
def cell_of(ra: float, dec: float) -> tuple[int, int]:
    nb = int(round(180 / CELL_DEG))
    b = min(nb - 1, max(0, int((dec + 90) // CELL_DEG)))
    centre = -90 + (b + 0.5) * CELL_DEG
    n = max(1, int(round(360 * math.cos(math.radians(centre)) / CELL_DEG)))
    return b, min(n - 1, int((ra % 360) / 360 * n))


def build(recs: dict[Key, tuple[float, float, float]], old_man: dict | None) -> bool:
    """Write the index. Returns False, and writes nothing, when it would be identical to the one on disk."""
    # the same exposure in two releases: keep the better one
    best: dict[tuple, Key] = {}
    for key in recs:
        short = key[1:]
        if short not in best or rank(key[0]) > rank(best[short][0]):
            best[short] = key
    keys = sorted(best.values(), key=lambda k: (recs[k][2], k))
    releases = sorted({k[0] for k in keys})
    weeks = sorted({k[1] for k in keys})
    if len(releases) > 127 or len(weeks) > 65535:
        raise RuntimeError("the record layout cannot hold this many releases or weeks")
    rel_ix, week_ix = {r: i for i, r in enumerate(releases)}, {w: i for i, w in enumerate(weeks)}
    print(f"{len(keys)} exposures, {len(weeks)} week folders, releases: {releases}", flush=True)

    # Processing version folder(s) of every week, per cloud prefix; a few exposures live in a "retry" folder.
    prefix_of = lambda rel: re.sub(r"^spherex_|_deep$", "", rel)
    versions: dict[str, dict[str, list[str]]] = {}
    retry: set[tuple] = set()
    for pre in sorted({prefix_of(r) for r in releases}):
        versions[pre] = {}
        for wk in s3_prefixes(f"{pre}/level2/"):
            week = wk.rstrip("/").split("/")[-1]
            vs = sorted(v.rstrip("/").split("/")[-1] for v in s3_prefixes(wk))
            if not vs:
                continue
            main = [v for v in vs if "retry" not in v] or vs
            versions[pre][week] = [main[-1]] + [v for v in vs if v != main[-1]]
            for v in vs:
                if "retry" in v:
                    for k in s3_keys(f"{wk}{v}/"):
                        mm = re.search(r"level2_(\d{4}W\d+_\w+?)_(\d+)_(\d+)D(\d)_", k)
                        if mm:
                            retry.add((pre, mm.group(1), int(mm.group(2)), int(mm.group(3)), int(mm.group(4))))
        print(f"  {pre}: {len(versions[pre])} week folders", flush=True)
    print(f"{len(retry)} exposures in retry folders", flush=True)

    cells: dict[tuple[int, int], bytearray] = {}
    for key in keys:
        rel, week, seq, sub, det = key
        ra, dec, mjd = recs[key]
        is_retry = (prefix_of(rel), week, seq, sub, det) in retry
        cells.setdefault(cell_of(ra, dec), bytearray()).extend(
            REC.pack(ra, dec, mjd - 60000.0, week_ix[week], seq, (sub << 4) | det, (128 if is_retry else 0) | rel_ix[rel]))

    manifest = {
        "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "exposures": len(keys), "cellDeg": CELL_DEG, "recordBytes": REC.size,
        "releases": [{"name": rel, "prefix": prefix_of(rel)} for rel in releases],
        "weeks": weeks, "versions": versions,
    }
    cdir = OUT / "c"
    on_disk = {p.name: p.read_bytes() for p in cdir.glob("*.bin")} if cdir.exists() else {}
    wanted = {f"{b}_{i}.bin": bytes(buf) for (b, i), buf in cells.items()}
    same = lambda m: {k: v for k, v in m.items() if k != "built"}
    if old_man and on_disk == wanted and same(old_man) == same(manifest):
        print("nothing has changed: the index on disk is up to date", flush=True)
        return False
    cdir.mkdir(parents=True, exist_ok=True)
    for name in set(on_disk) - set(wanted):
        (cdir / name).unlink()
    for name, buf in wanted.items():
        if on_disk.get(name) != buf:
            (cdir / name).write_bytes(buf)
    (OUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {len(wanted)} cells, {sum(map(len, wanted.values())) / 1e6:.1f} MB", flush=True)
    return True


if __name__ == "__main__":
    args = set(sys.argv[1:])
    old, old_man = load_index()
    print(f"index on disk: {len(old)} exposures" + (f", built {old_man['built']}" if old_man else ""), flush=True)
    recs = old if "--build" in args else update(old, "--full" in args or not old)
    # A partial or garbled answer from the archive must never shrink the published index.
    if old and len(recs) < 0.9 * len(old) and "--force" not in args:
        sys.exit(f"refusing to write: {len(recs)} exposures, {len(old)} before (use --force if this is right)")
    build(recs, old_man)
