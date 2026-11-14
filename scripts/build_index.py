"""Build the static sky index of every public SPHEREx exposure.

The web app uses this index to find, without any server, which exposures cover a
position. It is a set of small binary files, one per sky cell, plus a manifest.
Re-run to pick up new data: nothing about releases is hard-coded, the archive's
observation table is read as it is.

    python scripts/build_index.py            # download (resumable) and build
    python scripts/build_index.py --build    # rebuild from already downloaded chunks

Layout of web/index/:
  manifest.json            releases, week folders, processing versions, grid
  c/<band>_<bin>.bin       exposures whose image centre falls in that sky cell,
                           18 bytes each, little-endian:
                           ra f4 | dec f4 | (mjd - 60000) f4 | week u2 | sequence u2 |
                           (sub << 4 | detector) u1 | (retry << 7 | release) u1
"""
from __future__ import annotations

import csv
import json
import math
import re
import struct
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "cache" / "index_raw"
OUT = ROOT / "web" / "index"
TAP = "https://irsa.ipac.caltech.edu/TAP/sync"
S3 = "https://nasa-irsa-spherex.s3.amazonaws.com/"
MJD0 = 60780            # shortly before the first public exposure
CHUNK_DAYS = 7
CELL_DEG = 6.0          # sky cell size


def mjd_now() -> float:
    return time.time() / 86400.0 + 40587.0


def fetch_chunk(t0: int) -> Path:
    path = RAW / f"t{t0}.csv"
    if path.exists() and path.stat().st_size > 0:
        return path
    q = ("SELECT obs_id, obs_collection, energy_bandpassname, s_ra, s_dec, t_min FROM spherex.obscore "
         f"WHERE calib_level=2 AND t_min >= {t0} AND t_min < {t0 + CHUNK_DAYS}")
    for attempt in range(6):
        try:
            r = requests.get(TAP, params={"QUERY": q, "FORMAT": "CSV"}, timeout=600)
            if r.status_code == 200 and r.text.startswith("obs_id"):
                tmp = path.with_suffix(".part")
                tmp.write_text(r.text, encoding="utf-8")
                tmp.replace(path)
                print(f"  {path.name}: {r.text.count(chr(10)) - 1} rows", flush=True)
                return path
        except requests.RequestException:
            pass
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"chunk {t0} failed")


def download():
    RAW.mkdir(parents=True, exist_ok=True)
    starts = list(range(MJD0, int(mjd_now()) + 1, CHUNK_DAYS))
    # the newest chunk is always refreshed: data keeps arriving
    newest = RAW / f"t{starts[-1]}.csv"
    if newest.exists():
        newest.unlink()
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(fetch_chunk, starts))


def s3_prefixes(prefix: str) -> list[str]:
    out, token = [], None
    while True:
        params = {"list-type": "2", "delimiter": "/", "prefix": prefix}
        if token:
            params["continuation-token"] = token
        xml = requests.get(S3, params=params, timeout=60).text
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
        xml = requests.get(S3, params=params, timeout=60).text
        out += re.findall(r"<Key>([^<]+)</Key>", xml)
        m = re.search(r"<NextContinuationToken>([^<]+)<", xml)
        if not m:
            return out
        token = m.group(1)


def cell_of(ra: float, dec: float) -> tuple[int, int]:
    nb = int(round(180 / CELL_DEG))
    b = min(nb - 1, max(0, int((dec + 90) // CELL_DEG)))
    centre = -90 + (b + 0.5) * CELL_DEG
    n = max(1, int(round(360 * math.cos(math.radians(centre)) / CELL_DEG)))
    return b, min(n - 1, int((ra % 360) / 360 * n))


def build():
    rows = []
    for path in sorted(RAW.glob("t*.csv")):
        with open(path, encoding="utf-8", newline="") as fh:
            rows += list(csv.DictReader(fh))
    print(f"{len(rows)} rows in the archive table", flush=True)

    releases: list[str] = []          # collection names, e.g. spherex_dr1_deep
    weeks: list[str] = []             # week folders, e.g. 2025W34_2B
    week_ix: dict[str, int] = {}
    seen = set()
    recs = []
    for r in rows:
        m = re.match(r"^(\d{4}W\d+_\w+?)_(\d+)_(\d+)$", r["obs_id"])
        band = r["energy_bandpassname"]
        if not m or not band.startswith("SPHEREx-D"):
            continue
        week, seq, sub, det = m.group(1), int(m.group(2)), int(m.group(3)), int(band[-1])
        key = (week, seq, sub, det)
        if key in seen:
            continue
        seen.add(key)
        if r["obs_collection"] not in releases:
            releases.append(r["obs_collection"])
        if week not in week_ix:
            week_ix[week] = len(weeks)
            weeks.append(week)
        recs.append((float(r["s_ra"]), float(r["s_dec"]), float(r["t_min"]), week_ix[week], seq, sub, det,
                     releases.index(r["obs_collection"])))
    print(f"{len(recs)} exposures, {len(weeks)} week folders, releases: {releases}", flush=True)

    # Processing version folder(s) of every week, per cloud prefix; a few exposures live in a "retry" folder.
    prefixes = sorted({re.sub(r"^spherex_|_deep$", "", rel) for rel in releases})
    versions: dict[str, dict[str, list[str]]] = {}
    retry: set[tuple] = set()
    for pre in prefixes:
        versions[pre] = {}
        for wk in s3_prefixes(f"{pre}/level2/"):
            week = wk.rstrip("/").split("/")[-1]
            vs = sorted(v.rstrip("/").split("/")[-1] for v in s3_prefixes(wk))
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
    for ra, dec, mjd, wi, seq, sub, det, rel in recs:
        pre = re.sub(r"^spherex_|_deep$", "", releases[rel])
        is_retry = (pre, weeks[wi], seq, sub, det) in retry
        cells.setdefault(cell_of(ra, dec), bytearray()).extend(
            struct.pack("<fffHHBB", ra, dec, mjd - 60000.0, wi, seq, (sub << 4) | det, (128 if is_retry else 0) | rel))

    (OUT / "c").mkdir(parents=True, exist_ok=True)
    for old in (OUT / "c").glob("*.bin"):
        old.unlink()
    for (b, i), buf in cells.items():
        (OUT / "c" / f"{b}_{i}.bin").write_bytes(bytes(buf))
    manifest = {
        "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "exposures": len(recs), "cellDeg": CELL_DEG, "recordBytes": 18,
        "releases": [{"name": rel, "prefix": re.sub(r"^spherex_|_deep$", "", rel)} for rel in releases],
        "weeks": weeks, "versions": versions,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    size = sum(p.stat().st_size for p in (OUT / "c").glob("*.bin"))
    print(f"wrote {len(cells)} cells, {size / 1e6:.1f} MB", flush=True)


if __name__ == "__main__":
    if "--build" not in sys.argv:
        download()
    build()
