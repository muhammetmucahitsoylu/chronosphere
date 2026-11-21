"""Build the "Years" view of the five showcase stars: the same patch of sky as 2MASS saw it (1997 to 2001), as WISE
saw it in 2010 and every half year from 2014 to 2024 (NEOWISE), and as SPHEREx sees it (2025 and 2026), on one grid
and in one unit (MJy/sr), so that what a star did over a quarter of a century can be seen and measured.

    python scripts/build_years.py [slug ...]
    python scripts/build_years.py --2mass [slug ...]     # only the 2MASS picture again (the rest is kept)
    python scripts/build_years.py --cat [slug ...]       # only the catalogue brightness of each WISE visit again
    python scripts/build_years.py --measure [slug ...]   # only the motion measured in the built images (for the plain pages)

Writes, for each star, web/data/<slug>/years-2mass.ndjson, years-w1.ndjson, years-w2.ndjson and
years-spherex.ndjson, and its entry in web/data/years.json (the grid, the files, the dates).
The images come from NASA/IPAC's IRSA: 2MASS Atlas Images, WISE and NEOWISE single exposures (level 1b),
SPHEREx level 2 exposures. Downloads are kept in spike/cache/years/, so a second run is quick.
"""
from __future__ import annotations

import gzip
import hashlib
import io
import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import requests
from astropy.io import fits
from astropy.wcs import WCS
from scipy.ndimage import gaussian_filter, map_coordinates

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
import spherex as sx  # noqa: E402

IRSA = "https://irsa.ipac.caltech.edu/ibe"
CACHE = ROOT / "spike" / "cache" / "years"
UA = {"User-Agent": "sky-viewer-prebuild/1.0"}
STARS = ["barnard", "epsindib", "wise0855", "rwaur", "rdra"]
# Stars that are not showcase objects but that the guided tour's last step offers: built too, so that opened by name
# they get the WISE and NEOWISE visits rather than the sky maps. Year-2000 positions and motions (milliarcseconds a
# year) and parallaxes as the tour gives them (SIMBAD: Gaia DR3; Luhman 16: Lazorenko & Sahlmann 2018).
EXTRA = {
    "proxima": {"label": "Proxima Centauri", "det": 5, "resolved": {"ra2000": 217.42894222, "dec2000": -62.67949019, "pmra": -3781.741, "pmdec": 769.465}, "dist": {"plx": 768.0665}},
    "luhman16": {"label": "Luhman 16", "det": 6, "resolved": {"ra2000": 162.328814, "dec2000": -53.319466, "pmra": -2767.502, "pmdec": 356.856}, "dist": {"plx": 501.557}},
    "teegarden": {"label": "Teegarden's Star", "det": 5, "resolved": {"ra2000": 43.25371581, "dec2000": 16.88128672, "pmra": 3429.083, "pmdec": -3805.541}, "dist": {"plx": 260.9884}},
}

# Zero points: 2MASS (Cohen, Wheaton & Megeath 2003), WISE (Jarrett et al. 2011). Flux density of a source of magnitude 0.
TWOMASS = {"j": ("J", 1.235, 1594.0), "h": ("H", 1.662, 1024.0), "k": ("Ks", 2.159, 666.7)}
WISE = {1: ("W1", 3.353, 309.540), 2: ("W2", 4.603, 171.787)}
# The parts of the WISE archive, in time order: the cryogenic survey and its two sequels in 2010-11, and NEOWISE (2013-24).
WISE_SETS = ["wise/allsky/4band_p1bm_frm", "wise/cryo_3band/3band_p1bm_frm", "wise/postcryo/2band_p1bm_frm", "wise/neowiser/p1bm_frm"]
# The same single exposures in IRSA's open data bucket on AWS, uncompressed: only the rows the grid needs are read.
S3_WISE = "https://nasa-irsa-wise.s3.amazonaws.com/"
S3_DIR = {"wise/allsky/4band_p1bm_frm": "wise/allsky/images/4band_p1bm_frm", "wise/cryo_3band/3band_p1bm_frm": "wise/cryo-3band/images/3band_p1bm_frm",
          "wise/postcryo/2band_p1bm_frm": "wise/postcryo/images/2band_p1bm_frm", "wise/neowiser/p1bm_frm": "wise/neowiser/images/p1bm_frm"}
