"""Pictures for the plain pages and for link previews: real SPHEREx images, made from the same data the site shows.

    python scripts/build_images.py                          # the showcase objects (web/data) -> web/img/<slug>.gif and .jpg
    python scripts/build_images.py --pluto DIR EPHEM.json   # Pluto, six days apart -> web/img/pluto-blink.gif and .jpg
    python scripts/build_images.py --years SLUG [det]       # a star over 27 years (scripts/build_years.py) -> web/img/<slug>-years.webp and .jpg
    python scripts/build_images.py --hero                   # the front page's moving picture: Barnard's Star, 2000 to 2026 -> web/hero-barnard.webp and .jpg
    python scripts/build_images.py --share                  # the front page's link preview (1200 x 630) -> web/share.jpg

DIR holds Pluto's field as d1..d6.ndjson in the site's own format (read from the archive with the site's reader,
centred on 304.17 -23.612, 10 arcminutes); EPHEM.json holds JPL Horizons positions of Pluto ({"eph": [{mjd, ra, dec}]}).
The pictures are shown the way the site shows them: north up, east left, the same brightness stretch."""
import base64, json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
WEB, OUT = ROOT / "web", ROOT / "web" / "img"
BANDS = {1: (0.75, 1.11), 2: (1.11, 1.64), 3: (1.64, 2.42), 4: (2.42, 3.82), 5: (3.82, 4.42), 6: (4.42, 5.0)}
GREEN, INK, DIM, BG = (6, 214, 160), (243, 238, 230), (176, 167, 154), (10, 9, 8)
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


FONTS = ["C:/Windows/Fonts/segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"]


def font(size):
    for f in FONTS:                                    # a font that has the en dash, the micro sign and the arrow
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default(size=size)


def read(path):
    head, frames = None, []
    for line in open(path, encoding="utf-8"):
        if not line.strip():
            continue
        d = json.loads(line)
        if d["t"] == "head":
            head = d
        elif d["t"] == "frame" and d.get("cov", 1) >= 0.5:
            d["data"] = np.frombuffer(base64.b64decode(d.pop("b64")), "<f2").astype(np.float32)
            frames.append(d)
    frames.sort(key=lambda f: f["mjd"])
    return head, frames


def date(mjd, day=True):
    t = np.datetime64("1858-11-17") + np.timedelta64(int(round(mjd * 86400)), "s")
    y, m, d = str(t)[:10].split("-")
    return f"{int(d)} {MONTHS[int(m) - 1]} {y}" if day else f"{MONTHS[int(m) - 1]} {y}"


def median(frames, n):
    return np.nanmedian(np.stack([f["data"].reshape(n, n) for f in frames]), axis=0) if len(frames) > 1 else frames[0]["data"].reshape(n, n)


def robust_sig(img):
    v = img[np.isfinite(img)]
    return max(1.4826 * np.median(np.abs(v - np.median(v))), 1e-6) if v.size else 1.0


def stretch(img, top):
    """The site's display stretch (asinh from -2 sigma), with one top for every picture of a series."""
    sig = robust_sig(img)
    lo, soft = -2 * sig, 3 * sig
    norm = math.asinh((max(top, 10 * sig) - lo) / soft)
    t = np.clip(np.arcsinh((np.nan_to_num(img, nan=0) - lo) / soft) / norm, 0, 1)
    # a hole inside a bright star is its saturated core: white, as the site shows it
    hole = ~np.isfinite(img)
    if hole.any():
        bright = np.zeros_like(hole)
        b = np.nan_to_num(img, nan=-np.inf) > 0.5 * top
        for dy in range(-8, 9):
            for dx in range(-8, 9):
                bright |= np.roll(np.roll(b, dy, 0), dx, 1)
        t[hole & bright] = 1
        t[hole & ~bright] = 0
    return t[::-1]                                     # rows run from the south in the data: north up on the page


