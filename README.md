# Blink102

**Watch the infrared sky change.** Enter any sky position and Blink102 shows the NASA SPHEREx images of that
patch as a little video, so that anything that moves or changes brightness stands out. Click any star and its
102-band spectrum is built on the spot.

Built during the 2026 NASA Space Apps Challenge (challenge: *Planet X and SPHEREx*) by team The Bright Nobles.

## What it does

| Challenge request | In Blink102 |
|---|---|
| Public web tool | A static web page plus a small API; no login, works on a phone |
| Enter RA and Dec | Decimal degrees, sexagesimal, or an object name (resolved through SIMBAD and moved to today's position using its proper motion) |
| Series of images like a little video | Play, pause, step, speed; zoom and pan |
| Easy to spot moving objects | *Seasons* mode stacks each observing season and blinks between them; *Time as colour* paints the first season red and the last blue; *Difference* subtracts seasons; the measured shift is compared with the catalogue prediction in a table |
| Test on the five named targets | One-click buttons for Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis |
| Easy to update with new releases | Nothing about releases is hard-coded: the archive is asked which collections exist at load time, and each can be switched on or off |
| Use the 102 bands / add detectors / spectra on the fly | Per-detector stacks (D1 to D6); click any spot to get its spectrum, computed in the browser from the exposures already loaded |
| Add or subtract images from different times | *Seasons*, *Deep sum* and *Difference* modes |
| Choose the field of view | 3 to 40 arcminutes |
| Overlay other telescopes | Gaia DR3 (with proper-motion arrows) and CatWISE2020 |
| Coordinates in the URL | `?ra=269.446&dec=4.771&fov=5&det=5&mode=epochs`; add `&embed=1` for a bare viewer to put in an iframe |
| Display metadata | Date, wavelength, detector, release, exposure id, sky level, noise, coverage, PSF width and a link to the source FITS file for every exposure |

## How it works

1. **Find exposures.** The IRSA SIA2 service lists every SPHEREx level-2 exposure covering the position, across
   all public releases.
2. **Read only what is needed.** For each exposure the server reads the FITS header and a small block of pixels
   around the target with HTTP range requests from the public NASA/IRSA bucket on AWS (a few hundred kilobytes
   instead of a 60 MB file).
3. **Align.** Each block is resampled onto one common north-up grid using the exposure's own astrometry
   (TAN-SIP), and the local sky level is removed.
4. **Wavelength.** SPHEREx has no filter wheel: a linear variable filter means every pixel of every exposure
   sees a slightly different wavelength. The per-pixel wavelength is read from the `WCS-WAVE` table shipped in
   each file.
5. **Everything else happens in the browser.** Aligned frames are streamed as raw numbers. Stretching,
   stacking, differencing, colour compositing, aperture photometry, spectra and brightness curves are computed
   on the user's device, so every interaction is instant.

The five test targets are pre-built into static files (`web/data/`) so they open instantly and keep working
even if the archive is slow. Every other position goes through the live API.

## Run it

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows; use .venv/bin/pip elsewhere
.venv/Scripts/python -m uvicorn server:app --app-dir backend --port 8000
```

Open http://localhost:8000. To refresh the five showcase targets with the newest data:

```
.venv/Scripts/python scripts/prebuild.py
```

A `Dockerfile` is included for hosting the API and the page as one service.

## Layout

```
backend/spherex.py    archive search, range-request reader, alignment, wavelength
backend/pipeline.py   stream format shared by the live API and the pre-built targets
backend/catalogs.py   name resolution (SIMBAD), Gaia DR3 and CatWISE2020 overlays
backend/server.py     FastAPI app
scripts/prebuild.py   builds the five showcase targets
web/                  the page (plain HTML, CSS and JavaScript modules, no build step)
```

## Honest limits

- A SPHEREx pixel is 6.15 arcseconds. Even Barnard's Star moves only about 1.7 pixels per year, so motion shows
  up as a small shift between seasons, not a streak. That is why the tool stacks seasons and measures centroids.
- Because each exposure is at a different wavelength, single exposures of the same star differ in brightness
  for a physical reason. The brightness-over-time plot divides each measurement by the star's own average
  spectrum at that wavelength to separate real variability from colour.
- Photometry is a simple 9-arcsecond aperture without aperture correction, intended for exploring, not for
  publication. Very bright stars saturate the detectors and are masked at their core.
- The predicted positions use catalogue proper motion only (no parallax).
- Nothing here claims a discovery. The tool is meant to help people look.

## Data and credits

- SPHEREx images: NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA) and the
  `nasa-irsa-spherex` open data bucket on AWS.
- Gaia DR3: ESA/Gaia/DPAC. CatWISE2020: Marocco et al. 2021. Both queried through IRSA.
- Name resolution: SIMBAD / Sesame, CDS, Strasbourg.
- Software: Astropy, NumPy, SciPy, PyVO, FastAPI.

## Use of AI

This project was written with an AI coding assistant (Claude, Anthropic) during the hackathon: the data
pipeline, the server and the web page. The team chose the approach, checked the results against the archive's
own tools and against catalogue values, and is responsible for the content. No AI-generated images, audio or
video are used; every image shown is NASA SPHEREx data.
