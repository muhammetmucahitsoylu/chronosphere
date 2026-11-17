"""Pre-build the five challenge test targets into static files under web/data/.
(Pluto, a body of the solar system with a path instead of a place, is built by scripts/build_body.mjs.)

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

# The descriptive fields are curated and every number has a source:
#   dist  parallax in milliarcseconds, its uncertainty, and where it comes from
#   pm    proper motion in milliarcseconds per year, when the default look-up is not the best value
TARGETS = [
    {"slug": "barnard", "wiki": "Barnard's Star", "query": "Barnard's Star", "label": "Barnard's Star", "kind": "motion",
     "view": {"det": 5, "mode": "epochs"},
     "type": "Red dwarf star", "sp": "M4",
     "dist": {"plx": 546.9759, "err": 0.0401, "src": "Gaia DR3 parallax"},
     "blurb": "The fastest-moving star in the sky: 10.4 arcseconds per year, about 1.7 SPHEREx pixels.",
     "look": "The images loop through three visits: the star hops north by roughly a pixel each time, following "
             "the dotted line. Its core is bright enough to saturate the shorter-wavelength detectors, so D5 gives "
             "the cleanest view. The table compares the shift measured from these images with the catalogue prediction."},
    {"slug": "epsindib", "wiki": "Epsilon Indi", "query": "eps Ind B", "label": "Epsilon Indi B", "kind": "motion",
     "view": {"det": 2, "mode": "epochs"},
     "type": "Pair of brown dwarfs", "sp": "T1 + T6",
     "dist": {"plx": 274.8431, "err": 0.0956, "src": "Gaia DR3 parallax of its host star"},
     "blurb": "Two brown dwarfs orbiting a nearby star, moving 4.7 arcseconds per year. SPHEREx sees the pair as one dot.",
     "look": "The bright star 6.7 arcminutes to the west is Epsilon Indi A, the star this pair orbits; the pair, in the ring, is about 4,000 times fainter. Watch it slide to the south-east from visit to visit. Then look at the spectrum: the deep dips near "
             "1.4, 1.9 and 2.7 microns are water vapour and the one near 3.3 microns is methane, in the "
             "atmospheres of the brown dwarfs."},
    {"slug": "wise0855", "wiki": "WISE 0855−0714", "query": "WISE J085510.83-071442.5", "label": "WISE 0855", "kind": "motion",
     "view": {"det": 6, "mode": "bands"},
     "type": "Brown dwarf", "sp": "Y",
     "dist": {"plx": 439.0, "err": 2.4, "src": "parallax from Kirkpatrick et al. 2021"},
     "blurb": "The coldest known brown dwarf, 7.4 light-years away, moving 8.2 arcseconds per year.",
     "look": "The images step through the wavelengths. Below 4 microns the circle holds only the edge of an ordinary "
             "star just to its west. In the two longest-wavelength detectors a second source appears that is "
             "not in the Gaia catalogue: that is WISE 0855. In the colour picture it is the red dot. "
             "Switch to Visits in D6 to see it move."},
    {"slug": "rwaur", "wiki": "RW Aurigae", "query": "RW Aur", "label": "RW Aurigae", "kind": "variable",
     "view": {"det": 5, "mode": "epochs"},
     "type": "Young star (T Tauri type)", "sp": "K",
     "dist": {"plx": 6.4062, "err": 0.0441, "src": "Gaia DR3 parallax of RW Aur A"},
     "pm": {"pmra": 2.641, "pmdec": -27.398, "src": "Gaia DR3, RW Aur A"},
     "blurb": "A young star, still surrounded by dust, whose brightness changes unpredictably.",
     "look": "The colours in the spectrum are the three visits, and they cross over. From September 2025 to "
             "September 2026 the star grew more than 40% brighter below 1.6 microns and lost almost half its "
             "brightness beyond 3.8 microns; ordinary stars in the same images stayed constant to about 1%. "
             "In its deep fading of 2014 to 2016 astronomers saw the reverse: hot dust near the star hid it "
             "while glowing in the infrared."},
    {"slug": "rdra", "wiki": "R Draconis", "query": "R Dra", "label": "R Draconis", "kind": "variable",
     "view": {"det": 4, "mode": "epochs"},
     "type": "Pulsating red giant (Mira variable)", "sp": "M",
     "dist": {"plx": 1.2509, "err": 0.0648, "src": "Gaia DR3 parallax"},
     "blurb": "A red giant that swells and shrinks, brightening and fading over about 245 days.",
     "look": "Each image covers about a month. This star is so bright that its core saturates every detector, so "
             "the tool measures its faint outer glow instead. The brightness curve shows the pulse: brightest in "
             "July 2025, about half as bright that autumn, and climbing again in the latest images."},
]


SIMBAD = ["https://simbad.cds.unistra.fr/simbad/sim-tap/sync", "https://simbad.harvard.edu/simbad/sim-tap/sync"]


def _adql(query: str) -> list[dict]:
    import requests
    last = None
    for base in SIMBAD:
        try:
            r = requests.get(base, params={"request": "doQuery", "lang": "adql", "format": "json", "query": query}, timeout=30)
            js = r.json()
            cols = [c["name"] for c in js["metadata"]]
            return [dict(zip(cols, row)) for row in js["data"]]
        except Exception as e:  # mirror down: try the next one
            last = e
    raise last


def bake_info(t: dict, out_dir: Path) -> dict:
    """What the object is (SIMBAD) and its encyclopedia card, stored with the showcase data so the
    guided tour needs no look-ups at all."""
    import re
    import requests
    res = t["resolved"]
    rows = _adql("SELECT TOP 8 b.oid, b.main_id, b.otype, o.label, o.description, b.ra, b.dec, b.pmra, b.pmdec, b.plx_value, b.plx_err, "
                 "b.sp_type, b.rvz_redshift, f.V, f.J, f.K FROM basic AS b LEFT JOIN otypedef AS o ON o.otype = b.otype "
                 "LEFT JOIN allfluxes AS f ON f.oidref = b.oid WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), "
                 f"CIRCLE('ICRS', {res['ra2000']:.6f}, {res['dec2000']:.6f}, 0.002)) = 1")
    rows.sort(key=lambda r: (r["otype"] in ("Pl", "Pl?", "ev", "err", "reg", "?"), r["K"] if r["K"] is not None else 99))
    extra = {}
    if rows:
        r = rows[0]
        clean = lambda s: re.sub(r"\s+", " ", re.sub(r"^(NAME|V\*|\*\*|\*|EM\*|PN|Cl\*?)\s+", "", s or "")).strip()
        extra["info"] = {
            "oid": r["oid"], "mainId": r["main_id"], "name": clean(r["main_id"]), "otype": r["otype"],
            "type": r["description"] or r["label"] or r["otype"], "ra2000": r["ra"], "dec2000": r["dec"],
            "pmra": r["pmra"], "pmdec": r["pmdec"], "plx": r["plx_value"], "plxErr": r["plx_err"], "sptype": r["sp_type"], "redshift": r["rvz_redshift"],
            "mags": {"V": r["V"], "J": r["J"], "K": r["K"]}, "ra": t["ra"], "dec": t["dec"], "dist": 0,
            "others": [{"name": clean(o["main_id"]), "type": o["description"] or o["otype"], "dist": 0} for o in rows[1:5]],
        }
    if t.get("wiki"):
        js = requests.get("https://en.wikipedia.org/api/rest_v1/page/summary/" + requests.utils.quote(t["wiki"].replace(" ", "_")),
                          params={"redirect": "true"}, headers={"User-Agent": "chronosphere-prebuild"}, timeout=30).json()
        if js.get("type") == "standard":
            card = {"title": js["title"], "extract": js.get("extract", ""), "description": js.get("description", ""),
                    "url": js.get("content_urls", {}).get("desktop", {}).get("page"), "thumb": None}
            src = (js.get("thumbnail") or {}).get("source")
            if src:
                img = requests.get(src, headers={"User-Agent": "chronosphere-prebuild"}, timeout=30)
                if img.ok:
                    ext = ".png" if src.lower().endswith(".png") else ".jpg"
                    (out_dir / f"thumb{ext}").write_bytes(img.content)
                    card["thumb"] = f"data/{t['slug']}/thumb{ext}"
            extra["wikiCard"] = card
    return extra


def main():
    args = sys.argv[1:]
    out_root = ROOT / "web" / "data"
    if "--meta" in args:      # refresh only the descriptive text, keep the built data
        idx_path = out_root / "targets.json"
        old = {t["slug"]: t for t in json.loads(idx_path.read_text(encoding="utf-8"))}
        merged = []
        for t in TARGETS:
            if t["slug"] not in old:
                continue
            entry = {**old[t["slug"]], **t}
            try:
                entry.update(bake_info(entry, out_root / t["slug"]))
            except Exception as e:
                print(f"  {t['slug']}: info not baked ({e})")
            merged.append(entry)
        merged += [o for o in old.values() if o["slug"] not in {t["slug"] for t in TARGETS}]      # built elsewhere (scripts/build_body.mjs): kept as they are
        idx_path.write_text(json.dumps(merged, indent=1), encoding="utf-8")
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
    index += [o for o in old.values() if o["slug"] not in {t["slug"] for t in TARGETS}]      # built elsewhere (scripts/build_body.mjs): kept as they are
    idx_path.write_text(json.dumps(index, indent=1))
    print("done", flush=True)


if __name__ == "__main__":
    main()
