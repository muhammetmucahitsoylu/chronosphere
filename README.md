# Blink102

**Explore the changing infrared sky.** Fly over the whole sky as NASA's SPHEREx mission sees it, click
anything, and watch that spot change over time. Blink102 tells you what the object is, plays every SPHEREx
exposure of it like a little video so that motion and brightness changes stand out, and builds its 102-band
spectrum on the spot.

Built during the 2026 NASA Space Apps Challenge (challenge: *Planet X and SPHEREx*) by team The Bright Nobles.

## What you can do

- **Roam the sky.** The map is the SPHEREx all-sky data cube served by NASA/IPAC, shown with Aladin Lite. A
  slider moves through all 102 wavelengths; 2MASS, WISE and visible-light maps are one click away.
- **Click any object, or search by name or coordinates.** The view flies there. The object is identified
  through SIMBAD (type, spectral type, distance, brightness, proper motion), with a Wikipedia card when one
  exists.
- **Watch it over time.** Every SPHEREx exposure covering the spot is fetched, aligned and played back.
  *Seasons* stacks each observing season and blinks between them, *Time as colour* paints early red and late
  blue, *Difference* subtracts seasons, *Wavelengths* blinks through the six detectors.
- **Measure it.** Click a star in the images to get its spectrum from 0.75 to 5 microns, its brightness over
  time, and a table of the dips found at the wavelengths where water, methane, carbon monoxide and carbon
  dioxide absorb.
- **Check it elsewhere.** One click opens the same coordinates in SIMBAD, WiseView (Backyard Worlds), ESASky,
  Aladin Lite, the Legacy Survey viewer and the VizieR photometry viewer.
- **Take the guided tour.** Ten short steps, in plain language, from "what is SPHEREx" through the five test
  objects of the challenge.

## How the challenge is covered

| Challenge request | In Blink102 |
|---|---|
| Public web tool | Static page plus a small API; no login, works on a phone |
| Enter RA and Dec | Decimal degrees, sexagesimal, or an object name; or just click the map |
| Series of images like a little video | Play, pause, step, speed; zoom and pan |
| Easy to spot moving objects | Season stacks, time-as-colour, difference images; the measured shift is compared with the catalogue prediction, season by season |
| Tested on Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis | In the Examples menu and the guided tour, each with a note on what to look for |
| Easy to update with new data releases | Nothing about releases is hard-coded: the archive is asked which collections exist when a spot is opened, and each can be switched on or off |
| Use the 102 bands, add detectors, spectra on the fly | Per-detector stacks; the 102-band all-sky map; click-to-spectrum computed in the browser |
| Add or subtract images from different times | Seasons, Deep sum and Difference modes |
| Choose the field of view | 3 to 40 arcminutes |
| Overlay other telescopes | Gaia DR3 with proper-motion arrows, CatWISE2020; 2MASS, WISE and DSS sky maps |
| Coordinates in the URL | `?ra=269.446&dec=4.771&fov=5&det=5&mode=epochs`; add `&embed=1` for a bare viewer to place in an iframe; `?tour` starts the tour |
| Display metadata | Date, wavelength, detector, release, exposure id, sky level, noise, coverage, PSF width, masked pixels and a link to the source FITS file for every exposure |

## How it works

1. **Find exposures.** The IRSA SIA2 service lists every SPHEREx level-2 exposure covering the position, across
   all public releases.
2. **Read only what is needed.** For each exposure the server reads the FITS header and a small block of pixels
   around the target with HTTP range requests from the public NASA/IRSA bucket on AWS: a few hundred kilobytes
   instead of a 60 MB file.
3. **Align.** Each block is resampled onto one common north-up grid using the exposure's own astrometry
   (TAN-SIP), and the local sky level is removed.
4. **Wavelength.** SPHEREx has no filter wheel. A linear variable filter means every pixel of every exposure
   sees a slightly different wavelength; the per-pixel wavelength is read from the `WCS-WAVE` table in each
   file. That is why stepping through time also builds a spectrum.
