# Chronosphere

**Explore the changing infrared sky.** Fly over the whole sky as NASA's SPHEREx mission sees it, click
anything, and watch that spot change over time. Chronosphere tells you what the object is, plays every SPHEREx
exposure of it like a little video so that motion and brightness changes stand out, builds its 102-band
spectrum on the spot, and checks whether what you see is real.

Live: https://muhammetmucahitsoylu.github.io/chronosphere/ · guided tour: add `?tour`

![Epsilon Indi B in Chronosphere: the sky map, the image sequence, and a spectrum showing water and methane](web/preview.png)

Built during the 2026 NASA Space Apps Challenge (challenge: *Planet X and SPHEREx*) by team The Bright Nobles.

## What you can do

- **Roam the sky.** The map is the SPHEREx all-sky data cube served by NASA/IPAC, shown with Aladin Lite. A
  slider moves through all 102 wavelengths; 2MASS, WISE and visible-light maps are one click away.
- **Click any object, or search by name or coordinates.** The view flies there. The object is identified
  through SIMBAD (type, spectral type, distance, proper motion), with a Wikipedia card when one exists.
  Catalogue coordinates of a nearby star point at where it was in the year 2000: the tool notices, says
  how far the star has moved since, and takes you to where it is now.
- **Watch it over time.** Every SPHEREx exposure covering the spot is read, aligned and played back.
  *Visits* stacks each SPHEREx visit and loops through them, *Time as colour* paints early red and late blue,
  *Difference* subtracts visits, *Wavelengths* steps through the six detectors.
- **Did it move?** For any spot you click, its position is measured in every visit and compared with how
  well ordinary stars in the same images repeat. A catalogued fast mover is also set against its predicted path.
- **Did it change?** Brightness changes between visits are checked against ordinary stars in the same images:
  if they stayed steady and the spot did not, the change is in the sky and not in the camera.
- **What else is going on here?** Every clear star in the field is tested the same way, without using any
  catalogue, and the few that moved or changed are listed and marked. On the test fields this blind check
  finds Barnard's Star (10.5 arcseconds north), Epsilon Indi B (6.1 arcseconds south-east) and the fading of
  RW Aurigae, and nothing else.
- **What is it made of?** Click a star to get its spectrum from 0.75 to 5 microns and a table of the dips
  found where water, methane, carbon monoxide and carbon dioxide absorb.
- **Check it elsewhere.** One click opens the same coordinates in SIMBAD, WiseView (Backyard Worlds), ESASky,
  the Legacy Survey viewer and the VizieR photometry viewer.
- **Take it with you.** Copy a link to the exact view, save the image or a video of the sequence, or download
  every measurement as a CSV file.
- **Take the guided tour.** Ten short steps, in plain language, from "what is SPHEREx" through the five test
  objects of the challenge. It is saved on the device and runs without a connection.

## How the challenge is covered

| Challenge request | In Chronosphere |
|---|---|
| Public web tool | A static site with no server and no login; works on a phone and offline |
| Enter RA and Dec | Decimal degrees, sexagesimal, or an object name; or just click the map |
| Series of images like a little video | Starts playing by itself; pause, step, speed; zoom and pan |
| Easy to spot moving objects | Visit stacks, time-as-colour, difference images; every clear star in the field is checked for motion and flagged; the shift of any clicked spot is measured and judged against ordinary stars; catalogued movers are compared with their prediction |
| Tested on Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis | On the front page and in the guided tour, each with a note on what to look for |
| Easy to update with new data releases | Nothing about releases is hard-coded: a scheduled job rebuilds the sky index from the archive, and each release can be switched on or off in the viewer |
| Use the 102 bands, add detectors, spectra on the fly | Per-detector stacks; the 102-band all-sky map; click-to-spectrum computed in the browser |
| Add or subtract images from different times | Visits, Deep sum and Difference modes |
| Choose the field of view | 3 to 40 arcminutes |
| Overlay other telescopes | Gaia DR3 with proper-motion arrows and WISE sources, for any position; 2MASS, WISE and DSS sky maps |
| Coordinates in the URL | `?ra=269.446&dec=4.771&fov=5&det=5&mode=epochs`; add `&embed=1` for a bare viewer to place in an iframe; `?tour` starts the tour |
| Display metadata | Date, wavelength, detector, release, exposure id, sky level, noise, coverage, PSF width, masked pixels and a link to the source FITS file for every exposure |

## How it works