MAX_PER_VISIT = 16            # single WISE exposures stacked for one visit, at most (spread evenly over the visit)

_s = requests.Session()
_s.headers.update(UA)


def get(url: str, rng: tuple[int, int] | None = None) -> bytes:
    """A download (or a range of bytes of one), kept on disk: the same address is never fetched twice."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / hashlib.sha1((url + (f"#{rng[0]}-{rng[1]}" if rng else "")).encode()).hexdigest()
    if f.exists() and f.stat().st_size:
        return f.read_bytes()
    for k in range(7):
        try:
            r = _s.get(url, timeout=120, headers={"Range": f"bytes={rng[0]}-{rng[1]}"} if rng else None)
            if r.status_code == 404:
                return b""
            r.raise_for_status()
            f.write_bytes(r.content)
            return r.content
        except Exception:
            if k == 6:
                raise
            time.sleep(3 * 2 ** k)          # IRSA answers a busy moment with 503: wait longer each time
    return b""


def table(url: str) -> list[dict]:
    """An IRSA image search answered as CSV."""
    import csv
    text = get(url).decode()
    return list(csv.DictReader(io.StringIO(text)))


def hdu_of(raw: bytes):
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    h = fits.open(io.BytesIO(raw))
    return h[0].header, h[0].data.astype(np.float32)


def year_to_mjd(y: float) -> float:
    return 51544.5 + (y - 2000.0) * 365.25


def mjd_to_year(m: float) -> float:
    return 2000.0 + (m - 51544.5) / 365.25


def place(t: dict, year: float) -> tuple[float, float]:
    """Where a catalogued star stands in a year: its position of 2000 moved by its proper motion (no parallax)."""
    r = t["resolved"]
    pm = t.get("pm") or r
    dt = year - 2000.0
    dec = r["dec2000"] + pm["pmdec"] * dt / 3.6e6
    ra = r["ra2000"] + pm["pmra"] * dt / 3.6e6 / math.cos(math.radians(r["dec2000"]))
    return ra, dec


def sep_arcmin(a, b) -> float:
    return math.hypot((a[0] - b[0]) * math.cos(math.radians(a[1])), a[1] - b[1]) * 60


def onto(grid: dict, hdr, data, smooth: float = 0.0):
    """Resample an image onto the grid (bilinear), after smoothing it to the grid's pixel size when it is finer."""
    w = WCS(hdr)
    if smooth > 0:
        ok = np.isfinite(data)
        filled = gaussian_filter(np.where(ok, data, 0), smooth)
        weight = gaussian_filter(ok.astype(np.float32), smooth)
        data = np.where(weight > 0.5, filled / np.maximum(weight, 1e-6), np.nan)
    xs, ys = w.all_world2pix(grid["ra_g"], grid["dec_g"], 0, quiet=True)
    img = map_coordinates(data, [ys, xs], order=1, mode="constant", cval=np.nan)
    inside = (xs >= 0) & (ys >= 0) & (xs <= data.shape[1] - 1) & (ys <= data.shape[0] - 1)
    img[~inside] = np.nan
    return img, w


def sky_level(img):
    """Clipped median of the sky and its scatter, as for the SPHEREx exposures."""
    v = img[np.isfinite(img)]
    if v.size < 50:
        return 0.0, 0.0
    med = float(np.median(v))
    sig = float(1.4826 * np.median(np.abs(v - med)))
    for _ in range(3):
        keep = np.abs(v - med) < 3 * max(sig, 1e-9)
        if keep.sum() < 10:
            break
        med = float(np.median(v[keep]))
        sig = float(1.4826 * np.median(np.abs(v[keep] - med)))
    return med, sig