5. **The rest happens in the browser.** Aligned frames are streamed as raw numbers. Stretching, stacking,
   differencing, colour compositing, photometry, spectra, band depths and brightness curves are computed on the
   user's device, so every interaction is instant.
6. **Identify with today's positions.** Catalogues store where a star was in the year 2000. Nearby stars have
   moved since (Barnard's Star by 270 arcseconds), so a plain coordinate search misses them. Blink102 also
   fetches fast movers in a wider area and moves every candidate to today's date before matching.

The five test objects are pre-built into static files (`web/data/`) so they open instantly and keep working
even if the archive is slow. Every other position goes through the live API.

## Run it

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows; use .venv/bin/pip elsewhere
.venv/Scripts/python -m uvicorn server:app --app-dir backend --port 8000
```

Open http://localhost:8000. To rebuild the five showcase objects with the newest data:

```
.venv/Scripts/python scripts/prebuild.py
```

A `Dockerfile` is included for hosting the API and the page as one service. The page alone (`web/`) can be
served from any static host; set `window.BLINK_API` in `web/config.js` to the address of the API.

## Layout

```
backend/spherex.py    archive search, range-request reader, alignment, wavelength
backend/pipeline.py   stream format shared by the live API and the pre-built objects
backend/catalogs.py   name resolution, Gaia DR3 and CatWISE2020 overlays
backend/server.py     FastAPI app
scripts/prebuild.py   builds the five showcase objects
web/js/app.js         viewer, plots, search, tour wiring
web/js/core.js        decoding, sky geometry, stacking, photometry, band depths
web/js/sky.js         the explorable sky map (Aladin Lite + IRSA sky maps)
web/js/info.js        identification (SIMBAD), Wikipedia card, links to other tools
web/js/tour.js        guided tour text
web/vendor/aladin.js  Aladin Lite 3.8.2 (CDS, LGPL-3.0-or-later), unmodified
```

No build step: plain HTML, CSS and JavaScript modules.

## Honest limits

- A SPHEREx pixel is 6.15 arcseconds. Even Barnard's Star moves only about 1.7 pixels per year, so motion shows
  up as a small shift between seasons, not a streak. That is why the tool stacks seasons and measures centroids.
- Each exposure is at a different wavelength, so single exposures of the same star differ in brightness for a
  physical reason. The brightness-over-time plot divides each measurement by the star's own average spectrum at
  that wavelength to separate real variability from colour.
- Photometry is a simple 9-arcsecond aperture without aperture correction, meant for exploring, not for
  publication. Very bright stars saturate the detectors; for those the tool measures the outer halo instead,
  which gives relative brightness only.
- A dip at a molecule's wavelength is a hint, not a detection: other molecules and the shape of the spectrum
  itself can produce one.
- Predicted positions use catalogue proper motion only (no parallax).
- The all-sky map is coarser (about 13 arcseconds per pixel) than the images loaded for a selected spot.
- Nothing here claims a discovery. The tool is meant to help more people look.

## Data and credits

- SPHEREx images and all-sky cube: NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA)
  and the `nasa-irsa-spherex` open data bucket on AWS.
- 2MASS, AllWISE and DSS sky maps: HiPS built by CDS, served by IRSA.
- Gaia DR3: ESA/Gaia/DPAC. CatWISE2020: Marocco et al. 2021. Both queried through IRSA.
- Object identification and name resolution: SIMBAD and Sesame, CDS, Strasbourg.
- Sky atlas component: Aladin Lite, CDS (LGPL-3.0-or-later).
- Encyclopedia text and thumbnails: Wikipedia (CC BY-SA), shown with a link to the article.
- Software: Astropy, NumPy, SciPy, PyVO, FastAPI.

## Use of AI

This project was written with an AI coding assistant (Claude, Anthropic) during the hackathon: the data
pipeline, the server and the web page. The team chose the approach, checked the results against catalogue
values and independent tools, and is responsible for the content. No AI-generated images, audio or video are
used; every image shown is telescope data.
