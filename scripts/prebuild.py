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
    {"slug": "barnard", "wiki": "Barnard's Star", "query": "Barnard's Star", "label": "Barnard's Star", "kind": "motion",
     "view": {"det": 5, "mode": "epochs"},
     "blurb": "The fastest-moving star in the sky: 10.4 arcseconds per year, about 1.7 SPHEREx pixels.",
     "look": "Press Play. The star hops north by roughly a pixel each season, following the dotted line. "
             "Its core is bright enough to saturate the shorter-wavelength detectors, so D5 gives the cleanest view. "
             "The table compares the shift measured from these images with the catalogue prediction."},
    {"slug": "epsindib", "wiki": "Epsilon Indi", "query": "eps Ind B", "label": "Epsilon Indi B", "kind": "motion",
     "view": {"det": 2, "mode": "epochs"},
     "blurb": "A pair of brown dwarfs orbiting a nearby star, moving 4.7 arcseconds per year.",
     "look": "Press Play and watch it slide to the south-east. Then look at the spectrum: the deep dips near "
             "1.4, 1.9 and 2.7 microns are water vapour and the one near 3.3 microns is methane, in the "
             "atmosphere of a brown dwarf."},
    {"slug": "wise0855", "wiki": "WISE 0855−0714", "query": "WISE J085510.83-071442.5", "label": "WISE 0855", "kind": "motion",
     "view": {"det": 6, "mode": "bands"},
     "blurb": "The coldest known brown dwarf, 7 light-years away, moving 8.1 arcseconds per year.",
     "look": "Step through the wavelengths. Below 4 microns the circle holds only the edge of an ordinary "
             "star just to its west. In the two longest-wavelength detectors a second source appears that is "
             "not in the Gaia catalogue: that is WISE 0855. In the colour picture it is the red dot. "
             "Switch to Seasons in D6 to see it move."},
    {"slug": "rwaur", "wiki": "RW Aurigae", "query": "RW Aur", "label": "RW Aurigae", "kind": "variable",
     "view": {"det": 5, "mode": "epochs"},
     "blurb": "A young star that dims unpredictably when dust crosses in front of it.",
     "look": "Look at the spectrum: the colours are the observing seasons, and beyond 3 microns they pull "
             "apart, because the star was clearly fainter in the latest season than a year earlier. "
             "Its position stays put, which shows how well the images line up."},
    {"slug": "rdra", "wiki": "R Draconis", "query": "R Dra", "label": "R Draconis", "kind": "variable",
     "view": {"det": 1, "mode": "epochs"},
     "blurb": "A pulsating red giant (a Mira variable) that brightens and fades over about 245 days.",
     "look": "Press Play: each image covers about a month. This star is so bright that its core saturates "
             "every detector, so the tool measures its outer halo instead. The brightness curve shows it "
             "fading and brightening again."},
]


def main():
    args = sys.argv[1:]
    out_root = ROOT / "web" / "data"
    if "--meta" in args:      # refresh only the descriptive text, keep the built data
        idx_path = out_root / "targets.json"
        old = {t["slug"]: t for t in json.loads(idx_path.read_text(encoding="utf-8"))}
        idx_path.write_text(json.dumps([{**old[t["slug"]], **t} for t in TARGETS if t["slug"] in old], indent=1), encoding="utf-8")
        print("metadata refreshed")
        return
    want = set(args)
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