def pixel_sr(w: WCS) -> float:
    return float(abs(np.linalg.det(w.pixel_scale_matrix))) * (math.pi / 180) ** 2


def frame_line(survey, band, lam, mjds, img, n_used, note=None) -> dict:
    med, sig = sky_level(img)
    img = img - med
    good = np.isfinite(img)
    out = {"t": "frame", "survey": survey, "band": band, "lam": lam, "mjd": round(float(np.median(mjds)), 5),
           "t0": round(float(min(mjds)), 5), "t1": round(float(max(mjds)), 5), "n": n_used,
           "sig": round(sig, 5), "cov": round(float(good.mean()), 3)}
    if note:
        out["note"] = note
    out["b64"] = __import__("base64").b64encode(np.ascontiguousarray(img, dtype="<f2").tobytes()).decode()
    return out


# ------------------------------------------------------------------ 2MASS
def twomass(grid: dict, star=None) -> list[dict]:
    """The 2MASS Atlas Images that cover the grid, joined. Its date is the night of the image the star itself is in
    (a field can be joined from scans of nights months apart): `star(mjd)` gives the star's (ra, dec) on a date."""
    half = grid["size"] / 60 * 0.75
    rows = table(f"{IRSA}/search/twomass/allsky/allsky?POS={grid['ra']:.6f},{grid['dec']:.6f}&INTERSECT=OVERLAPS&SIZE={2 * half:.4f}"
                 "&ct=csv&columns=fname,ordate,hemisphere,scanno,filter,ut,magzp")
    cut = int(grid["size"] * 60 * 1.5)
    out = []
    for f, (band, lam, f0) in TWOMASS.items():
        mine = [r for r in rows if r["filter"].strip() == f]
        acc, wsum, mjds, on_star = None, None, [], []
        for r in mine:
            url = (f"{IRSA}/data/twomass/allsky/allsky/{r['ordate'].strip()}{r['hemisphere'].strip()}/s{int(r['scanno']):03d}/image/"
                   f"{r['fname'].strip()}?center={grid['ra']:.6f},{grid['dec']:.6f}&size={cut}arcsec")
            raw = get(url)
            if not raw:
                continue
            hdr, data = hdu_of(raw)
            img, w = onto(grid, hdr, data, smooth=0.45 * grid["scale"] / (abs(hdr["CDELT1"]) * 3600))
            if np.isfinite(img).mean() < 0.05:
                continue
            jy = f0 * 10 ** (-0.4 * float(hdr.get("MAGZP", r["magzp"])))
            img = img * jy / pixel_sr(w) / 1e6
            img = img - sky_level(img)[0]
            ok = np.isfinite(img)
            acc = np.where(ok, img, 0) if acc is None else acc + np.where(ok, img, 0)
            wsum = ok.astype(np.float32) if wsum is None else wsum + ok
            d = r["ordate"].strip()
            yy = int(d[:2]); yy += 1900 if yy > 50 else 2000
            hh, mm, ss = (float(x) for x in r["ut"].strip().split(":"))
            import datetime as dt
            t = dt.datetime(yy, int(d[2:4]), int(d[4:6])) + dt.timedelta(hours=hh, minutes=mm, seconds=ss)
            mjd = (t - dt.datetime(1858, 11, 17)).total_seconds() / 86400
            # the night counts as many times as the share of the field this image covers
            mjds += [mjd] * max(1, int(round(10 * ok.mean())))
            if star:
                x, y = w.all_world2pix([[*star(mjd)]], 0)[0]
                if 0 <= x < data.shape[1] and 0 <= y < data.shape[0]:
                    on_star.append(mjd)
        if acc is None:
            continue
        img = np.where(wsum > 0, acc / np.maximum(wsum, 1), np.nan)
        out.append(frame_line("2MASS", band, lam, on_star or mjds, img, len(mine)))
        print(f"   2MASS {band}: {len(mine)} atlas images, {mjd_to_year(np.median(on_star or mjds)):.2f}", flush=True)
    return out


