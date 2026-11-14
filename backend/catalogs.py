"""Name resolution and catalogue overlays (CDS Sesame / SIMBAD, Gaia DR3)."""
from __future__ import annotations

import math
import re
import time

import requests

SESAME = "https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?"
IRSA_TAP = "https://irsa.ipac.caltech.edu/TAP/sync"
GAIA_EPOCH = 2016.0


def year_now() -> float:
    return 1970.0 + time.time() / 31557600.0


def propagate(ra, dec, pmra, pmdec, dt_years):
    """Linear proper-motion propagation. pm in mas/yr (pmra includes cos dec)."""
    dec2 = dec + (pmdec or 0.0) * dt_years / 3.6e6
    ra2 = ra + (pmra or 0.0) * dt_years / 3.6e6 / max(math.cos(math.radians(dec)), 1e-6)
    return ra2 % 360.0, dec2


def _num(xml: str, tag: str):
    m = re.search(rf"<{tag}>\s*([-+0-9.eE]+)", xml)
    return float(m.group(1)) if m else None


def resolve(name: str) -> dict | None:
    """Resolve an object name; returns J2000 position, proper motion and the
    position propagated to today (what a telescope sees now)."""
    r = requests.get(SESAME + requests.utils.quote(name), timeout=20)
    xml = r.text
    ra, dec = _num(xml, "jradeg"), _num(xml, "jdedeg")
    if ra is None or dec is None:
        return None
    pm = re.search(r"<pm>(.*?)</pm>", xml, re.S)
    pmra = _num(pm.group(1), "pmRA") if pm else None
    pmdec = _num(pm.group(1), "pmDE") if pm else None
    plx = re.search(r"<plx>(.*?)</plx>", xml, re.S)
    oname = re.search(r"<oname>(.*?)</oname>", xml)
    otype = re.search(r"<otype>(.*?)</otype>", xml)
    now = year_now()
    ra_now, dec_now = propagate(ra, dec, pmra, pmdec, now - 2000.0)
    return {
        "name": oname.group(1) if oname else name,
        "otype": otype.group(1) if otype else None,
        "ra2000": ra, "dec2000": dec, "pmra": pmra, "pmdec": pmdec,
        "plx": _num(plx.group(1), "v") if plx else None,
        "epoch": round(now, 2), "ra": ra_now, "dec": dec_now,
    }


def _irsa_tap(query: str) -> list[dict]:
    import csv, io
    last = None
    for attempt in range(3):
        try:
            r = requests.get(IRSA_TAP, params={"QUERY": query, "FORMAT": "CSV"}, timeout=40)
            r.raise_for_status()
            return list(csv.DictReader(io.StringIO(r.text)))
        except Exception as e:  # IRSA answers 503 now and then
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def _f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def gaia(ra: float, dec: float, radius_arcmin: float, limit: int = 400) -> list[dict]:
    """Gaia DR3 sources (epoch 2016.0) with proper motions around a position."""
    q = (f"SELECT TOP {int(limit)} source_id, ra, dec, pmra, pmdec, parallax, phot_g_mean_mag "
         f"FROM gaia_dr3_source WHERE CONTAINS(POINT('ICRS',ra,dec),"
         f"CIRCLE('ICRS',{ra:.6f},{dec:.6f},{radius_arcmin / 60.0:.5f}))=1 ORDER BY phot_g_mean_mag")
    return [{"id": d["source_id"], "ra": _f(d["ra"]), "dec": _f(d["dec"]),
             "pmra": _f(d["pmra"]), "pmdec": _f(d["pmdec"]), "plx": _f(d["parallax"]),
             "g": _f(d["phot_g_mean_mag"])} for d in _irsa_tap(q)]


def catwise(ra: float, dec: float, radius_arcmin: float, limit: int = 400) -> list[dict]:
    """CatWISE2020 sources (W1/W2, with proper motions) around a position."""
    q = (f"SELECT TOP {int(limit)} source_name, ra, dec, pmra, pmdec, w1mpro, w2mpro "
         f"FROM catwise_2020 WHERE CONTAINS(POINT('ICRS',ra,dec),"
         f"CIRCLE('ICRS',{ra:.6f},{dec:.6f},{radius_arcmin / 60.0:.5f}))=1 ORDER BY w2mpro")
    return [{"id": d["source_name"], "ra": _f(d["ra"]), "dec": _f(d["dec"]),
             "pmra": None if _f(d["pmra"]) is None else _f(d["pmra"]) * 1000.0,
             "pmdec": None if _f(d["pmdec"]) is None else _f(d["pmdec"]) * 1000.0,
             "w1": _f(d["w1mpro"]), "w2": _f(d["w2mpro"])} for d in _irsa_tap(q)]
