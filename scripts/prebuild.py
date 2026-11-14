"""Pre-build the five challenge test targets into static files under web/data/.

The web app loads these instantly and without any server; every other
position goes through the live API. Re-run this script to refresh the
showcase with the newest SPHEREx release (nothing is hard-coded per release).

    python scripts/prebuild.py [slug ...]
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import catalogs  # noqa: E402
import pipeline  # noqa: E402

SIZE_ARCMIN = 5.0

TARGETS = [
    {"slug": "barnard", "query": "Barnard's Star", "label": "Barnard's Star",
     "kind": "motion",
     "blurb": "Fastest-moving star in the sky: 10.4 arcsec per year, about 1.7 SPHEREx pixels."},
    {"slug": "epsindib", "query": "eps Ind B", "label": "Epsilon Indi B",
     "kind": "motion",
     "blurb": "A pair of brown dwarfs orbiting a nearby star, moving 4.7 arcsec per year."},
    {"slug": "wise0855", "query": "WISE J085510.83-071442.5", "label": "WISE 0855",
     "kind": "motion",
     "blurb": "The coldest known brown dwarf: 8.1 arcsec per year, visible only at the longest wavelengths."},
    {"slug": "rwaur", "query": "RW Aur", "label": "RW Aurigae",
     "kind": "variable",
     "blurb": "A young variable star that dims unpredictably when dust crosses in front of it."},
    {"slug": "rdra", "query": "R Dra", "label": "R Draconis",
     "kind": "variable",
     "blurb": "A pulsating red giant (Mira variable) that brightens and fades over about 245 days."},
]


def main():
    want = set(sys.argv[1:])
    out_root = ROOT / "web" / "data"
    out_root.mkdir(parents=True, exist_ok=True)
    index = []
    idx_path = out_root / "targets.json"
    old = {t["slug"]: t for t in json.loads(idx_path.read_text())} if idx_path.exists() else {}
    for t in TARGETS:
        slug = t["slug"]
        if want and slug not in want:
            if slug in old:
                index.append(old[slug])
            continue
        d = out_root / slug
        d.mkdir(exist_ok=True)
        res = catalogs.resolve(t["query"])
        ra, dec = round(res["ra"], 6), round(res["dec"], 6)
        print(f"[{slug}] {res['name']} -> {ra}, {dec} (epoch {res['epoch']})", flush=True)
        entry = {**t, "ra": ra, "dec": dec, "size": SIZE_ARCMIN, "resolved": res,
                 "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        for det in range(1, 7):
            t0 = time.time()
            n = 0
            with open(d / f"d{det}.ndjson", "w", encoding="utf-8") as fh:
                for line in pipeline.stream(ra, dec, SIZE_ARCMIN, det):
                    fh.write(line)
                    n += 1
            print(f"   D{det}: {n - 2} frames in {time.time() - t0:.0f}s", flush=True)
        entry["summary"] = pipeline.summary(ra, dec)
        for cat, fn in (("gaia", catalogs.gaia), ("catwise", catalogs.catwise)):
            try:
                rows = fn(ra, dec, SIZE_ARCMIN * 0.75 + 0.5)
                (d / f"{cat}.json").write_text(json.dumps(
                    {"cat": cat, "epoch": 2016.0 if cat == "gaia" else 2015.4, "sources": rows}))
                print(f"   {cat}: {len(rows)} sources", flush=True)
            except Exception as e:
                print(f"   {cat}: FAILED {e}", flush=True)
        index.append(entry)
        idx_path.write_text(json.dumps(index, indent=1))
    idx_path.write_text(json.dumps(index, indent=1))
    print("done", flush=True)


if __name__ == "__main__":
    main()
