"""Turns a sky position into a newline-delimited JSON stream of aligned frames.

The same stream format is used live (served by the API as frames finish) and
for the pre-built showcase targets (saved to static files), so the web app has
a single loader.

Line types:
  {"t":"head", grid, det, total, avail, releases, ...}
  {"t":"frame", id, det, mjd, date, coll, lam, lgx, lgy, bw, bg, sig, cov, fwhm, b64}
  {"t":"done", n, skipped}
"""
from __future__ import annotations

import base64
import json
import threading
import time
from collections import Counter

import numpy as np

import spherex as sx

MAX_FRAMES_PER_DET = 160
_search_cache: dict[tuple, tuple[float, list]] = {}
_search_lock = threading.Lock()


def cached_search(ra: float, dec: float) -> list[dict]:
    k = (round(ra, 4), round(dec, 4))
    with _search_lock:
        hit = _search_cache.get(k)
        if hit and time.time() - hit[0] < 1800:
            return hit[1]
    frames = sx.search_frames(ra, dec)
    with _search_lock:
        _search_cache[k] = (time.time(), frames)
    return frames


def epochs_of(mjds: list[float], gap_days: float = 30.0) -> list[list[float]]:
    out: list[list[float]] = []
    for t in sorted(mjds):
        if out and t - out[-1][1] <= gap_days:
            out[-1][1] = t
        else:
            out.append([t, t])
    return out


def thin(frames: list[dict], limit: int) -> list[dict]:
    """Even subsample in time order, so every observing season stays covered."""
    if len(frames) <= limit:
        return frames
    idx = np.unique(np.round(np.linspace(0, len(frames) - 1, limit)).astype(int))
    return [frames[i] for i in idx]


def summary(ra: float, dec: float) -> dict:
    frames = cached_search(ra, dec)
    return {
        "total": len(frames),
        "avail": {str(d): sum(1 for f in frames if f["det"] == d) for d in range(1, 7)},
        "releases": dict(Counter(f["coll"] for f in frames)),
        "epochs": epochs_of([f["mjd"] for f in frames]),
    }


def stream(ra: float, dec: float, size_arcmin: float, det: int,
           limit: int = MAX_FRAMES_PER_DET):
    """Generator of NDJSON lines for one detector."""
    all_frames = cached_search(ra, dec)
    mine = [f for f in all_frames if f["det"] == det]
    use = thin(mine, limit)
    grid = sx.make_grid(ra, dec, size_arcmin)
    head = {
        "t": "head", "det": det,
        "grid": {k: grid[k] for k in ("ra", "dec", "n", "scale", "size")},
        "band": sx.DETECTOR_BANDS[det],
        **summary(ra, dec),          # "total" here counts every detector
        "use": len(use), "found": len(mine),
    }
    yield json.dumps(head) + "\n"
    n_ok = skipped = failed = 0

    def emit(r):
        data = r.pop("data")
        r.pop("key", None)
        r["t"] = "frame"
        r["b64"] = base64.b64encode(np.ascontiguousarray(data, dtype="<f2").tobytes()).decode()
        return json.dumps(r) + "\n"

    retry = []
    for f, r in sx.build(use, grid):
        if r is None:
            if f.pop("error", None):
                retry.append(f)        # network hiccup: try once more at the end
            else:
                skipped += 1           # exposure does not cover the stamp
            continue
        n_ok += 1
        yield emit(r)
    for f in retry:
        try:
            r = sx.read_frame(f, grid)
        except Exception:
            r = None
            failed += 1
        if r is not None:
            n_ok += 1
            yield emit(r)
    yield json.dumps({"t": "done", "n": n_ok, "skipped": skipped, "failed": failed}) + "\n"