# ------------------------------------------------------------------ WISE and NEOWISE
def wise(grid: dict) -> dict[int, list[dict]]:
    rows = []
    for path in WISE_SETS:
        for r in table(f"{IRSA}/search/{path}?POS={grid['ra']:.6f},{grid['dec']:.6f}&ct=csv"
                       "&columns=band,scan_id,scangrp,frame_num,mjd_obs,magzp,qual_frame"):
            if r["band"].strip() in ("1", "2") and float(r["qual_frame"] or 0) > 0:
                r["path"] = path
                rows.append(r)
    rows.sort(key=lambda r: float(r["mjd_obs"]))
    # visits: exposures less than 20 days apart
    visits, last = [], -1e9
    for r in rows:
        m = float(r["mjd_obs"])
        if m - last > 20:
            visits.append([])
        visits[-1].append(r)
        last = m
    out = {1: [], 2: []}
    jobs = []
    for v in visits:
        for b in (1, 2):
            mine = [r for r in v if int(r["band"]) == b]
            if len(mine) > MAX_PER_VISIT:
                idx = np.unique(np.round(np.linspace(0, len(mine) - 1, MAX_PER_VISIT)).astype(int))
                mine = [mine[i] for i in idx]
            jobs.append((b, mine))

    def one(r, b):
        sid, fr = r["scan_id"].strip(), int(r["frame_num"])
        url = f"{S3_WISE}{S3_DIR[r['path']]}/{r['scangrp'].strip()}/{sid}/{fr:03d}/{sid}{fr:03d}-w{b}-int-1b.fits"
        try:
            head = get(url, (0, 16 * 2880 - 1))          # the headers hold about 460 cards: 13 blocks
            if not head:
                return None
            try:
                hdr, off = sx._read_header(head, 0)
            except ValueError:
                hdr, off = sx._read_header(get(url, (0, 40 * 2880 - 1)), 0)
            w = WCS(hdr)
            nx, ny = int(hdr["NAXIS1"]), int(hdr["NAXIS2"])
            xs, ys = w.all_world2pix(grid["ra_g"], grid["dec_g"], 0, quiet=True)
            x0, x1 = max(0, int(np.floor(np.nanmin(xs))) - 2), min(nx, int(np.ceil(np.nanmax(xs))) + 3)
            y0, y1 = max(0, int(np.floor(np.nanmin(ys))) - 2), min(ny, int(np.ceil(np.nanmax(ys))) + 3)
            if x1 - x0 < 4 or y1 - y0 < 4:
                return None
            raw = get(url, (off + 4 * y0 * nx, off + 4 * y1 * nx - 1))          # whole rows y0 to y1: one range
        except Exception:
            lost.append(url)              # still refused after several tries: the visit is stacked without it
            return None
        data = np.frombuffer(raw, ">f4").reshape(y1 - y0, nx)[:, x0:x1].astype(np.float32)
        img = map_coordinates(data, [ys - y0, xs - x0], order=1, mode="constant", cval=np.nan)
        img[(xs < x0) | (ys < y0) | (xs > x1 - 1) | (ys > y1 - 1) | (xs < 0) | (ys < 0) | (xs > nx - 1) | (ys > ny - 1)] = np.nan
        if np.isfinite(img).mean() < 0.3:
            return None
        jy = WISE[b][2] * 10 ** (-0.4 * float(hdr.get("MAGZP", r["magzp"])))
        img = img * jy / pixel_sr(w) / 1e6
        return img - sky_level(img)[0], float(r["mjd_obs"])

    lost = []
    with ThreadPoolExecutor(8) as ex:
        for b, mine in jobs:
            got = [g for g in ex.map(lambda r: one(r, b), mine) if g is not None]
            if len(got) < 3:
                continue
            stack = np.nanmedian(np.stack([g[0] for g in got]), axis=0)
            name, lam, _ = WISE[b]
            survey = "NEOWISE" if any("neowiser" in r["path"] for r in mine) else "WISE"
            out[b].append(frame_line(survey, name, lam, [g[1] for g in got], stack, len(got)))
        for b in (1, 2):
            print(f"   WISE W{b}: {len(out[b])} visits, {', '.join(f'{mjd_to_year(f['mjd']):.1f}' for f in out[b])}", flush=True)
        if lost:
            print(f"   WISE: {len(lost)} exposures could not be fetched and were left out", flush=True)
    return out


