"""Pictures for the plain pages and for link previews: real SPHEREx images, made from the same data the site shows.

    python scripts/build_images.py                          # the five test objects (web/data) -> web/img/<slug>.gif and .jpg
    python scripts/build_images.py --pluto DIR EPHEM.json   # Pluto, six days apart -> web/img/pluto-blink.gif and .jpg

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


def save_gif(frames, path, ms=900):
    pal = [f.convert("P", palette=Image.ADAPTIVE, colors=128) for f in frames]
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


if __name__ == "__main__":
    if sys.argv[1:2] == ["--pluto"]:
        pluto(sys.argv[2], sys.argv[3])
    else:
        for t in json.load(open(WEB / "data" / "targets.json", encoding="utf-8")):
            showcase(t)