def picture(t, scale, rings=(), label="", sub="", crop=None):
    if crop:
        x0, y0, w = crop                               # in display coordinates (row 0 = north)
        t = t[y0:y0 + w, x0:x0 + w]
        rings = [(x - x0, y - y0, r) for x, y, r in rings]
    im = Image.fromarray((t * 255).astype(np.uint8), "L").resize((t.shape[1] * scale, t.shape[0] * scale), Image.LANCZOS).convert("RGB")
    d = ImageDraw.Draw(im)
    for x, y, r in rings:
        cx, cy, rr = (x + 0.5) * scale, (y + 0.5) * scale, r * scale
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=GREEN, width=max(2, scale // 2))
    if label:
        f = font(max(14, im.width // 22))
        d.rectangle([0, im.height - f.size * 2.2, im.width, im.height], fill=(0, 0, 0))
        d.text((10, im.height - f.size * 1.75), label, fill=INK, font=f)
        if sub:
            d.text((im.width - 10, im.height - f.size * 1.75), sub, fill=DIM, font=f, anchor="ra")
    return im


def save_gif(frames, path, ms=900, colors=128):
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=colors) for f in frames]
    pal[0].save(path, save_all=True, append_images=pal[1:], duration=ms, loop=0, optimize=True, disposal=2)


def preview(frames, title, path, captions=()):
    """1200 x 630 for link previews: the first and the last picture of a series side by side."""
    W, H, side = 1200, 630, 520
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    pics = [frames[0], frames[-1]]
    for i, p in enumerate(pics):
        x = 40 + i * (side + 40 + 40)
        im.paste(p.resize((side, side), Image.LANCZOS), (x, 30))
    d.text((W // 2, H - 52), title, fill=INK, font=font(30), anchor="mm")
    im.save(path, quality=86, optimize=True)


def refine(eps, max_days=60, chunk_days=40):
    out = []
    for a, b in eps:
        if b - a <= max_days:
            out.append((a, b)); continue
        k = math.ceil((b - a) / chunk_days)
        out += [(a + (b - a) * i / k, a + (b - a) * (i + 1) / k) for i in range(k)]
    return out


def track(t, mjd):
    """Where a catalogued mover is on a date (year-2000 position and yearly motion; parallax is below a pixel here)."""
    r = t.get("resolved") or {}
    if not r.get("pmra"):
        return t["ra"], t["dec"]
    yr = 2000 + (mjd - 51544.5) / 365.25
    dec = r["dec2000"] + r["pmdec"] * (yr - 2000) / 3.6e6
    ra = r["ra2000"] + r["pmra"] * (yr - 2000) / 3.6e6 / math.cos(math.radians(r["dec2000"]))
    return ra, dec


def to_grid(g, ra, dec):
    a0, d0, a, d = map(math.radians, (g["ra"], g["dec"], ra, dec))
    D = math.sin(d0) * math.sin(d) + math.cos(d0) * math.cos(d) * math.cos(a - a0)
    xi = math.cos(d) * math.sin(a - a0) / D * 206264.806
    eta = (math.cos(d0) * math.sin(d) - math.sin(d0) * math.cos(d) * math.cos(a - a0)) / D * 206264.806
    c = (g["n"] - 1) / 2
    return c - xi / g["scale"], c + eta / g["scale"]


def showcase(t):
    det, mode = t["view"]["det"], t["view"]["mode"]
    head, frames = read(WEB / "data" / t["slug"] / f"d{det}.ndjson")
    g, n = head["grid"], head["grid"]["n"]
    deep = median(frames[:: max(1, len(frames) // 60)], n)
    sig = robust_sig(deep)
    top = max(np.nanpercentile(deep, 99.7), 25 * sig)
    scale = max(3, round(420 / n))
    ring = 18 / g["scale"]                              # 18 arcseconds: the object stays clear inside
    pics, series = [], []
    if mode == "bands":
        per = {}
        for d in range(1, 7):
            h2, fr = read(WEB / "data" / t["slug"] / f"d{d}.ndjson")
            if not fr:
                continue
            img = median(fr[:: max(1, len(fr) // 60)], n)
            s2 = robust_sig(img)
            x, y = to_grid(g, *track(t, fr[len(fr) // 2]["mjd"]))
            per[d] = stretch(img, max(np.nanpercentile(img, 99.7), 25 * s2))
            pics.append(picture(per[d], scale, [(x, n - 1 - y, ring)], f"D{d}  {BANDS[d][0]}–{BANDS[d][1]} µm", "SPHEREx"))
            series.append(f"D{d}")
        # then all of them as one colour picture, as the site shows it: short wavelengths blue, long red
        R, Gn, B = per.get(6, per.get(5)), per.get(4, per.get(3)), per.get(2, per.get(1))
        if R is not None and Gn is not None and B is not None:
            rgb = np.dstack([R, Gn, B])
            canvas = Image.fromarray((rgb * 255).astype(np.uint8), "RGB").resize((n * scale, n * scale), Image.LANCZOS)
            d = ImageDraw.Draw(canvas)
            cx, cy, rr = (x + 0.5) * scale, (n - 1 - y + 0.5) * scale, ring * scale
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=GREEN, width=max(2, scale // 2))
            f = font(max(14, canvas.width // 22))
            d.rectangle([0, canvas.height - f.size * 2.2, canvas.width, canvas.height], fill=(0, 0, 0))
            d.text((10, canvas.height - f.size * 1.75), "D2 + D4 + D6", fill=INK, font=f)
            d.text((canvas.width - 10, canvas.height - f.size * 1.75), "SPHEREx", fill=DIM, font=f, anchor="ra")
            pics.append(canvas)
            series.append("colour")
    else:
        for a, b in refine(head["epochs"]):
            fr = [f for f in frames if a - 1e-6 <= f["mjd"] <= b + 1e-6]
            if len(fr) < 2:
                continue
            mid = (fr[0]["mjd"] + fr[-1]["mjd"]) / 2
            x, y = to_grid(g, *track(t, mid))
            pics.append((mid, picture, (stretch(median(fr, n), top), scale, [(x, n - 1 - y, ring)])))
        # one picture a month for a long visit: name each by its month, or by its day where two share a month
        months = [date(m, False) for m, _, _ in pics]
        labels = [date(m) if months.count(date(m, False)) > 1 else date(m, False) for m, _, _ in pics]
        pics = [fn(*args, lab, f"SPHEREx D{det}") for (m, fn, args), lab in zip(pics, labels)]
        series = labels
    OUT.mkdir(exist_ok=True)
    save_gif(pics, OUT / f"{t['slug']}.gif", 1100 if mode == "bands" else 900)
    preview(pics, f"{t['label']} · SPHEREx · {series[0]} → {series[-1]}", OUT / f"{t['slug']}.jpg")
    print(f"{t['slug']}: {len(pics)} pictures ({', '.join(series)}), {(OUT / (t['slug'] + '.gif')).stat().st_size // 1024} kB gif")


def body(t):
    """A body of the solar system: one picture for every stop of the telescope that caught it, the ring on its path
    (the entry's `eph`, from JPL Horizons). The detectors D1 to D3 are used, where it shines by reflected sunlight."""
    eph = t["eph"]
    def at(mjd):
        for p, q in zip(eph, eph[1:]):
            if p[0] <= mjd <= q[0]:
                f = (mjd - p[0]) / (q[0] - p[0])
                return p[1] + f * (q[1] - p[1]), p[2] + f * (q[2] - p[2])
    stops = {}
    for det in (1, 2, 3):
        head, frames = read(WEB / "data" / t["slug"] / f"d{det}.ndjson")
        g, n = head["grid"], head["grid"]["n"]
        deep = median(frames[:: max(1, len(frames) // 60)], n)
        top = max(np.nanpercentile(deep, 99.7), 25 * robust_sig(deep))
        for f in frames:
            p = at(f["mjd"])
            if p is None:
                continue
            x, y = to_grid(g, *p)
            if not (4 < x < n - 5 and 4 < y < n - 5) or not np.isfinite(f["data"].reshape(n, n)[int(round(y)), int(round(x))]):
                continue
            s = stops.setdefault(f["id"].rsplit("_", 1)[0], {"det": det, "top": top, "frames": [], "xy": []})
            s["frames"].append(f); s["xy"].append((x, y))
    scale, ring = max(3, round(420 / n)), 18 / g["scale"]
    pics, labels = [], []
    for s in sorted(stops.values(), key=lambda s: s["frames"][0]["mjd"]):
        fr = s["frames"]
        if len(fr) < 2:                                 # a single exposure carries its cosmic-ray hits: left out of the picture series
            continue
        # three exposures or more: their median; two: the fainter of the two at each pixel, which leaves cosmic-ray hits out
        img = median(fr, n) if len(fr) != 2 else np.fmin(fr[0]["data"].reshape(n, n), fr[1]["data"].reshape(n, n))
        x, y = np.mean([p[0] for p in s["xy"]]), np.mean([p[1] for p in s["xy"]])
        mid = sum(f["mjd"] for f in fr) / len(fr)
        labels.append(date(mid))
        pics.append(picture(stretch(img, s["top"]), scale, [(x, n - 1 - y, ring)], date(mid), f"SPHEREx D{s['det']}"))
    OUT.mkdir(exist_ok=True)
    save_gif(pics, OUT / f"{t['slug']}.gif", 600, 40)          # many pictures: fewer shades of grey keep the file small
    preview(pics, f"{t['label']} · SPHEREx · {labels[0]} → {labels[-1]}", OUT / f"{t['slug']}.jpg")
    print(f"{t['slug']}: {len(pics)} pictures, one per stop of the telescope ({labels[0]} to {labels[-1]}), {(OUT / (t['slug'] + '.gif')).stat().st_size // 1024} kB gif")


def followed(t):
    """A body that is followed (every exposure cut out around it, scripts/build_body.mjs): one picture for each of its
    visits, the median of that visit's exposures in one detector. The stars behind it differ from exposure to exposure
    and drop out. Both on one scale of brightness, the brighter visit's, as the site shows them; the middle half of
    the field, where the body is."""
    det = t["view"]["det"]
    head, frames = read(WEB / "data" / t["slug"] / f"d{det}.ndjson")
    g, n = head["grid"], head["grid"]["n"]
    stacks = []
    for a, b in head["epochs"]:
        fr = [f for f in frames if a - 1e-6 <= f["mjd"] <= b + 1e-6]
        if len(fr) >= 3:
            img = median(fr, n)
            stacks.append((img, max(np.nanpercentile(img, 99.7), 25 * robust_sig(img)), (fr[0]["mjd"] + fr[-1]["mjd"]) / 2, len(fr)))
    top = max(s[1] for s in stacks)
    w = n // 2
    crop, scale, c = ((n - w) // 2, (n - w) // 2, w), 4, (n - 1) / 2
    ring = 18 / g["scale"]
    pics = [picture(stretch(img, top), scale, [(c, c, ring)], date(mid, False), f"SPHEREx D{det}", crop) for img, _, mid, _ in stacks]
    labels = [date(mid, False) for _, _, mid, _ in stacks]
    OUT.mkdir(exist_ok=True)
    save_gif(pics, OUT / f"{t['slug']}.gif", 1300)
    preview(pics, f"{t['label']} · SPHEREx · {labels[0]} → {labels[-1]}", OUT / f"{t['slug']}.jpg")
    print(f"{t['slug']}: {len(pics)} pictures, one per visit ({', '.join(f'{lab}: {k} exposures' for lab, (_, _, _, k) in zip(labels, stacks))}), {(OUT / (t['slug'] + '.gif')).stat().st_size // 1024} kB gif")


def pluto(src, eph_path):
    eph = json.load(open(eph_path, encoding="utf-8"))["eph"]
    def at(mjd):
        for p, q in zip(eph, eph[1:]):
            if p["mjd"] <= mjd <= q["mjd"]:
                f = (mjd - p["mjd"]) / (q["mjd"] - p["mjd"])
                return p["ra"] + f * (q["ra"] - p["ra"]), p["dec"] + f * (q["dec"] - p["dec"])
    head, frames = read(Path(src) / "d1.ndjson")
    g, n = head["grid"], head["grid"]["n"]
    # two moments six days apart, as Clyde Tombaugh's plates of 23 and 29 January 1930 were; each a few exposures
    # taken minutes apart, so that the median of each leaves out what a single exposure alone shows
    A = [f for f in frames if f["id"].startswith("2025W41_1A_0050")]
    B = [f for f in frames if f["id"].startswith("2025W41_2B_0636")]
    deep = median(frames[:: max(1, len(frames) // 60)], n)
    top = max(np.nanpercentile(deep, 99.8), 40 * robust_sig(deep))
    pa, pb = [to_grid(g, *at(sum(f["mjd"] for f in s) / len(s))) for s in (A, B)]
    cx, cy = (pa[0] + pb[0]) / 2, n - 1 - (pa[1] + pb[1]) / 2
    w = 72
    crop = (int(round(cx - w / 2)), int(round(cy - w / 2)), w)
    scale, ring = 5, 15 / g["scale"]
    pics, marked = [], []
    for s, p in ((A, pa), (B, pb)):
        mid = sum(f["mjd"] for f in s) / len(s)
        t = stretch(median(s, n), top)
        pics.append(picture(t, scale, [], date(mid), "SPHEREx D1", crop))
        marked.append(picture(t, scale, [(p[0], n - 1 - p[1], ring)], date(mid), "Pluto", crop))
    OUT.mkdir(exist_ok=True)
    save_gif(pics, OUT / "pluto-blink.gif", 700)
    preview(marked, "Pluto in two SPHEREx exposures, six days apart", OUT / "pluto-blink.jpg")
    hop = math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * g["scale"]
    print(f"pluto: {date(A[0]['mjd'])} ({len(A)} exposures) and {date(B[0]['mjd'])} ({len(B)}), moved {hop:.0f} arcseconds")


def years(slug, det=None):
    """A star over a quarter of a century, from the images built by scripts/build_years.py: 2MASS, WISE and NEOWISE,
    SPHEREx, each telescope in its band nearest to the detector the star is shown in; each picture on its own scale of
    brightness (the telescopes differ), the ring where the catalogue puts the star on that date. The first and the last
    picture are held longer."""
    t = next(x for x in json.load(open(WEB / "data" / "targets.json", encoding="utf-8")) if x["slug"] == slug)
    det = det or t["view"]["det"]
    near = {1: ("J", "W1"), 2: ("H", "W1"), 3: ("Ks", "W1"), 4: ("Ks", "W1"), 5: ("Ks", "W2"), 6: ("Ks", "W2")}[det]
    frames, g = [], None
    for name in ("years-2mass.ndjson", "years-w1.ndjson" if near[1] == "W1" else "years-w2.ndjson", "years-spherex.ndjson"):
        for line in open(WEB / "data" / slug / name, encoding="utf-8"):
            d = json.loads(line)
            if d["t"] == "head":
                g = d["grid"]
            elif d["t"] == "frame" and (d["band"] in near or d.get("det") == det):
                d["data"] = np.frombuffer(base64.b64decode(d.pop("b64")), "<f2").astype(np.float32)
                frames.append(d)
    frames.sort(key=lambda f: f["mjd"])
    n, scale = g["n"], 2
    pics = []
    for f in frames:
        img = f["data"].reshape(n, n)
        top = max(np.nanpercentile(img, 99.7), 25 * robust_sig(img))
        x, y = to_grid(g, *track(t, f["mjd"]))
        what = f"SPHEREx D{det}" if f["survey"] == "SPHEREx" else f"{f['survey']} {f['band']}"
        pics.append(picture(stretch(img, top), scale, [(x, n - 1 - y, 14 / g["scale"])], date(f["mjd"], False), what))
    OUT.mkdir(exist_ok=True)
    ms = [1600] + [260] * (len(pics) - 2) + [1600]
    pics[0].save(OUT / f"{slug}-years.webp", save_all=True, append_images=pics[1:], duration=ms, loop=0, quality=72, method=6)
    preview(pics, f"{t['label']} · {date(frames[0]['mjd'], False)} → {date(frames[-1]['mjd'], False)} · 2MASS, WISE, SPHEREx", OUT / f"{slug}-years.jpg")
    print(f"{slug}: {len(pics)} pictures, {date(frames[0]['mjd'], False)} to {date(frames[-1]['mjd'], False)}, {(OUT / (slug + '-years.webp')).stat().st_size // 1024} kB webp")


def hero(slug="barnard", det=5, side=320, crop_arcmin=7.2):
    """The front page's moving picture: the star's walk, cut to the part of the field it crosses, in the way the site
    draws its images (north up, the ring on the star where the catalogue puts it); the year in a corner. One image a
    year of WISE and NEOWISE (the visits of early in each year), every SPHEREx visit. For people who asked their device
    for less motion, one still picture: the newest image, with the path from the oldest drawn in."""
    t = next(x for x in json.load(open(WEB / "data" / "targets.json", encoding="utf-8")) if x["slug"] == slug)
    near = {5: ("Ks", "W2"), 6: ("Ks", "W2"), 4: ("Ks", "W1")}[det]
    frames, g = [], None
    for name in ("years-2mass.ndjson", "years-w2.ndjson" if near[1] == "W2" else "years-w1.ndjson", "years-spherex.ndjson"):
        for line in open(WEB / "data" / slug / name, encoding="utf-8"):
            d = json.loads(line)
            if d["t"] == "head":
                g = d["grid"]
            elif d["t"] == "frame" and (d["band"] in near or d.get("det") == det):
                d["data"] = np.frombuffer(base64.b64decode(d.pop("b64")), "<f2").astype(np.float32)
                frames.append(d)
    frames.sort(key=lambda f: f["mjd"])
    yr = lambda f: 2000 + (f["mjd"] - 51544.5) / 365.25
    keep, seen = [], set()
    for f in frames:                                   # WISE and NEOWISE: the first visit of each year
        if f["survey"] in ("WISE", "NEOWISE"):
            y = int(yr(f))
            if y in seen:
                continue
            seen.add(y)
        keep.append(f)
    n = g["n"]
    a, b = to_grid(g, *track(t, keep[0]["mjd"])), to_grid(g, *track(t, keep[-1]["mjd"]))
    w = int(round(crop_arcmin * 60 / g["scale"]))
    cx, cy = (a[0] + b[0]) / 2, n - 1 - (a[1] + b[1]) / 2
    x0, y0 = int(round(cx - w / 2)), int(round(cy - w / 2))
    f_year = font(22)
    pics = []
    for f in keep:
        img = f["data"].reshape(n, n)
        top = max(np.nanpercentile(img, 99.7), 25 * robust_sig(img))
        tt = stretch(img, top)[y0:y0 + w, x0:x0 + w]
        im = Image.fromarray((tt * 255).astype(np.uint8), "L").resize((side, side), Image.LANCZOS).convert("RGB")
        d = ImageDraw.Draw(im)
        k = side / w
        x, y = to_grid(g, *track(t, f["mjd"]))
        X, Y, R = (x - x0 + 0.5) * k, (n - 1 - y - y0 + 0.5) * k, 9.2 / g["scale"] * k
        d.ellipse([X - R, Y - R, X + R, Y + R], outline=GREEN, width=2)
        d.text((10, 8), str(int(yr(f))), fill=INK, font=f_year)
        pics.append(im)
    ms = [1400] + [330] * (len(pics) - 2) + [1400]
    pics[0].save(WEB / f"hero-{slug}.webp", save_all=True, append_images=pics[1:], duration=ms, loop=0, quality=62, method=6)
    still = pics[-1].copy(); d = ImageDraw.Draw(still)
    pts = [((to_grid(g, *track(t, f["mjd"]))[0] - x0 + 0.5) * side / w, (n - 1 - to_grid(g, *track(t, f["mjd"]))[1] - y0 + 0.5) * side / w) for f in keep]
    for p0, p1 in zip(pts, pts[1:]):
        d.line([p0, p1], fill=(255, 255, 255), width=1)
    d.ellipse([pts[0][0] - 4, pts[0][1] - 4, pts[0][0] + 4, pts[0][1] + 4], outline=INK, width=2)
    d.text((pts[0][0] + 10, pts[0][1] - 10), str(int(yr(keep[0]))), fill=INK, font=font(18))
    still.save(WEB / f"hero-{slug}.jpg", quality=84, optimize=True)
    print(f"hero: {len(pics)} pictures ({int(yr(keep[0]))} to {int(yr(keep[-1]))}), {(WEB / f'hero-{slug}.webp').stat().st_size // 1024} kB webp, {(WEB / f'hero-{slug}.jpg').stat().st_size // 1024} kB still")


def share(slug="barnard", det=5):
    """The picture that a link to the front page shows (1200 x 630): the star's walk, its oldest image beside its newest
    and the path between them, under one line that says what the site does."""
    t = next(x for x in json.load(open(WEB / "data" / "targets.json", encoding="utf-8")) if x["slug"] == slug)
    near = ("Ks", "W2")
    frames, g = [], None
    for name in ("years-2mass.ndjson", "years-spherex.ndjson"):
        for line in open(WEB / "data" / slug / name, encoding="utf-8"):
            d = json.loads(line)
            if d["t"] == "head":
                g = d["grid"]
            elif d["t"] == "frame" and (d["band"] in near or d.get("det") == det):
                d["data"] = np.frombuffer(base64.b64decode(d.pop("b64")), "<f2").astype(np.float32)
                frames.append(d)
    frames.sort(key=lambda f: f["mjd"])
    first, last = frames[0], frames[-1]
    n, side = g["n"], 430
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(im)
    d.text((W // 2, 46), "The sky is not still.", fill=INK, font=font(44), anchor="mm")
    d.text((W // 2, 96), "The same patch of sky, 26 years apart: Barnard's Star has walked 4.6 arcminutes north.", fill=DIM, font=font(24), anchor="mm")
    xs = (W // 2 - side - 30, W // 2 + 30)
    for x, f, label in ((xs[0], first, f"{date(first['mjd'], False)} · 2MASS"), (xs[1], last, f"{date(last['mjd'], False)} · NASA SPHEREx")):
        img = f["data"].reshape(n, n)
        tt = stretch(img, max(np.nanpercentile(img, 99.7), 25 * robust_sig(img)))
        pic = Image.fromarray((tt * 255).astype(np.uint8), "L").resize((side, side), Image.LANCZOS).convert("RGB")
        dd = ImageDraw.Draw(pic)
        for ff, col in ((first, (255, 255, 255)), (last, GREEN)):
            px, py = to_grid(g, *track(t, ff["mjd"]))
            X, Y, R = (px + 0.5) * side / n, (n - 1 - py + 0.5) * side / n, 9.2 / g["scale"] * side / n
            if ff is f:
                dd.ellipse([X - R, Y - R, X + R, Y + R], outline=GREEN, width=3)
            else:
                dd.ellipse([X - 3, Y - 3, X + 3, Y + 3], outline=col, width=2)
        im.paste(pic, (x, 128))
        d.text((x + 12, 128 + side - 34), label, fill=INK, font=font(22))
    d.text((W // 2, H - 34), "chronospherex.com  ·  real images: 2MASS, NASA WISE and NEOWISE, NASA SPHEREx", fill=DIM, font=font(22), anchor="mm")
    im.save(WEB / "share.jpg", quality=86, optimize=True)
    print(f"share: {(WEB / 'share.jpg').stat().st_size // 1024} kB")


if __name__ == "__main__":
    if sys.argv[1:2] == ["--pluto"]:
        pluto(sys.argv[2], sys.argv[3])
    elif sys.argv[1:2] == ["--share"]:
        share()
    elif sys.argv[1:2] == ["--hero"]:
        hero()
    elif sys.argv[1:2] == ["--years"]:
        years(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else None)
    else:
        want = sys.argv[1:]
        for t in json.load(open(WEB / "data" / "targets.json", encoding="utf-8")):
            if want and t["slug"] not in want:
                continue
            (followed if t.get("follow") else body if t.get("eph") else showcase)(t)