# ------------------------------------------------------------------ the catalogues' brightness of each WISE visit
def catalogue_visits(t: dict, d) -> dict:
    """How bright WISE's own catalogues say the star was at each visit of the Years view: the AllWISE multi-epoch
    table (2010) and the NEOWISE single-exposure table (2013 to 2024), profile-fit magnitudes, which hold for
    saturated stars too. For every visit, the rows within 4 arcseconds of the star's place on that date and within
    its days; a visit's value is the median of its rows. Returns {"W1": [[mjd, mag, scatter, n], ...], "W2": [...]}."""
    import csv
    from urllib.parse import urlencode
    visits = [json.loads(l) for l in open(d / "years-w1.ndjson", encoding="utf-8") if '"t": "frame"' in l]

    def one(v):
        ra, dec = place(t, mjd_to_year(v["mjd"]))
        table_name, c1, c2 = ("allwise_p3as_mep", "w1mpro_ep", "w2mpro_ep") if v["mjd"] < 56000 else ("neowiser_p1bs_psd", "w1mpro", "w2mpro")
        q = (f"SELECT mjd, {c1}, {c2} FROM {table_name} WHERE CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',{ra:.6f},{dec:.6f},{4 / 3600:.6f}))=1 "
             f"AND mjd BETWEEN {v['t0'] - 1:.3f} AND {v['t1'] + 1:.3f}")
        rows = list(csv.DictReader(io.StringIO(get("https://irsa.ipac.caltech.edu/TAP/sync?" + urlencode({"QUERY": q, "FORMAT": "csv"})).decode())))
        res = {}
        for b, c in (("W1", c1), ("W2", c2)):
            m = np.array([float(r[c]) for r in rows if r.get(c) not in ("", None)])
            if m.size >= 3:
                res[b] = [round(float(np.median([float(r["mjd"]) for r in rows])), 3), round(float(np.median(m)), 3),
                          round(float(1.4826 * np.median(np.abs(m - np.median(m)))), 3), int(m.size)]
        return res

    out = {"W1": [], "W2": []}
    with ThreadPoolExecutor(4) as ex:
        for res in ex.map(one, visits):
            for b, v in res.items():
                out[b].append(v)
    for b in out:
        out[b].sort()
        if out[b]:
            print(f"   catalogue {b}: {len(out[b])} visits, {min(x[1] for x in out[b]):.2f} to {max(x[1] for x in out[b]):.2f} mag", flush=True)
    return out


# ------------------------------------------------------------------ the motion the images show (for the plain pages)
NEAR = {1: ("J", "W1"), 2: ("H", "W1"), 3: ("Ks", "W1"), 4: ("Ks", "W1"), 5: ("Ks", "W2"), 6: ("Ks", "W2")}