Chronosphere has **no server**. The site is a set of static files; everything else is the visitor's browser
talking directly to NASA's open data.

1. **Sky index.** `web/index/` is a compact index of every public SPHEREx exposure (about 1.6 million): where
   each one was pointed, when, with which detector, and where its file lives. A scheduled workflow rebuilds it
   from the NASA/IPAC archive, so new data releases appear without touching the code.
2. **Read only what is needed.** For each exposure near the chosen position, the browser reads the FITS header
   and a small block of pixels around the target with HTTP range requests from the public `nasa-irsa-spherex`
   bucket: a few hundred kilobytes instead of a 63 MB file.
3. **Align.** Each block is resampled onto one common north-up grid using the exposure's own astrometry
   (TAN-SIP), and the local sky level is removed.
4. **Wavelength.** SPHEREx has no filter wheel. A linear variable filter means every pixel of every exposure
   sees a slightly different wavelength; the per-pixel wavelength is read from the `WCS-WAVE` table in each
   file. That is why stepping through time also builds a spectrum.
5. **Compute on the device.** Stretching, stacking, differencing, colour compositing, photometry, spectra, band
   depths, brightness curves and the checks against comparison stars are all computed in the browser.
6. **Identify with today's positions.** Catalogues store where a star was in the year 2000. Nearby stars have
   moved since (Barnard's Star by about 280 arcseconds), so a plain coordinate search misses them. Chronosphere
   also fetches fast movers in a wider area and moves every candidate to today's date before matching.
7. **Offline.** A service worker keeps the page, the five showcase objects, the sky-map tiles of the guided
   tour, every other tile already seen and every position already opened on the device. Each release of the
   site is stored as one set, so a poor connection can never mix new files with old ones.

## How the numbers were checked

- **The browser reader** (`web/js/archive.js`) against an independent Python implementation built on Astropy
  (`backend/spherex.py`): same pixel positions, wavelengths and sky levels, and images that agree to a small
  fraction of the noise.
- **Motion.** Every moving target is measured independently in each detector that sees it. Barnard's Star:
  10.4 arcseconds per year in two detectors, catalogue 10.4. Epsilon Indi B: 4.6 in all six detectors,
  catalogue 4.7. WISE 0855, faint and with only half a year between its two detections: 7.0, catalogue 8.2.
  Ordinary stars in the same images stay put to within 0.3 arcseconds.
- **Parallax.** Predictions include the yearly wobble of nearby stars; the formula agrees with Astropy to
  0.004 arcseconds. With it, Epsilon Indi B lands within 0.1 to 0.3 arcseconds of its prediction in every
  visit, and Barnard's half-arcsecond east-west swing shows up in the data.
- **Brightness.** Ordinary stars in the same images repeat to 1 or 2 per cent from visit to visit. Against
  that, RW Aurigae brightened by more than 40 per cent below 1.6 microns and faded by almost half beyond
  3.8 microns within a year.
- **Flux scale.** Aperture fluxes of ordinary stars come out 10 to 15 per cent below their 2MASS values,
  as expected for a 9-arcsecond aperture without aperture correction.
- **Saturated stars.** The halo of an overloaded star does not scale simply with its brightness, so halo
  measurements are joined to the neighbouring detector rather than converted with a fixed factor. For
  Barnard's Star the joined spectrum lands within 15 per cent of 2MASS at H and K, and 40 per cent low at J.
- **Beyond the test objects.** Read live from the archive, with no preparation: Teegarden's Star and
  Luhman 16 are measured moving at 5.3 and 2.8 arcseconds per year, against catalogue values of 5.1 and 2.8.
  The blind field check finds Luhman 16 from raw coordinates, and rejects a close pair of stars in the same
  field that a naive position comparison would report as moving.
- **Sky-map tiles.** The HEALPix code (`web/js/healpix.js`) agrees with `astropy-healpix`, and predicts
  exactly the tiles the map requests.
- **Catalogue facts** shown for the five test objects are curated with their sources: Gaia DR3 parallaxes
  and proper motions, and Kirkpatrick et al. 2021 for WISE 0855. A distance is only shown when the parallax
  is measured to better than 20 per cent.

## Run it

Any static file server will do:

```
cd web
python -m http.server 8000
```

Open http://localhost:8000.

### Maintenance scripts (Python)

```
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Windows; use .venv/bin/pip elsewhere
.venv/Scripts/python scripts/build_index.py          # rebuild the sky index from the archive
.venv/Scripts/python scripts/prebuild.py             # rebuild the five showcase objects
.venv/Scripts/python scripts/prebuild.py --meta      # refresh only their descriptions and catalogue facts
```

The `backend/` folder also contains an optional FastAPI service with the same pipeline in Python
(`python -m uvicorn server:app --app-dir backend`); the site does not need it.

## Layout

```
web/js/archive.js     sky index lookup, FITS range reader, TAN-SIP astrometry, resampling, wavelength
web/js/app.js         viewer, plots, search, checks against comparison stars, tour wiring, offline store
web/js/core.js        decoding, sky geometry, stacking, photometry, band depths, joining saturated detectors
web/js/sky.js         the explorable sky map (Aladin Lite + IRSA sky maps)
web/js/healpix.js     which sky-map tiles a view needs (HEALPix)
web/js/info.js        identification (SIMBAD), Wikipedia card, links to other tools
web/js/tour.js        guided tour text
web/js/pages.js       the "What is SPHEREx?", "How it works" and "About" pages
web/sw.js             service worker: offline cache
web/index/            the sky index (generated)
web/data/             the five showcase objects (generated)
web/vendor/aladin.js  Aladin Lite 3.8.2 (CDS, LGPL-3.0-or-later), unmodified
web/fonts/            IBM Plex and Instrument Serif (SIL Open Font License)
scripts/              build_index.py, prebuild.py
backend/              Python reference pipeline and optional API
```

No build step: plain HTML, CSS and JavaScript modules.

## Honest limits

- A SPHEREx pixel is 6.15 arcseconds. Even Barnard's Star moves only about 1.7 pixels per year, so motion shows
  up as a small shift between visits, not a streak. Positions repeat to a few tenths of an arcsecond, so
  anything slower than roughly one to two arcseconds per year cannot be seen yet.
- Each exposure is at a different wavelength, so single exposures of the same star differ in brightness for a
  physical reason. The brightness-over-time plot divides each measurement by the star's own average spectrum at
  that wavelength to separate real variability from colour.
- Photometry is a simple 9-arcsecond aperture without aperture correction, meant for exploring, not for
  publication. It reads roughly 10 to 15 per cent low.
- Very bright stars saturate the detectors. They are measured from their outer halo and each detector is
  joined to its neighbour: the overall shape of the spectrum is right, the level and the fine detail are
  approximate. If every detector is saturated only relative brightness is shown.
- Next to a very bright star, faint neighbours sit in its glow, so they cannot serve as comparison stars;
  the tool says so instead of comparing.
- A dip at a molecule's wavelength is a hint, not a detection: other molecules and the shape of the spectrum
  itself can produce one.
- A star close to saturating the camera is located less faithfully: Barnard's Star is 1.7 arcseconds off its
  prediction in its first visit in one detector, while its other visits agree to 0.2 to 0.4.
- The all-sky map is coarser (about 13 arcseconds per pixel) than the images loaded for a selected spot.
- Away from the five test objects, the number of exposures is an estimate until they have been read, and the
  WISE overlay is CatWISE2020 when the CDS catalogue service answers and AllWISE otherwise.
- Nothing here claims a discovery. The tool is meant to help more people look.

## Data and credits

- SPHEREx images and all-sky cube: NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA)
  and the `nasa-irsa-spherex` open data bucket on AWS.
- 2MASS, AllWISE and DSS sky maps: HiPS built by CDS, served by IRSA.
- Gaia DR3: ESA/Gaia/DPAC. CatWISE2020: Marocco et al. 2021. AllWISE: Cutri et al. 2013. Queried through IRSA
  for the test objects and through VizieR (CDS and its mirror at Harvard) everywhere else.
- Object identification and name resolution: SIMBAD and Sesame, CDS, Strasbourg, and their mirrors at the
  Center for Astrophysics, Harvard & Smithsonian.
- Sky atlas component: Aladin Lite, CDS (LGPL-3.0-or-later).
- Encyclopedia text and thumbnails: Wikipedia (CC BY-SA), shown with a link to the article.
- Software: Astropy, NumPy, SciPy, PyVO, FastAPI.

## Use of AI

This project was written with an AI coding assistant (Claude, Anthropic) during the hackathon: the data
pipeline and the web page. The team chose the approach, checked the results against catalogue values and
independent tools, and is responsible for the content. No AI-generated images, audio or video are used; every
image shown is telescope data.
