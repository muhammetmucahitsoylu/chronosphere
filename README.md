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
  slider moves through all 102 wavelengths; 2MASS, WISE and visible-light maps are one click away. A new
  colour, a new place or a new zoom dissolves in as a whole: the map never flashes or shows half-loaded sky.
  The sky is on screen in under half a second, also on a first visit: a still picture of the opening view
  comes with the site, and the live map dissolves in over it.
- **Click any object, or search by name or coordinates.** The map dives there. The object is identified
  through SIMBAD (type, spectral type, distance, proper motion), with a Wikipedia card when one exists. A
  click picks the brightest catalogued object within a few screen pixels, so the star you aimed at is the one
  that opens, even in the most crowded parts of the Milky Way; a click anywhere on the glare of a bright star
  opens that star, not a faint one drowned in it. The map then shows the object from close by (a view 37
  arcminutes wide around the 5-arcminute field of the images), and stays closer if you had zoomed in further.
  Catalogue coordinates of a nearby star point at where it was in the year 2000: the tool notices, says
  how far the star has moved since, and takes you to where it is now.
- **Get the answer first.** The panel opens with *What the measurements say*: a few plain sentences on
  whether the spot moved, whether its brightness changed and which molecule bands show, written from the
  same numbers as the detailed sections below them. Only what is beyond doubt is stated plainly.
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
  objects of the challenge. One step shows two real SPHEREx pictures of the same patch of sky, a year apart,
  flipping the way Clyde Tombaugh flipped his photographs: one dot moves. At the first object, numbered
  pointers lead from the tour's card to the parts of the panel: the images, what the measurements say, the
  spectrum, the links to other tools. The tour is saved on the device and runs without a connection; the
  four further objects its last step offers are read live from the archive, and one press keeps those too.
- **Learn the panel.** "How to read this panel", on every object, walks through its nine parts one at a time:
  the part is lit, the rest dimmed, and a card says what it shows and what can be done with it.
- **In five languages.** The front page, the guided tour, the walk through the panel and the notes on the map
  are in English, Turkish, German, French and Polish (the picker is in the top bar; `?lang=tr` in an address
  does the same). The measurement panel itself is English. All the words live in one file, `web/js/lang.js`:
  adding a language is adding one block. The German, French and Polish texts have not yet been read by a
  native speaker.

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
   each one was pointed, when, with which detector, and where its file lives. A weekly workflow asks the
   NASA/IPAC archive how many exposures each release holds and downloads only releases that are new or have
   grown, so new data appears without touching the code. If the archive is unreachable or the numbers do not
   add up, nothing is written.
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
   site is stored as one set, so a poor connection can never mix new files with old ones. A moving star's
   place "today" is worked out for the middle of the current month, so that what is kept for a position is
   found again all month (the price: under half an arcsecond for the fastest star in the sky).
8. **No flashes.** The map library repaints from nothing when its picture changes: a new colour of the cube
   is blank white until its tiles arrive, and a new place starts as empty sky. So every such change is made
   behind a still copy of the map (`web/js/sky.js`). The copy starts moving with the click, towards the
   destination; the site follows each of the library's tile requests, and the copy dissolves into the new
   picture when that picture is complete. Tiles are fetched ahead of the change, so a slow connection delays
   the change instead of showing it half done.
9. **A sky at once, and no holes.** The archive needs several seconds to deliver the first view: one to
   three dozen tiles of about 200 kB each. A still picture of exactly that view (`web/opening.jpg`, a copy
   of the map's own canvas, made by pointing the map at a square that holds the opening view of a screen of
   any shape) is shown at once and is clickable; the live map replaces it when complete. The archive also
   breaks off tile downloads that have queued for about ten seconds, and the map library does not ask
   again. The site reads every tile to its end to notice this, fetches a broken one once more, and then,
   still behind the still picture and only once the library has no request of its own under way, starts the
   layer afresh: the library finds every tile in the browser's store, and no hole stays.

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
- **Sky-map tiles.** The HEALPix code (`web/js/healpix.js`) agrees with `astropy-healpix`, and the tiles it
  predicts for a view include the ones the map goes on to request.
