"""Web API + static file server.

  /api/stream?ra=&dec=&size=&det=   aligned frames for one detector (NDJSON)
  /api/summary?ra=&dec=             what SPHEREx has at this position
  /api/resolve?q=                   object name -> position today
  /api/catalog?ra=&dec=&size=&cat=  Gaia DR3 / CatWISE2020 overlay

Run:  python -m uvicorn server:app --app-dir backend --port 8000
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

import catalogs
import pipeline

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
CACHE.mkdir(exist_ok=True)

app = FastAPI(title="Chronosphere API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


def _key(*parts) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:20]


def _check(ra: float, dec: float):
    if not (0 <= ra < 360 and -90 <= dec <= 90):
        raise HTTPException(400, "ra must be 0..360 and dec -90..90 (degrees)")


@app.get("/api/stream")
def api_stream(ra: float, dec: float, size: float = 5.0, det: int = Query(2, ge=1, le=6)):
    _check(ra, dec)
    size = min(max(size, 1.0), 60.0)
    path = CACHE / f"s_{_key(round(ra, 5), round(dec, 5), size, det)}.ndjson"
    if path.exists():
        return FileResponse(path, media_type="application/x-ndjson")

    def gen():
        tmp = path.with_suffix(".part%d" % os.getpid())
        complete = False
        try:
            with open(tmp, "w", encoding="utf-8") as fh:
                for line in pipeline.stream(ra, dec, size, det):
                    fh.write(line)
                    yield line
                complete = True
        finally:
            try:
                if complete:
                    os.replace(tmp, path)
                else:
                    os.remove(tmp)
            except OSError:
                pass

    return StreamingResponse(gen(), media_type="application/x-ndjson",
                             headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"})


@app.get("/api/summary")
def api_summary(ra: float, dec: float):
    _check(ra, dec)
    return pipeline.summary(ra, dec)


@app.get("/api/resolve")
def api_resolve(q: str):
    r = catalogs.resolve(q.strip())
    if not r:
        raise HTTPException(404, f"could not resolve '{q}'")
    return r


@app.get("/api/catalog")
def api_catalog(ra: float, dec: float, size: float = 5.0, cat: str = "gaia"):
    _check(ra, dec)
    if cat not in ("gaia", "catwise"):
        raise HTTPException(400, "cat must be gaia or catwise")
    path = CACHE / f"c_{cat}_{_key(round(ra, 4), round(dec, 4), size)}.json"
    if path.exists():
        return JSONResponse(json.loads(path.read_text()))
    radius = size * 0.75 + 0.5      # arcmin: stamp half-diagonal plus margin
    fn = catalogs.gaia if cat == "gaia" else catalogs.catwise
    try:
        rows = fn(ra, dec, radius)
    except Exception as e:
        raise HTTPException(502, f"catalogue service error: {e}")
    out = {"cat": cat, "epoch": 2016.0 if cat == "gaia" else 2015.4, "sources": rows}
    path.write_text(json.dumps(out))
    return out


app.mount("/", StaticFiles(directory=str(ROOT / "web"), html=True), name="web")