def measure(t: dict, d, det: int) -> dict:
    """What the page's Years box says, worked out the same way from the built images: in each image of 2MASS, of WISE
    in its band nearest to the detector and of SPHEREx in it, where the star's light lies against the catalogue's place
    for that date (motion and parallax); a missing saturated core counts as the window's brightest light and the
    centre is taken over six pixels; a star counts as seen when its light stands 10 sigma above the sky within 4"
    (8" when saturated). The motion is the catalogue's corrected by the straight line through the offsets."""
    import base64
    near = NEAR[det]
    frames, g = [], None
    for name in ("years-2mass.ndjson", "years-w1.ndjson" if near[1] == "W1" else "years-w2.ndjson", "years-spherex.ndjson"):
        for line in open(d / name, encoding="utf-8"):
            o = json.loads(line)
            if o["t"] == "head":
                g = o["grid"]
            elif o["t"] == "frame" and ((o["survey"] != "SPHEREx" and o["band"] in near) or (o.get("det") == det and o["n"] >= 5)):
                o["img"] = np.frombuffer(base64.b64decode(o.pop("b64")), "<f2").astype(np.float32).reshape(g["n"], g["n"])
                frames.append(o)
    frames.sort(key=lambda f: f["mjd"])
    n, sc = g["n"], g["scale"]
    r = t["resolved"]; pm = t.get("pm") or r; plx = (t.get("dist") or {}).get("plx", 0) or 0
    rad = math.pi / 180

    def predict(mjd):
        yr = mjd_to_year(mjd); dt = yr - 2000
        dec = r["dec2000"] + pm["pmdec"] * dt / 3.6e6; ra = r["ra2000"] + pm["pmra"] * dt / 3.6e6 / math.cos(r["dec2000"] * rad)
        if plx > 20:
            nn = mjd - 51544.5; gg = (357.528 + 0.9856003 * nn) * rad; q = 280.459 + 0.98564736 * nn
            L = (q + 1.915 * math.sin(gg) + 0.020 * math.sin(2 * gg)) * rad; R = 1.00014 - 0.01671 * math.cos(gg) - 0.00014 * math.cos(2 * gg)
            eps = (23.439 - 0.00000036 * nn) * rad; X, Y, Z = -R * math.cos(L), -R * math.cos(eps) * math.sin(L), -R * math.sin(eps) * math.sin(L)
            a, dd, p = ra * rad, dec * rad, plx / 1000
            e, no = p * (X * math.sin(a) - Y * math.cos(a)), p * (X * math.cos(a) * math.sin(dd) + Y * math.sin(a) * math.sin(dd) - Z * math.cos(dd))
            ra += e / 3600 / max(math.cos(dec * rad), 1e-6); dec += no / 3600
        a0, d0, a, dd = g["ra"] * rad, g["dec"] * rad, ra * rad, dec * rad
        D = math.sin(d0) * math.sin(dd) + math.cos(d0) * math.cos(dd) * math.cos(a - a0)
        xi = math.cos(dd) * math.sin(a - a0) / D / rad * 3600; eta = (math.cos(d0) * math.sin(dd) - math.sin(d0) * math.cos(dd) * math.cos(a - a0)) / D / rad * 3600
        c = (n - 1) / 2
        return c - xi / sc, c + eta / sc

    yy, xx = np.mgrid[0:n, 0:n]

    def centroid(img, x, y, R):
        for _ in range(4):
            win = np.hypot(xx - x, yy - y)
            vals = img[(win <= R + 3) & np.isfinite(img)]
            if vals.size < 10:
                return None
            bg = np.median(vals)
            v = np.where((win <= R + 0.5) & np.isfinite(img), img - bg, 0); v = np.clip(v, 0, None)
            if v.sum() <= 0:
                return None
            nx, ny = (v * xx).sum() / v.sum(), (v * yy).sum() / v.sum()
            if math.hypot(nx - x, ny - y) < 0.02:
                return nx, ny, float(v.max())
            x, y = nx, ny
        return x, y, float(v.max())

    seen = []
    for f in frames:
        img, (px, py) = f["img"], predict(f["mjd"])
        if not (9 < px < n - 10 and 9 < py < n - 10):
            continue
        x0, y0 = int(round(px)), int(round(py))
        core = img[y0 - 2:y0 + 3, x0 - 2:x0 + 3]
        sat = bool(np.isnan(core).any())
        if sat:
            win = np.hypot(xx - px, yy - py) <= 8
            img = img.copy(); img[win & ~np.isfinite(img)] = np.nanmax(np.where(win, img, np.nan))
        m = centroid(img, px, py, 6 if sat else 3)
        sig = f["sig"] or 1e-6
        if not m or not (m[2] > 10 * sig) or math.hypot(m[0] - px, m[1] - py) * sc > (8 if sat else 4):
            continue
        seen.append((mjd_to_year(f["mjd"]), -(m[0] - px) * sc, (m[1] - py) * sc, f["survey"], f["mjd"]))
    if len(seen) < 3:
        return {}
    t_ = np.array([q[0] for q in seen])
    fit = lambda v: float(np.polyfit(t_, np.array(v), 1)[0])
    pmE, pmN = pm["pmra"] / 1000 + fit([q[1] for q in seen]), pm["pmdec"] / 1000 + fit([q[2] for q in seen])
    rms = math.sqrt(sum(q[1] ** 2 + q[2] ** 2 for q in seen) / len(seen))
    return {"det": det, "pm": round(math.hypot(pmE, pmN), 2), "cat": round(math.hypot(pm["pmra"], pm["pmdec"]) / 1000, 2), "images": len(seen),
            "rms": round(rms, 1), "first": [seen[0][3], round(seen[0][4], 2)], "last": [seen[-1][3], round(seen[-1][4], 2)]}