- **Map transitions.** The guided tour was filmed frame by frame (about 3,800 frames for the ten steps) and
  every frame measured: none is blown out to white or washed out, where each change of colour used to flash
  white. A probe inside the page then watched some 35,000 frames while the tour was stepped through at
  awkward moments (forwards and back in the middle of a change of colour or of place): the blank map was
  never in view. Moving to an object takes about one second.
- **First visit.** With nothing stored, on eight screen shapes from a small phone to an ultra-wide monitor:
  the still picture is up 0.4 s after the page starts to load and lies within one pixel of the live map
  that replaces it 4 to 14 s later, at the same brightness. Before, the map stayed dark for that time. A
  visitor who does not wait (clicks a star, starts the tour, drags, zooms, or arrives by a link to an
  object) never sees the blank map either. Tile downloads were then made to fail the way the archive
  fails them (refused at once, or broken off part-way, early or late, with the other tiles fast or slow):
  in 21 runs the live map matched the still picture each time. Without the repair the holes stay; an
  earlier form of the repair, which did not wait for the library to be idle, left the map scrambled in one
  run of four.
- **Clicks.** Ten well-known stars were clicked dead on and a few arcseconds off, at the tolerance of a wide
  map and of a close view, in empty and in crowded fields: 40 of 40 clicks opened the star that was clicked.
  The earlier catalogue query, which did not ask for the nearest objects first, managed 32.
  On a wide map a pixel is 20 to 25 arcseconds, so a click three or four pixels off a bright star is a minute
  or more of arc away from it. A bright star's reach therefore grows with its brightness: such clicks open
  the star in 30 of 30 tries on ten bright stars, Eta Carinae inside its cluster among them (18 of 30
  before).
  In the SPHEREx pictures a bright star is a disc of glare, about an arcminute across for Antares: at any
  zoom, a click inside it opens the star (6 of 6 at 30 arcseconds from the centre), a click 110 arcseconds
  away does not (12 of 12), and typed coordinates inside the glare are never renamed to the star (6 of 6).
  The catalogue is asked for the bright objects within reach without sorting them: sorted, the same question
  takes it a quarter of a minute in a crowded field.
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
.venv/Scripts/python scripts/build_index.py          # bring the sky index up to date (downloads only what is new)
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
web/js/tour.js        guided tour: the steps and what the map does at each
web/js/lang.js        the words of the front page, the tour and the walk through the panel, in five languages
web/js/pages.js       the "What is SPHEREx?", "How it works" and "About" pages
web/sw.js             service worker: offline cache
web/index/            the sky index (generated)
web/data/             the five showcase objects (generated)
web/vendor/aladin.js  Aladin Lite 3.8.2 (CDS, GPL-3.0), unmodified
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
- Sky atlas component: Aladin Lite, CDS (GPL-3.0).
- Encyclopedia text and thumbnails: Wikipedia (CC BY-SA), shown with a link to the article.
- Software: Astropy, NumPy, SciPy, PyVO, FastAPI.

## Licence

Chronosphere's own code (everything in this repository except `web/vendor/` and `web/fonts/`) is free software
under the GNU General Public License, version 3: see [LICENSE](LICENSE). Copyright (C) 2026 The Bright Nobles.

It is distributed together with Aladin Lite (CDS, GPL-3.0) and the IBM Plex and Instrument Serif fonts (SIL
Open Font License). The data it shows are not covered by this licence: SPHEREx images are public NASA data
served by NASA/IPAC (IRSA), and catalogues, encyclopedia text and the encyclopedia pictures kept in `web/data/`
belong to the sources named above, under their own terms.

## Use of AI

This project was written with an AI coding assistant (Claude, Anthropic) during the hackathon: the data
pipeline and the web page. The team chose the approach, checked the results against catalogue values and
independent tools, and is responsible for the content. No AI-generated images, audio or video are used; every
image shown is telescope data.
