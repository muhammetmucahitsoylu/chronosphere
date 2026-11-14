"""SPHEREx data access: find every exposure covering a sky position and cut
out an aligned, north-up stamp from each one.

Frame discovery goes through the IRSA SIA2 service. Pixels are read with HTTP
range requests straight from the public NASA/IRSA bucket on AWS, so only the
few hundred kilobytes around the target are transferred per exposure.
"""
from __future__ import annotations

import json
import math
import threading
import warnings
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from astropy.io import fits
from astropy.wcs import WCS
from scipy.interpolate import RegularGridInterpolator
from scipy.ndimage import map_coordinates

warnings.simplefilter("ignore")

SIA_URL = "https://irsa.ipac.caltech.edu/SIA"
S3_BASE = "https://nasa-irsa-spherex.s3.amazonaws.com/"
NPIX = 2040                 # detector is NPIX x NPIX
NATIVE_ARCSEC = 6.15        # native pixel scale
BLOCK = 2880                # FITS block size
HEAD_BYTES = 16 * BLOCK     # primary header + IMAGE header fit in here
MAX_GRID = 300              # largest stamp side, in output pixels

# Detector band edges in microns (for labels only; per-pixel values come from the data).
DETECTOR_BANDS = {1: (0.75, 1.11), 2: (1.11, 1.64), 3: (1.64, 2.42),
                  4: (2.42, 3.82), 5: (3.82, 4.42), 6: (4.42, 5.00)}

_local = threading.local()


def _session() -> requests.Session:
    s = getattr(_local, "s", None)
    if s is None:
        s = requests.Session()
        retry = Retry(total=4, backoff_factor=0.5, status_forcelist=[500, 502, 503, 504])
        s.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=4))
        _local.s = s
    return s


def _range(key: str, start: int | None, end: int | None, suffix: int | None = None) -> bytes:
    rng = f"bytes=-{suffix}" if suffix else f"bytes={start}-{end}"
    r = _session().get(S3_BASE + key, headers={"Range": rng}, timeout=40)
    r.raise_for_status()
    return r.content


# --------------------------------------------------------------------------
# Frame discovery
# --------------------------------------------------------------------------

def _release_rank(coll: str) -> int:
    """Data releases outrank quick releases; newer outranks older."""
    c = coll.lower()
    digits = "".join(ch for ch in c if ch.isdigit()) or "0"
    return (1000 if "_dr" in c else 0) + int(digits)


def search_frames(ra: float, dec: float, radius_deg: float = 0.003) -> list[dict]:
    """All SPHEREx level-2 science exposures covering (ra, dec), any release.

    Nothing about releases is hard-coded: whatever collections IRSA serves are
    returned and labelled, so a new data release shows up without a code change.
    """
    import pyvo
    svc = pyvo.dal.SIA2Service(SIA_URL)
    tb = svc.search(pos=(ra, dec, radius_deg), facility="SPHEREx").to_table()
    best: dict[tuple, dict] = {}
    for row in tb:
        band = str(row["energy_bandpassname"])
        if not band.startswith("SPHEREx-D"):
            continue
        if str(row["dataproduct_subtype"]) != "science" or int(row["calib_level"]) != 2:
            continue
        try:
            key = json.loads(str(row["cloud_access"]))["aws"]["key"]
        except Exception:
            continue
        coll = str(row["obs_collection"])
        f = {
            "id": str(row["obs_id"]),
            "det": int(band[-1]),
            "mjd": float(row["t_min"]),
            "coll": coll,
            "key": key,
            "url": str(row["access_url"]),
            "exp": float(row["t_exptime"]) if row["t_exptime"] is not np.ma.masked else None,
        }
        k = (f["id"], f["det"])
        if k not in best or _release_rank(coll) > _release_rank(best[k]["coll"]):
            best[k] = f
    return sorted(best.values(), key=lambda f: (f["mjd"], f["det"]))


# --------------------------------------------------------------------------
# Output grid
# --------------------------------------------------------------------------

def make_grid(ra: float, dec: float, size_arcmin: float) -> dict:
    """North-up, east-left tangent-plane grid centred on the target."""
    size_arcmin = float(min(max(size_arcmin, 1.0), 120.0))
    scale = max(NATIVE_ARCSEC / 2, size_arcmin * 60.0 / MAX_GRID)
    n = int(2 * round(size_arcmin * 30.0 / scale))
    w = WCS(naxis=2)
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    w.wcs.crval = [ra, dec]
    w.wcs.crpix = [(n + 1) / 2, (n + 1) / 2]
    w.wcs.cdelt = [-scale / 3600.0, scale / 3600.0]
    jj, ii = np.mgrid[0:n, 0:n]
    ra_g, dec_g = w.all_pix2world(ii, jj, 0)
    return {"ra": ra, "dec": dec, "n": n, "scale": scale, "size": size_arcmin,
            "ra_g": ra_g, "dec_g": dec_g}


# --------------------------------------------------------------------------
# One exposure
# --------------------------------------------------------------------------