# ------------------------------------------------------------------ SPHEREx
def spherex_visits(grid: dict) -> list[dict]:
    frames = sx.search_frames(grid["ra"], grid["dec"])
    out = []
    for det in range(1, 7):
        mine = sorted((f for f in frames if f["det"] == det), key=lambda f: f["mjd"])
        if len(mine) > 200:          # near the ecliptic poles SPHEREx looks hundreds of times: an even selection in time is plenty
            mine = [mine[i] for i in np.unique(np.round(np.linspace(0, len(mine) - 1, 200)).astype(int))]
        got = [r for _, r in sx.build(mine, grid) if r is not None]
        got.sort(key=lambda r: r["mjd"])
        visits, last = [], -1e9
        for r in got:
            if r["mjd"] - last > 30:
                visits.append([])
            visits[-1].append(r)
            last = r["mjd"]
        long = []
        for v in visits:          # a look that lasts for months (near the poles) is cut into parts of about 40 days
            k = max(1, int(np.ceil((v[-1]["mjd"] - v[0]["mjd"]) / 40)))
            edges = np.linspace(v[0]["mjd"], v[-1]["mjd"] + 1e-6, k + 1)
            long += [[r for r in v if a0 <= r["mjd"] < a1] for a0, a1 in zip(edges, edges[1:])]
        visits = [v for v in long if v]
        lo, hi = sx.DETECTOR_BANDS[det]
        for v in visits:
            if len(v) < 5:          # a visit of fewer exposures is too noisy to set beside the others
                continue
            stack = np.nanmedian(np.stack([r["data"].astype(np.float32) for r in v]), axis=0)
            out.append(frame_line("SPHEREx", f"D{det}", round((lo + hi) / 2, 3), [r["mjd"] for r in v], stack, len(v)))
            out[-1]["det"] = det
        print(f"   SPHEREx D{det}: {len(got)} exposures, {len(visits)} visits", flush=True)
    return out


def main():
    want = [a for a in sys.argv[1:] if not a.startswith("-")] or STARS
    targets = json.loads((ROOT / "web" / "data" / "targets.json").read_text(encoding="utf-8"))
    for slug, e in EXTRA.items():          # where they are now: the position of 2000 moved on to the end of 2026
        ra, dec = place(e, 2026.9)
        targets.append({**e, "slug": slug, "ra": round(ra, 6), "dec": round(dec, 6), "extra_years": True})
    idx_path = ROOT / "web" / "data" / "years.json"          # which showcase objects have the view, its grid and files
    index = json.loads(idx_path.read_text(encoding="utf-8")) if idx_path.exists() else {}
    for t in targets:
        if t["slug"] not in want:
            continue
        a, b = place(t, 1997.5), place(t, 2026.9)
        path = sep_arcmin(a, b)
        size = 5.0 if path < 1.0 else 10.0 if path < 6.5 else 15.0
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) if path >= 1.0 else (t["ra"], t["dec"])
        grid = sx.make_grid(round(mid[0], 6), round(mid[1], 6), size)
        print(f"[{t['slug']}] moves {path:.2f}' from 1997.5 to 2026.9; grid {size}' at {grid['ra']:.5f}, {grid['dec']:.5f}, "
              f"{grid['n']} px of {grid['scale']:.3f}\"", flush=True)
        head = {"t": "head", "grid": {k: grid[k] for k in ("ra", "dec", "n", "scale", "size")}}
        d = ROOT / "web" / "data" / t["slug"]
        d.mkdir(parents=True, exist_ok=True)
        if "--measure" in sys.argv:          # only the motion the built images show, for the plain pages
            det = (t.get("view") or {}).get("det") or t.get("det") or 5
            index[t["slug"]]["measured"] = measure(t, d, det)
            print(f"   measured in D{det}: {index[t['slug']]['measured']}", flush=True)
            idx_path.write_text(json.dumps(index, indent=1) + chr(10), encoding="utf-8")
            continue
        if "--cat" in sys.argv:          # only the catalogue brightness: the images stay as they are
            index[t["slug"]]["cat"] = catalogue_visits(t, ROOT / "web" / "data" / t["slug"])
            idx_path.write_text(json.dumps(index, indent=1) + chr(10), encoding="utf-8")
            continue
        parts = {"years-2mass.ndjson": twomass(grid, lambda mjd, t=t: place(t, mjd_to_year(mjd)))}
        if "--2mass" not in sys.argv:
            w = wise(grid)
            parts["years-w1.ndjson"], parts["years-w2.ndjson"] = w[1], w[2]
            parts["years-spherex.ndjson"] = spherex_visits(grid)
        span = []
        for name, lines in parts.items():
            lines.sort(key=lambda f: (f["mjd"], f.get("det", 0)))
            with open(d / name, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(json.dumps(head) + "\n")
                for f in lines:
                    fh.write(json.dumps(f) + "\n")
                fh.write(json.dumps({"t": "done", "n": len(lines)}) + "\n")
            span += [f["mjd"] for f in lines]
        if "--2mass" in sys.argv:          # the other files are as they were: their dates still count
            for name in ("years-w1.ndjson", "years-w2.ndjson", "years-spherex.ndjson"):
                span += [json.loads(l)["mjd"] for l in open(d / name, encoding="utf-8") if '"t": "frame"' in l]
        index[t["slug"]] = {"grid": head["grid"], "files": ["years-2mass.ndjson", "years-w1.ndjson", "years-w2.ndjson", "years-spherex.ndjson"], "span": [round(min(span), 3), round(max(span), 3)],
                            "built": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        if t.get("extra_years"):          # found by its place when opened by name: where it is now, and what it is called
            r = t["resolved"]
            index[t["slug"]].update({"at": [t["ra"], t["dec"]], "name": t["label"], "track": [r["ra2000"], r["dec2000"], r["pmra"], r["pmdec"], t["dist"]["plx"]]})
        if "--no-cat" not in sys.argv:
            index[t["slug"]]["cat"] = catalogue_visits(t, d)
        idx_path.write_text(json.dumps(index, indent=1) + "\n", encoding="utf-8")
        print(f"   written: {', '.join(f'{k} ({len(v)})' for k, v in parts.items())}", flush=True)


if __name__ == "__main__":
    main()