def _read_header(buf: bytes, off: int):
    p = off
    while True:
        card = buf[p:p + 80]
        if len(card) < 80:
            raise ValueError("header truncated")
        p += 80
        if card[:8] == b"END     ":
            break
    hlen = ((p - off + BLOCK - 1) // BLOCK) * BLOCK
    return fits.Header.fromstring(buf[off:p].decode("ascii", "replace")), off + hlen


_wave_cache: dict[tuple, tuple] = {}
_wave_lock = threading.Lock()


def _wave_table(key: str, det: int):
    """Per-pixel wavelength / bandwidth lookup table (last HDU of the file).

    The table is a per-detector calibration product, identical between
    exposures of one processing version, so it is fetched once per
    (detector, processing version) and reused.
    """
    parts = key.split("/")
    ck = (det, parts[0], parts[3] if len(parts) > 3 else "")
    hit = _wave_cache.get(ck)
    if hit is not None:
        return hit
    tail = _range(key, None, None, suffix=2 * BLOCK)
    hdr, _ = _read_header(tail, 0)
    if hdr.get("EXTNAME") != "WCS-WAVE":
        raise ValueError("WCS-WAVE not at end of file")
    data = tail[BLOCK:]
    # Control-point grid size differs between detectors (11x11, 9x9, ...).
    nx = int(str(hdr["TFORM1"]).rstrip("J"))
    ny = int(str(hdr["TFORM2"]).rstrip("J"))
    x = np.frombuffer(data, ">i4", nx, 0).astype(float)
    y = np.frombuffer(data, ">i4", ny, 4 * nx).astype(float)
    v = np.frombuffer(data, ">f4", 2 * nx * ny, 4 * (nx + ny)).reshape(ny, nx, 2).astype(float)
    with _wave_lock:
        _wave_cache[ck] = (x, y, v)
    return x, y, v


def read_frame(frame: dict, grid: dict) -> dict | None:
    """Cut out, resample and background-subtract one exposure.

    Returns the frame metadata plus ``data`` (float16, n x n, MJy/sr) or None
    when the exposure does not usefully cover the stamp.
    """
    key = frame["key"]
    head = _range(key, 0, HEAD_BYTES - 1)
    _, off1 = _read_header(head, 0)
    hdr, data_off = _read_header(head, off1)
    w = WCS(hdr)
    n = grid["n"]
    xs, ys = w.all_world2pix(grid["ra_g"], grid["dec_g"], 0, quiet=True)
    if not np.isfinite(xs).all():
        return None
    x0 = max(0, int(math.floor(xs.min())) - 1)
    x1 = min(NPIX, int(math.ceil(xs.max())) + 2)
    y0 = max(0, int(math.floor(ys.min())) - 1)
    y1 = min(NPIX, int(math.ceil(ys.max())) + 2)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    # One contiguous byte range covering rows y0..y1-1, columns x0..x1-1.
    first = y0 * NPIX + x0
    last = (y1 - 1) * NPIX + x1          # exclusive
    raw = _range(key, data_off + 4 * first, data_off + 4 * last - 1)
    flat = np.full((y1 - y0) * NPIX, np.nan, dtype=np.float32)
    vals = np.frombuffer(raw, ">f4")
    flat[x0:x0 + vals.size] = vals
    cut = flat.reshape(y1 - y0, NPIX)[:, x0:x1]

    img = map_coordinates(cut, [ys - y0, xs - x0], order=1, mode="constant", cval=np.nan)
    good = np.isfinite(img)
    cov = float(good.mean())
    if cov < 0.2:
        return None

    # Local sky (zodiacal light + residuals) as a clipped median.
    v = img[good]
    med = float(np.median(v))
    sig = float(1.4826 * np.median(np.abs(v - med)))
    for _ in range(3):
        keep = np.abs(v - med) < 3 * max(sig, 1e-6)
        if keep.sum() < 10:
            break
        med = float(np.median(v[keep]))
        sig = float(1.4826 * np.median(np.abs(v[keep] - med)))
    img = img - med

    # Wavelength of every output pixel in this exposure -> plane fit.
    tx, ty, tv = _wave_table(key, frame["det"])
    px = np.clip(xs + 1, tx[0], tx[-1])
    py = np.clip(ys + 1, ty[0], ty[-1])
    lam = RegularGridInterpolator((ty, tx), tv[:, :, 0])(np.stack([py, px], -1))
    bw = RegularGridInterpolator((ty, tx), tv[:, :, 1])(np.stack([py, px], -1))
    c = (n - 1) / 2
    jj, ii = np.mgrid[0:n, 0:n]
    A = np.stack([np.ones(n * n), (ii - c).ravel(), (jj - c).ravel()], 1)
    coef, *_ = np.linalg.lstsq(A, lam.ravel(), rcond=None)

    out = dict(frame)
    out.update({
        "mjd": float(hdr.get("MJD-AVG", frame["mjd"])),
        "date": str(hdr.get("DATE-AVG", ""))[:19],
        "lam": round(float(coef[0]), 5),
        "lgx": float(coef[1]),
        "lgy": float(coef[2]),
        "bw": round(float(np.median(bw)), 5),
        "bg": round(med, 4),
        "sig": round(sig, 4),
        "cov": round(cov, 3),
        "fwhm": round(float(hdr.get("PSF_FWHM", 0) or 0), 2),
        "px": [round(float(xs[n // 2, n // 2]), 1), round(float(ys[n // 2, n // 2]), 1)],
        "data": img.astype(np.float16),
    })
    return out


def build(frames: list[dict], grid: dict, workers: int = 24):
    """Yield processed frames as they finish (unordered)."""
    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(read_frame, f, grid): f for f in frames}
        for fut in as_completed(futs):
            try:
                r = fut.result()
            except Exception as e:  # one bad exposure must not sink the request
                r = None
                futs[fut]["error"] = str(e)[:200]
            yield futs[fut], r
