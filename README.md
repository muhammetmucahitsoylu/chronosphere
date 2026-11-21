# Chronosphere

**Explore the changing infrared sky.** Fly over the whole sky as NASA's SPHEREx mission sees it, click
anything, and watch that spot change over time. Chronosphere tells you what the object is, plays every SPHEREx
exposure of it like a little video so that motion and brightness changes stand out, builds its 102-band
spectrum on the spot, and checks whether what you see is real. The *Years* view adds a quarter of a century:
the same spot in 2MASS (about 2000), WISE and NEOWISE (2010 to 2024) and SPHEREx images, with a star's motion
measured from them (Barnard's Star: 10.42 arcseconds a year, catalogue 10.39) and, in the test fields, what moves
found without being told where to look (WISE 0855, the coldest known brown dwarf, absent from 2MASS).

Live: https://chronospherex.com/ · guided tour: add `?tour` · an asteroid hunt: add `?hunt`

Seven slides about it: https://chronospherex.com/chronosphere-slides.pdf

![Barnard's Star from 2000 to 2026 in the Years view: 2MASS, WISE and NEOWISE, SPHEREx; the ring is where the catalogue puts the star on each date](web/img/barnard-years.webp)

![Epsilon Indi B in Chronosphere: the sky map, the image sequence, and a spectrum showing water and methane](web/preview.png)

Built during the 2026 NASA Space Apps Challenge (challenge: *Planet X and SPHEREx*) by team The Bright Nobles.

## What you can do

- **See it move before you press anything.** The front page says that the sky is not still, and shows it:
  beside the title Barnard's Star walks across a patch of sky in sixteen real images, from 2MASS in May 2000
  through WISE and NEOWISE to SPHEREx in August 2026, the ring on it and the stars standing still. A press opens
  it in the *Years* view (below). People who asked their device for less motion get one still picture, with the
  path drawn in. A link to the site shows the same walk as its preview: the oldest image beside the newest.
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
  The story comes first: under the name stand one sentence on what the object is, what to look for, and the
  pictures. Where it is, how far, how many exposures there are and the links to other observatories' tools
  are folded under the name (*Key facts and links*), one press away. If the spot you ringed is where an
  asteroid stood at one stop of the telescope, the first line says so (*The light in the ring: (110) Lydia,
  which passed through this very spot on …*), and a press follows the asteroid. While a field read live is
  still being searched for passing bodies, which takes minutes when it is wide, the panel says that it is
  still looking, and then what came of it.
- **Watch it over time.** Every SPHEREx exposure covering the spot is read, aligned and played back.
  *Visits* stacks each SPHEREx visit and loops through them, *Time as colour* paints early red and late blue,
  *Difference* subtracts visits, *Wavelengths* steps through the six detectors.
- **A quarter of a century in one view.** *Years: 2MASS, WISE, SPHEREx*, first among the views, plays the same
  patch of sky as three telescopes saw it: 2MASS on the night it looked (between 1997 and 2001), WISE in 2010
  and NEOWISE every half year from 2014 to 2024, then each SPHEREx visit, every telescope in its band nearest to
  the detector in use. For the five test objects the images were built from the telescopes' own exposures, on
  one grid and in one unit, every WISE visit stacked. Barnard's Star walks 4.6 arcminutes north across a field
  of 10 arcminutes; WISE 0855 is missing from 2MASS, too faint at 2.2 microns, and walks west through WISE and
  SPHEREx: this is how a cold, nearby world gives itself away, and how WISE 0855 was found. Under the images the
  page measures the motion from the images themselves and sets it against the catalogue (SIMBAD): 10.42
  arcseconds a year for Barnard's Star (catalogue: 10.39), 4.71 for Epsilon Indi B (4.68), 8.19 for WISE 0855 (8.15). For any
  other place the page reads the 2MASS and AllWISE sky maps (HiPS) at NASA/IPAC in the browser and lays them on
  the grid of the SPHEREx images, dated by the night 2MASS looked (from the 2MASS catalogue) and by the middle of
  2010, and measures a catalogued star on them the same way: typed into the search box, Proxima Centauri comes
  out at 3.80 arcseconds a year (catalogue: 3.86), Wolf 359 at 4.68 (4.72), Luhman 16 at 2.76 (2.79),
  Teegarden's Star at 5.13 (5.12). Their brightness is not measured on these pictures, which carry their
  makers' stretch. When a fast star stood outside the field on that night (Kapteyn's Star, 3.9 arcminutes away
  in October 1999), the page says so and offers a wider field: at 10 arcminutes it measures 8.71 (8.64). For a star that changes, the box
  also draws its brightness at each visit of WISE and NEOWISE, measured in these images (the light of a ring
  around its saturated core) and given by WISE's own catalogue, and only when the two agree: RW Aurigae grew
  brighter at 4.6 microns from 2014 to the end of 2017, to 2.3 times its usual brightness in the images (4.2 by
  the catalogue), and was back below it by 2021. And without being told where to look, the page searches the
  WISE and NEOWISE visits of the field for anything that moves in a straight line: in WISE 0855's field it finds
  WISE 0855 (8.10 arcseconds a year, in all 23 visits), in Epsilon Indi B's the pair (4.69), and in the five
  fields nothing else. Under "What to look for", each of the five test objects has one button to its Years view.
  The three stars that the guided tour's last step offers, Proxima Centauri, Luhman 16 and Teegarden's Star, have
  their WISE and NEOWISE images built as well and get them when opened by name: Luhman 16, the nearest pair of
  brown dwarfs, found in 2013 by its motion in WISE's images, is found again here without being told where to
  look (2.95 arcseconds a year in 25 of 25 visits; its motion measured over 30 images, 2.79, as the catalogue).
- **Did it move?** For any spot you click, its position is measured in every visit and compared with how
  well ordinary stars in the same images repeat. A catalogued fast mover is also set against its predicted path.
- **Did it change?** Brightness changes between visits are checked against ordinary stars in the same images:
  if they stayed steady and the spot did not, the change is in the sky and not in the camera.
- **What else is going on here?** Every clear star in the field is tested the same way, without using any
  catalogue, and the few that moved or changed are listed and marked. On the test fields this blind check
  finds Barnard's Star (10.5 arcseconds north), Epsilon Indi B (6.1 arcseconds south-east) and the fading of
  RW Aurigae, and nothing else.
- **What passed through?** Every exposure of the field is also searched for bodies of the solar system: dots
  that are at one place for a few minutes, in several exposures, and gone from there on other days. SPHEREx
  stops, takes up to four exposures two minutes apart, and looks at each place with two of its detectors at
  once, so a real body is in several independent images where a cosmic-ray hit is in one. Each body found is
  named through SkyBoT (IMCCE, Paris Observatory) and can be followed from stop to stop: the ring goes with
  it, the images show it moving against the stars, and its own spectrum is built. In the field that Pluto
  crossed in October 2025 the search finds Pluto and two main-belt asteroids, (6747) Ozegahara and
  (1218) Aster.
- **Find an asteroid.** Three ways. *Find an asteroid*, on the front page, takes one of the first three
  thousand numbered asteroids at random, finds a patch of sky it crossed while SPHEREx was looking (its orbit
  from Miriade, IMCCE; the exposures from the sky index) and opens it without telling the search which
  asteroid it is or where it was. About three hundred exposures are read, the panel says what is being done
  and then what was found, and the find is shown at once, moving from stop to stop. Or type a body's name or
  number into the search box (Ceres, 433 Eros, Uranus, 2P/Encke; also Plüton, Urano, Cérès): the days on which
  SPHEREx had it in view are listed, and the patch of sky it crossed opens with the ring on it. Typed
  *Uranus*, the page opens the planet's field of February 2026, and its search finds, unasked, the moons
  Titania and Oberon circling it. Or open any place: its exposures are searched all the same.
- **And when one is found?** A catalogued body is nothing to report; what is new is what SPHEREx measured of
  it, and that can be saved: its spectrum as a table, and its measured places as a report in the Minor Planet
  Center's ADES format, with SPHEREx's observatory code (288) and, for every exposure, where the spacecraft
  was, read from the exposure's own header. A dot that SkyBoT cannot name gets three steps instead: look at
  it in the single exposures, ask the Minor Planet Center's own MPChecker (one link, with the place and the
  moment filled in), and only then the report file. The page *Asteroid hunt*, in six languages, says how to
  find one, what is to be had, and where and how a find is reported; it says first that a discovery is not
  to be expected, because bodies as bright as SPHEREx can see were catalogued long ago.
- **Is it real, or the camera?** Every exposure carries the processing pipeline's own flags for each pixel:
  cosmic-ray hits, overloaded pixels, left-over charge, reflections of bright stars, and more. In the
  *Exposures* view, "This image" reads them on request (a few hundred kilobytes), says which are set at the
  circled spot, lists those present in the field with the share of its pixels, and draws the pixels of the one
  you press on the image. The names and their meaning are read from the file itself, so a flag added by a
  later data release appears without a change to the site.
- **What is it made of?** Click a star to get its spectrum from 0.75 to 5 microns and a table of the dips
  found where water, methane, carbon monoxide and carbon dioxide absorb. A body of the solar system shines
  by reflected sunlight: its measurements are divided by the Sun's spectrum and checked for the bands of
  methane ice instead. Pluto shows them: 40 per cent at 1.3 to 1.4 microns, 47 at 2.2 to 2.4, 57 at 3.2 to 3.6.
- **Follow a comet from another star.** *3I/ATLAS*, first in the front page's line of objects (or typed into
  the search box as 3I/ATLAS, 3I or C/2025 N1), is the third body known to pass through the solar system from
  outside. It crossed a field of ten arcminutes within hours, so here every exposure that had it in view is
  cut out around the comet itself: 160 exposures of 1 to 15 August 2025, on its way in, and 104 of 8 to 15
  December 2025, six weeks after it had passed the Sun. The comet stays in the middle and the stars behind it
  change. Its two visits are shown on one scale of brightness (a faint dot in August; in December 21 times
  as bright in D2, with a tail), its spectrum in powers of ten, and a table says which gases glow around it,
  visit by visit: carbon dioxide in August (more than a hundred times the spectrum beside its band); water
  vapour, organic molecules, carbon dioxide (49 times) and carbon monoxide in December. Measurements that a
  catalogued star behind the comet, or faulty pixels, have a part in are drawn hollow and left out.
- **Check it elsewhere.** One click opens the same coordinates in SIMBAD, WiseView (Backyard Worlds), ESASky,
  the Legacy Survey viewer and the VizieR photometry viewer. A body of the solar system links to its orbit
  at NASA/JPL and at the Minor Planet Center.
- **Take it with you.** Copy a link to the exact view, save the image or a video of the sequence, or download
  every measurement as a CSV file.
- **Take the guided tour.** Fourteen short steps, in plain language, from "what is SPHEREx" through the five
  test objects of the challenge to Pluto. After Barnard's Star comes the same star over 26 years, in the
  *Years* view: 2MASS in 2000, WISE and NEOWISE, then SPHEREx, with its speed measured from those images. One step shows two real SPHEREx pictures of the same patch of sky,
  six days apart, flipping the way Clyde Tombaugh flipped his plates: one dot moves, and it is Pluto. The
  last object is Pluto in the tool itself, found by its own search. Two steps are about Planet X:
  what was predicted and why, that nobody has seen it, and a ladder of brightness from Sirius down to the
  prediction that shows what a magnitude is and why a single SPHEREx exposure stops about 16 to 250 times
  short of it. At the first object, numbered pointers lead from the tour's card to the parts of the panel,
  and Next walks through the panel before the tour moves on. The tour is saved on the device and runs
  without a connection; the four further objects its last step offers are read live from the archive, and
  one press keeps those too. With a connection the last step also offers a hunt. The map keeps one height
  through the whole tour, on a phone and on a desk: the tour's card docks under it, and the map has the one
  height that leaves room for the tour's longest card. On a phone the two pictures of Pluto and the ladder
  of brightness sit in the card, under its title.
- **Learn the panel.** "How to read this panel", on every object, walks through its nine parts one at a time:
  the part is lit, the rest dimmed, and a card says what it shows and what can be done with it. The tour
  takes the same walk at its first object.
- **In six languages.** The front page, the guided tour, the walk through the panel, the measurement panel
  itself with the sentences it writes from the numbers, and the four information pages are in English,
  Turkish, Spanish, German, French and Polish (the picker is in the top bar; `?lang=tr` in an address does
  the same). Dates, counted nouns and the encyclopedia card follow the language. The words live in
  `web/js/lang.js` and in one file per language under `web/js/lang/` and `web/js/pages/`: adding a language
  is translating those three. Every kind of object that SIMBAD knows (226 of them, from *Star* to *Gravitationally
  Lensed Image of a Quasar*) has its name in each language. Spanish speakers who tried the site reported words
  left in English; the German, French and Polish texts have not yet been read by a native speaker.

## How the challenge is covered

| Challenge request | In Chronosphere |
|---|---|
| Public web tool | A static site with no server and no login; works on a phone and offline |
| Enter RA and Dec | Decimal degrees, sexagesimal, or an object name; or just click the map. Coordinates can be pasted with their labels, as the challenge text gives them ("Right Ascension 08h55m10.831s, declination -7d14m42.53s"); for old coordinates of a fast mover the tool offers to jump to where the object is now |
| Series of images like a little video | Starts playing by itself; pause, step, speed; zoom and pan |
| Easy to spot moving objects | The same spot in 2MASS, WISE, NEOWISE and SPHEREx images over a quarter of a century, the motion measured from them; visit stacks, time-as-colour, difference images; every clear star in the field is checked for motion and flagged; the shift of any clicked spot is measured and judged against ordinary stars; catalogued movers are compared with their prediction |
| Tested on Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis | On the front page and in the guided tour, each with a note on what to look for |
| Easy to update with new data releases | Nothing about releases is hard-coded: a scheduled job rebuilds the sky index from the archive, and each release can be switched on or off in the viewer |
| Use the 102 bands, add detectors, spectra on the fly | Per-detector stacks; the 102-band all-sky map; click-to-spectrum computed in the browser |
| Add or subtract images from different times | Visits, Deep sum and Difference modes |
| Choose the field of view | 3 to 40 arcminutes |
| Overlay other telescopes | Gaia DR3 with proper-motion arrows and WISE sources, for any position; 2MASS, WISE and DSS sky maps |
| Coordinates in the URL | `?ra=269.446&dec=4.771&fov=5&det=5&mode=epochs`; add `&embed=1` for a bare viewer to place in an iframe; `?tour` starts the tour, `?hunt` a hunt, `?sso=Ceres` opens a body of the solar system by name |
| Display metadata | Date, wavelength, detector, release, exposure id, sky level, noise, coverage, PSF width, masked pixels, the pipeline's flags for each pixel by name (cosmic-ray hit, overflow, persistence, ghost and the rest, read from the file's FLAGS layer and drawn on the image) and a link to the source FITS file for every exposure |

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
   found again all month (the price: under half an arcsecond for the star with the largest proper motion in the sky).
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
- **Passing bodies.** The search was run on sixteen fields (17 and 18 November 2026). In eight fields of 10
  arcminutes along the ecliptic it reported 20 bodies: SkyBoT lists a catalogued body within 3 arcseconds of
  every one of them (visual magnitudes 14.0 to 18.8), and nothing was reported that it does not list. In
  three fields of 5 arcminutes at ecliptic latitudes of 17, 29 and 52 degrees it reported none, and none in
  the fields of the five test objects.
  Six of the eight fields were centred on a body known to be there: Pluto was found at all 19 stops of the
  telescope that caught it, about half an arcsecond from the path JPL computes; (1467) Mashona (magnitude
  14.0) at 3 of 3, (5379) Abehiroshi (17.2) at 4 of 4, (13232) Prabhakar (17.6) at 1 of 2, (19694) Dunkelman
  (18.4) at 1 of 4, and (6563) Steinheim (18.6) at neither of 2: the search reaches about magnitude 18.
  The other two were picked by the hunt itself, and the search was not told what to expect: it found
  (1292) Luce (15.9) at 5 of 5 stops and (716) Berkeley (16.4) at 2 of 3, and beside them four fainter
  bodies, of magnitude 17.8 to 18.7. A third hunt, started from the front page's button, picked
  (1824) Haworth (16.4) near the point where its path turns back, read 264 exposures in 101 seconds and found
  it at 12 stops over a week.
  And one came from a visitor's question: at right ascension 330.43659°, declination −19.17837° a light
  stood in one visit and was gone in the others. The search had found (110) Lydia (magnitude 12.5) at 4
  stops on 4 and 5 November 2025, and at the third it stood 2.6 arcseconds from the ringed spot; the panel
  said so for the field but not for the ring, which is why it now does.
  Speeds measured from the tracks agree with the orbits: 21.0 against 20.8 arcseconds an hour for Ozegahara,
  23.5 against 23.6 for Aster, 17.3 against 16.9 for Luce. What was turned away on the way: charge left in a
  detector by a bright star (missing from the first exposure of every stop, and back at the same place at
  every stop of a visit), cosmic-ray hits that fell on one place twice, which the pipeline's own flags mark,
  faint stars that show only at one end of a detector's range of wavelengths, which are there again whenever
  the telescope returns in that colour, and dots that are in one of the two long-wavelength detectors only:
  sunlight thrown back is brighter at the short end, where the test bodies stand out two to five times more
  clearly, so a dot that is strongest in D5 or D6 while the partner detector shows less than half as much is
  a fault of that detector (one such dot, which SkyBoT and the Minor Planet Center's checker both did not
  know, was reported in a field before this rule). A body in front of a faint star used to be passed over;
  now a strong dot there counts in a second round, under stricter rules (three images, two of them in one
  detector, and next to nothing at that place on other days): Berkeley's second stop is found this way, and
  the sixteen fields give the same bodies as before otherwise. Seven more fields, opened by name the same
  day, gave the body asked for each time and six others, every one catalogued. One of them first showed a
  second dot that no catalogue knew: a faint source that is there in three of eight exposures of the same
  colour at other times. The test in the same colour now turns a dot away at a third of them, when that is
  three exposures or more, where it took half; among the test bodies that share never passes 29 per cent.
  Uranus, opened by name, is found at 13 of the 14 stops that caught it, 0.4 arcseconds from its path, and
  with it Titania (magnitude 14.2) at 12 stops and Oberon (14.4) at 10, which SkyBoT names. A moon circles
  its planet and a slow asteroid turns back, so the search, which joins what moves in a straight line, finds
  such a body in pieces: pieces that SkyBoT gives one name are shown as one body.
- **Bodies by name, and where the spacecraft was.** A path computed for the centre of the Earth is not where
  SPHEREx sees a body: from 650 km up, a main-belt asteroid lies a few arcseconds to the side. Every exposure
  gives the position of the spacecraft in its header (X_SC, Y_SC, Z_SC, with GEOCENTER as origin; the axes
  are not named). Read as the equatorial axes of the star positions and turned by the Earth's rotation, that
  position falls within a degree of the ground track the same header gives, in twelve exposures spread over
  the mission; what remains in longitude, 0.32 degrees on average, is the precession since the year 2000
  (0.33 degrees), as it should be for axes fixed to the stars.
  Shifting a body's path by that position brings it onto the dots the search found. For seven bodies opened
  by name (155 exposures) the dots lie a median 1.16 arcseconds from the path as the centre of the Earth sees
  it, and 0.80 from the path as the spacecraft sees it. It matters most where the shift is large: (1292) Luce,
  1.96 au away, 2.30 against 0.62; (1467) Mashona, 2.47 au, 2.01 against 0.81; (433) Eros, 1.15 au, 2.10
  against 0.86. For Pluto, 35 au away, the shift is a tenth of an arcsecond and changes nothing (0.85 and
  0.81). What is left, about 0.8 arcseconds, is how well a dot can be placed on images resampled from pixels
  of 6.15 arcseconds; the reports state 0.7 arcseconds in each coordinate for a clear dot, more for a faint one.
- **The comet that is followed (3I/ATLAS, 21 November 2026).**
  *Which exposures.* IRSA publishes its own list of the SPHEREx exposures that contain the comet
  (`obscore_3I_Atlas.vot`, 259 rows: 161 of August and 98 of December 2025). The site's index finds 258 of
  them and six more in which the comet lies well inside the detector (one in D1, five in D6); the one it
  lacks is an exposure its reader left out because the comet lay off the detector or on masked pixels.
  SPHEREx had the comet in view a third time, in March and April 2026 (63 exposures at 15 stops, five times
  the Earth's distance from the Sun): in the stack of those it does not stand out from a crowded field near
  the Milky Way, and they are left out.
  *Whether they are centred on it.* Each exposure is cut out around the place JPL Horizons gives for the
  comet at the middle of that exposure, shifted to where the spacecraft was (as for the bodies by name,
  above). In the 39 exposures of December in D1 to D3 with nothing else in the measuring circle, the centroid
  of the comet's light lies 0.17 arcseconds (r.m.s.) from that place, 0.30 at most: a thirty-sixth of a pixel.
  The places that IRSA's table predicts for the same exposures lie 2.68 arcseconds from the light; without
  the shift to the spacecraft the site's own would be 1.8 off. In August the comet is faint in a crowded field
  and its centroid is known no better than 1.4 arcseconds (14 exposures). The orbit service the site asks
  about bodies typed by name puts this comet 1.7 arcminutes from where its light is, which is why it is a
  showcase object with JPL's path, and why its names open that object.
  *Which gases glow.* A band counts as glowing when two or more of its measurements stand above the brighter
  of the two stretches of spectrum beside it by five times their uncertainty and by three tenths at least.
  That gives carbon dioxide in August and, in December, water vapour (3.6 times the spectrum beside it),
  organic molecules (2.7), carbon dioxide (49) and carbon monoxide (3.1). The SPHEREx team reports from the
  same exposures water vapour and carbon dioxide in August (Lisse et al., arXiv:2512.07318) and, in December,
  a much more active comet with CN, water vapour, organic C-H, carbon dioxide and carbon monoxide
  (arXiv:2601.06759). The site's simple test agrees on all of these but two: in August only one measurement
  in the water band clears its threshold, and CN, a rise of a twentieth near 0.93 microns, is too small for
  it. It says "no clear glow", not "none".
  *How the light is measured.* Within 9.2 arcseconds of the centre, the sky taken from a ring at 100 to 140
  arcseconds. With the ring used for stars (18 to 30 arcseconds) the comet reads 15 per cent lower, because
  that ring lies in its glow (258 against 306 mJy at 4.25 microns); a ring at 210 to 270 arcseconds gives the
  same as the one used, to 1 per cent. The glow has no edge: within 20 arcseconds there is 2.2 times as much
  light as within 9.2, within 40 arcseconds 4.3 times.
  *Stars behind it, and faulty pixels.* For every stop of the telescope the stars around the comet's place
  were read from Gaia DR3, 2MASS and AllWISE, and the light each adds inside the measuring circle was
  estimated at the exposure's wavelength: 150 of the 264 exposures carry 0.02 mJy or more. In August, in
  front of the Milky Way's bulge, the estimates follow what is measured: an exposure at 1.10 microns reads
  16.3 mJy where the comet has 1.5, and the estimate for the star is 16.2; where the comet reads 2.2 instead
  of 1.5 the estimates are 0.6 to 0.7. A measurement is drawn hollow when the estimate is a quarter of it or
  more. The pipeline's own flags mark a quarter or more of the circle as faulty in two exposures: the two
  worst measurements of the set (212 mJy at 4.35 microns, where the neighbours read 1; and -2.8 mJy at 4.85).
  One stop of August has something 11 arcseconds from the comet that no catalogue lists, in both detectors
  that looked (most likely a body passing by): its two measurements are not marked and stand out.
  *In use.* Nine ways of typing its name open it, "Atlas" opens the star; an address written for the body
  by name leads to it; the panel of the five test objects is word for word what it was before; the tour has
  its thirteen steps, also with the network cut; no text spills in five languages on a laptop and a phone;
  WebKit and Firefox give the same numbers.
- **The Years view (21 November 2026).**
  *The sky maps read in the browser.* Which way the pixels of a HiPS tile are laid out was found by trying all
  eight ways a square can be turned or mirrored on three fields (on the equator, in the north and in the south)
  and comparing each with Gaia stars (`spike/hips_orient.py`, `spike/hips_check.py`): one puts the stars of
  2MASS K within 0.52 arcseconds (r.m.s.) of their Gaia places moved back to 2000.4 in Barnard's field and within
  0.75 near R Draconis; the next best is off by 4.5 arcseconds. The night 2MASS looked is the date of the
  brightest 2MASS source near the place (VizieR, II/246); when that cannot be looked up, the picture is labelled
  1997 to 2001 and the page says why.
  *The images built for the five test objects* (`scripts/build_years.py`). 2MASS Atlas Images (IRSA), joined
  where a field spans two scans and dated by the scan the star is in; WISE and NEOWISE single exposures (level
  1b) read from IRSA's open data on AWS, only the rows of each exposure that the field needs; SPHEREx level 2
  exposures. Every image is resampled onto one grid and turned into MJy/sr with its own zero point; each WISE
  visit is the median of up to 16 exposures (24 for Barnard's Star), each SPHEREx visit of its exposures in one
  detector (visits of fewer than five exposures are left out).
  *Where the star's light lies* in each image, against the place the catalogue (SIMBAD) gives for that date (its
  motion and, for nearby stars, its parallax), worked out by the page itself:

  | Star | Images | 2MASS | WISE 2010 | NEOWISE | SPHEREx | Motion measured (catalogue) |
  |---|---|---|---|---|---|---|
  | Barnard's Star | 27 | 0.2″ | 1.1″ | 0.4″ (21) | 1.0″ (3) | 10.42″ a year (10.39) |
  | Epsilon Indi B | 29 | 0.2″ | 0.2″ | 0.5″ (21) | 0.5″ (5) | 4.71″ a year (4.68) |
  | WISE 0855 | 25 | not seen | 0.5″ | 0.4″ (21) | 1.3″ (2) | 8.19″ a year (8.15) |
  | RW Aurigae | 27 | 0.4″ | 0.5″ | 0.4″ (21) | 0.7″ (3) | moves 0.6″ in 27 years |
  | R Draconis | 32 | 0.1″ | 0.6″ | 1.0″ (22) | 1.3″ (7) | moves 0.6″ in 27 years |

  A WISE pixel is 2.75 arcseconds, a SPHEREx pixel 6.15. Barnard's Star is so bright that the core of every WISE
  image of it is missing (saturated): the missing pixels are counted as the brightest light around them and
  the centre is taken over six pixels, which puts its light 0.6 arcseconds (r.m.s.) from the catalogue's place;
  windows of 2.5 or 4 pixels without the filling stray by 7 to 8 arcseconds (`spike/years_centre.py`). WISE
  0855 does not show in 2MASS: the page says so, and measures it from WISE and SPHEREx only.
  *Brightness.* The light of a ring 15 to 30 arcseconds around a saturated star, visit by visit, against the
  median magnitudes of the same visits in the AllWISE multi-epoch and NEOWISE single-exposure tables (profile
  fits; `spike/years_lc.py`): for RW Aurigae the two rise and fall together, correlation 0.96 in W1 and 0.97 in
  W2 over 21 visits, the ring showing large changes smaller than the catalogue does (2.3 against 4.2 times at the
  peak of 2017). The catalogues' fits of a heavily saturated star scatter widely on their own: Barnard's Star,
  which is steady, spans a factor of five from visit to visit in them. So the page draws a brightness curve only
  when the images and the catalogue agree (correlation 0.8 or more over at least eight visits) and the images show
  a change of a third or more; of the five test objects only RW Aurigae passes.
  *Found without being told where to look.* Each WISE or NEOWISE visit minus the median of all of them leaves
  what was not always in one place; its dots of 7σ or more are linked from the first third of the years to the
  last, and a line counts when a dot lies on it in 90% of the visits it crosses, at 1.5 arcseconds a year or
  more, away from the edge (`spike/years_blind.py`, then the same in the page). Of the ten bands of the five fields, it
  finds WISE 0855 in W2 (8.10, catalogue 8.15; it does not show in W1) and Epsilon Indi B in W1 and W2 (4.69,
  catalogue 4.68). It does not find Barnard's Star: saturated, it leaves no clean dot. What it does find there,
  in W1, moves exactly like Barnard's Star 2.8 arcminutes away from it, a reflection of the star in WISE's
  optics; in Epsilon Indi B's field the glare of Epsilon Indi A, just outside it, moves the same way. A line that
  moves like the object in the ring (within 10° and 30%) but passes elsewhere is therefore not reported. A first
  rule set (60% of the visits, 0.4 arcseconds a year) found up to nine lines per field, nearly all of them noise:
  the rules above keep only the two brown dwarfs. Near Luhman 16 a line at 1.0 arcsecond a year, 5 arcminutes
  from it, lay where Gaia knows no star moving faster than 0.1: what is left of two bright stars that stay put
  wanders as WISE's image turns with each scan, which is why lines slower than 1.5 arcseconds a year are not
  taken. One object linked from different dots is reported once. The three stars of the tour's last step, built
  the same way: Proxima Centauri 3.85 arcseconds a year over 28 images (catalogue 3.86; saturated in WISE, not
  found by the search), Luhman 16 2.79 (2.79; found, 2.95), Teegarden's Star 5.14 (5.12; found, 5.26).
  *On the sky maps, for any star.* Five fast stars typed into the search box, nothing built for them: the motion
  measured on the 2MASS and AllWISE pictures and the SPHEREx visits against the catalogue (SIMBAD), arcseconds a
  year: Proxima Centauri 3.80 (3.86), Wolf 359 4.68 (4.72), Luhman 16 2.76 (2.79), Teegarden's Star 5.13 (5.12),
  Kapteyn's Star 8.71 (8.64, at 10 arcminutes). The maps' pictures are stretched by their makers: a bright star
  fills the brightest grey, and is centred over six pixels like a saturated one; whether a star is "there" is
  judged by the light at its place against the picture's sky, not by the centroid's peak (on Proxima Centauri, in
  the crowded Milky Way, the first rule set had said "too faint for 2MASS" of one of the brightest stars of
  2MASS's sky; the page now says that only where there is no light at all). The AllWISE picture is dated by the
  middle of 2010, half a year from either of WISE's passes, which at Proxima's speed is about 2 arcseconds.
  *In use.* On a laptop and a phone, in English and Turkish, with no page errors; nothing passes the right edge
  of a phone's screen; the same numbers in Edge, WebKit and Firefox. The English panel of the five test objects is word for word what it was, apart
  from the new view's button. The guided tour has a fourteenth step, Barnard's Star in the Years view (its
  images are saved with the tour for offline use): the map keeps one height through all fourteen steps on
  three phone screens (0 px of change, in English and Turkish), and the whole tour runs with the network cut.
- **Picking a field for a hunt.** Twelve picks in a row: eleven gave a field, after one to six asteroids
  tried and 1 to 10 seconds; one gave none (ten asteroids are tried now, where six were). The two fields then
  read in full are the two hunts above.
- **Names.** Sixteen names typed into the search box: "Sirius", "Vega", "Mira" (a star, and asteroid 3633),
  "61 Cygni" (a star; asteroid 61 is Danaë), "Proxima Centauri", "M31" and "Luhman 16" open the star or
  galaxy; "Ceres", "433 Eros", "(1467) Mashona", "asteroid Iris", "Uranüs", "2P/Encke" and "Vesta" open the
  body; "Apophis", which SPHEREx has not had in view, and a word that is no name are answered in words. The
  23 ways of writing coordinates and the 25 names that must stay names give the same result as before.
- **The report file.** The files the page writes for a numbered body, a provisional designation, a comet
  and a dot without a name were put through the IAU's own checker (the `iau-ades` package, `valsubmit`,
  against the schema for submissions): all pass. Its first try did not: a line of comment may hold a
  hundred characters. None of these files has been sent to the Minor Planet Center.
- **Pixel flags.** The FLAGS layer of an exposure is a Rice-compressed image; the page has its own decoder.
  For two whole exposures (4.16 million pixels each) its output is identical to Astropy's, pixel for pixel.
  For the stamps of three test objects, the flags the page assigns to each pixel were recomputed
  independently, with Astropy's decompression and Astropy's WCS including the SIP distortion: 0 of 28,812
  pixels differ. Edge, WebKit and Firefox give the same flags for the same exposure. The flags make sense where the answer is known: in the exposures tried, Barnard's Star and
  R Draconis, which overload the detectors, carry OVERFLOW and BLOOM at the circled spot, and WISE 0855
  carries no fault.
- **Sky-map tiles.** The HEALPix code (`web/js/healpix.js`) agrees with `astropy-healpix`, and the tiles it
  predicts for a view include the ones the map goes on to request.
- **Map transitions.** The guided tour was filmed frame by frame (about 5,300 frames for the twelve steps
  and the walk through the panel) and every frame measured: none is blown out to white or washed out, where
  each change of colour used to flash white. A probe inside the page then watched some 35,000 frames while the tour was stepped through at
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
- **Nothing jumps while the page loads.** The browser's own measure of how far things on the screen move
  after they first appear (cumulative layout shift; 0.1 is the usual limit for "good") was 0.13 on a phone,
  0.23 on a small phone and 0.07 on a laptop, because the list of test objects and the map chooser were
  filled in after the first picture. Now: 0.01, 0.02 and 0.004 on the published site.
- **Languages.** Making the panel translatable must not change its English: the words of the panel for the
  five test objects, in six views each, were recorded before and after and are identical. A test language
  (`?lang=xx`) puts every translatable text in brackets; what stays outside them on the screen is object
  names, dates and the encyclopedia text. In each of the five other languages the panel was checked at laptop
  and phone size for text that spills out of its box (none in 50 views), and the Turkish and the Spanish tour
  were run from start to end with the network cut. The information pages have the same build in every
  language as in English (headings, paragraphs, list items, links), and the top bar holds at nine widths.
  After Spanish speakers reported words left in English, the whole site was walked once in English and once
  in Spanish (front page, menu, the five information pages, the tour with the walk through the panel, the six
  showcase objects in every way of comparing) and every text read the same in both was listed: names and
  units apart, one name on the tour's last step. Two more kinds of leftover could not be seen that way and
  were found by looking at pictures of the Spanish pages and by opening places read live: the two axis labels
  of the brightness plot, which are drawn on a canvas, and 183 of SIMBAD's 226 kinds of object ("Eclipsing
  Binary Candidate"), which only show when a visitor presses something uncommon. All are translated now.
- **The front page on small screens.** With the moving picture added, the front page was photographed on
  eleven screens (from 1920 by 1080 down to a 360 by 640 phone, and a phone held sideways) in each of the six
  languages, and measured: nothing lies over anything else, nothing is cut off at the top of the map, no
  button's words are clipped (0 faults in 66 views). On a short phone screen the sentence under the picture
  steps aside first, then the picture; before, the German and French titles were cut off at the top there.
- **The map during the tour.** A visitor reported that on a phone the map above the tour's card grew and
  shrank from step to step. It did: the card docked under the map and the map took what was left, so its
  height followed the length of the card's words: from 102 to 360 px over the first steps on a 360 by 640
  phone, 145 to 360 px on a 390 by 664 screen (a phone with its browser's bars showing), 325 to 463 px on
  390 by 844; on a 1280 by 720 laptop from 241 to 388 px over the six steps with an object. Now the tour's
  longest docked card is measured once, on a copy of the card that is never shown, and the map gets the one
  height that leaves room for it. Measured at every one of the thirteen steps: 0 px of change on the three
  phone screens in Turkish, English, German and French, on an 820 by 1180 tablet, on a phone held sideways,
  and over the object steps at 1280 by 720, 1920 by 1080 and 1024 by 768. On a phone the two worked examples
  moved from over the map into the card (they were what made the map grow for two steps); there, and where
  a card is longer than the screen, the page scrolls. The frame-by-frame probe for blank white in the map
  was run again on the phone and the laptop tour: 0 per cent exposed in 2,344 and 2,081 frames.
- **Typed coordinates.** 23 ways of writing the same position (degrees, hours and minutes, with colons,
  with unit letters, with a typeset minus sign, with "RA" and "Dec" or the full words in any of the six
  languages) all give the position to 0.7 arcseconds or better, and none of 25 object names is mistaken for
  coordinates. The challenge's own coordinates for WISE 0855, pasted as written, open that spot and offer the
  jump to where the brown dwarf is today, 2.2 arcminutes away.
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
- **Planet X.** What the tour says about the hypothetical planet is NASA's account of it ("Hypothetical
  Planet X", science.nasa.gov): 5 to 10 Earth masses, 20 to 30 times farther from the Sun than Neptune,
  10,000 to 20,000 years per orbit, not yet seen. The ladder of brightness uses Sirius at magnitude -1.46,
  the naked-eye limit 6, Barnard's Star 9.5 (SIMBAD), Pluto 15.1 at mean opposition (NASA fact sheet), a
  single SPHEREx exposure at about AB 19 (5 sigma in one band; the mission's sky-simulator paper, 2025), and
  Planet X at visual magnitude 22 to 25 (Brown & Batygin 2016), with wide searches complete to about 21
  (Brown, Holman & Batygin 2024). The "times fainter" between rungs is 10^(0.4 x the difference in
  magnitude), rounded.
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
.venv/Scripts/python scripts/build_years.py          # the Years view of the five test objects and the tour's three stars: 2MASS, WISE and NEOWISE, SPHEREx (about 10 minutes each)
.venv/Scripts/python scripts/build_years.py --measure   # the motion the built images show, for the plain pages (then run build_pages.mjs)
.venv/Scripts/python scripts/build_images.py --years barnard   # its moving picture for the plain pages (also --hero, --share for the front page)
node scripts/build_body.mjs pluto                    # rebuild Pluto: its path from JPL Horizons, its field from the archive
node scripts/build_body.mjs 3i-atlas                 # rebuild comet 3I/ATLAS: every exposure that had it in view, cut out around it
```

The `backend/` folder also contains an optional FastAPI service with the same pipeline in Python
(`python -m uvicorn server:app --app-dir backend`); the site does not need it.

## Layout

```
web/index.html        the page itself: the map, the search box and the measurement panel
web/sunum.html        a seven-scene cinematic presentation of the project with speaker notes, in Turkish and English
web/chronosphere-slides.pdf   the seven-slide demonstration handed in with the project
web/config.js         the address of the optional Python API (empty by default: the site needs no server)
web/css/              style.css (the page) and fonts.css (the self-hosted fonts)
web/js/archive.js     sky index lookup, FITS range reader, TAN-SIP astrometry, resampling, wavelength
web/js/app.js         viewer, plots, search, checks against comparison stars, tour wiring, offline store
web/js/core.js        decoding, sky geometry, stacking, photometry, band depths, joining saturated detectors
web/js/plot.js        the scatter plots on a canvas: axes, error bars, hover tooltip, click to select
web/js/sky.js         the explorable sky map (Aladin Lite + IRSA sky maps)
web/js/rice.js        Rice decompression, for the flags layer of an exposure
web/js/healpix.js     which sky-map tiles a view needs (HEALPix)
web/js/years.js       the Years view: the images built for the test objects, and the 2MASS and AllWISE sky maps
                      read in the browser and laid on the grid of the SPHEREx images, for any other place
web/js/movers.js      bodies of the solar system passing through a field: the dots that are not always there
web/js/bodies.js      a body by name: its path (Miriade), the days SPHEREx had it in view, the shift to where the
                      spacecraft was, the report in the Minor Planet Center's format, a field for a hunt
web/js/info.js        identification (SIMBAD), names of solar-system bodies (SkyBoT), Wikipedia card, links to other tools
web/js/tour.js        guided tour: the steps and what the map does at each
web/js/lang.js        the words of the front page, the tour and the walk through the panel, in six languages
web/js/lang/          the measurement panel in Turkish, Spanish, German, French and Polish (one file each)
web/js/pages.js       the "Asteroid hunt", "What is SPHEREx?", "How it works" and "About" pages, in English
web/js/pages/         the same four pages in the other five languages (one file each)
web/hero-barnard.webp the front page's moving picture: Barnard's Star from 2000 to 2026 in 2MASS, WISE, NEOWISE and SPHEREx
                      images (hero-barnard.jpg: one still picture, the path drawn in); web/share.jpg: a link's preview
web/sw.js             service worker: offline cache
web/404.html          what a wrong address shows, with the way back to the map
web/manifest.webmanifest, web/icon-192.png, web/icon-512.png, web/apple-touch-icon.png, web/favicon.ico
                      the site's name and icon for home screens and browser tabs
web/find-asteroids.html, web/what-is-spherex.html, web/how-it-works.html, web/about.html
                      the four information pages as plain pages with addresses of their own, which a search
                      engine or a browser without scripts can read (generated)
web/planet-x.html     Planet X, Pluto and SPHEREx: the guided tour's story as a plain page, with Pluto in two
                      SPHEREx exposures six days apart (generated)
web/barnards-star.html, web/epsilon-indi-b.html, web/wise-0855.html, web/rw-aurigae.html, web/r-draconis.html
                      the five test objects as plain pages, each with its SPHEREx pictures (generated); the
                      front page's example objects are links to these pages and to Pluto's, and a plain press
                      opens the object in the tool instead
web/proxima-centauri.html, web/luhman-16.html, web/teegardens-star.html
                      the stars of the tour's last step as plain pages: their walk over 27 years and the motion
                      measured from those images (generated)
web/pluto.html        Pluto as a plain page: one SPHEREx picture for every stop of the telescope that caught it (generated)
web/3i-atlas.html     comet 3I/ATLAS as a plain page: its two visits, the gases that glow around it, how the pictures
                      are known to be centred on it; the numbers are worked out from the stored exposures (generated)
web/tr/, web/es/, web/de/, web/fr/, web/pl/   the same pages in the other languages (generated)
web/img/              those pictures: real SPHEREx images, made by scripts/build_images.py
web/robots.txt, web/sitemap.xml   for search engines (the sitemap is generated with the pages)
web/db83ba526cb561c174feda741610f139.txt   the IndexNow key: Bing, Yandex and others read it to check that a
                      notice of new pages (scripts/indexnow.py) comes from this site
web/index/            the sky index (generated)
web/data/             the showcase objects: the five test objects, Pluto and comet 3I/ATLAS (generated); for the five
                      test objects also years-*.ndjson, the images of the Years view, listed in web/data/years.json
web/vendor/aladin.js  Aladin Lite 3.8.2 (CDS, GPL-3.0), unmodified
web/fonts/            IBM Plex and Instrument Serif (SIL Open Font License)
scripts/              build_index.py, prebuild.py; build_body.mjs builds Pluto and comet 3I/ATLAS with the site's own reader (Node);
                      build_pages.mjs writes the plain information pages
                      from web/js/pages.js, the tour's words and the showcase objects (run it with Node after
                      changing any of them); build_images.py makes their pictures from the showcase data;
                      indexnow.py tells search engines which pages changed
backend/              Python reference pipeline and optional API
```

No build step: plain HTML, CSS and JavaScript modules.

## Honest limits

- The Years view measures where a star's light lies in every image, but its brightness only within WISE and
  NEOWISE, and only for a star the images and WISE's catalogue agree on: the bands of the three telescopes
  differ, so no light curve runs from 2MASS through WISE to SPHEREx, and R Draconis, saturated far into its
  wings and changing every 245 days while WISE looked every six months, gets none. Away from the test objects
  the older images are the sky maps' pictures, stretched by their makers: positions are measured on them, not
  brightness; and between 2010 and SPHEREx there is no image there, since NEOWISE's yearly images are only built
  for the test objects.
- A SPHEREx pixel is 6.15 arcseconds. Even Barnard's Star moves only about 1.7 pixels per year, so motion shows
  up as a small shift between visits, not a streak. Positions repeat to a few tenths of an arcsecond, so
  anything slower than roughly one to two arcseconds per year cannot be seen yet.
- Each exposure is at a different wavelength, so single exposures of the same star differ in brightness for a
  physical reason. The brightness-over-time plot divides each measurement by the star's own average spectrum at
  that wavelength to separate real variability from colour.
- Photometry is a simple 9-arcsecond aperture without aperture correction, meant for exploring, not for
  publication. It reads roughly 10 to 15 per cent low.
- The comet's brightness is the light within 9 arcseconds of its centre, not the brightness of the whole
  comet: its glow has no edge. In August it was faint in front of a crowded field, and single measurements
  scatter by tens of per cent even where no catalogued star is to blame. The test for glowing gas is simple;
  the SPHEREx team's analysis of the same exposures finds more (see "The comet that is followed").
- Very bright stars saturate the detectors. They are measured from their outer halo and each detector is
  joined to its neighbour: the overall shape of the spectrum is right, the level and the fine detail are
  approximate. If every detector is saturated only relative brightness is shown.
- Next to a very bright star, faint neighbours sit in its glow, so they cannot serve as comparison stars;
  the tool says so instead of comparing.
- Pixel flags are read for one exposure at a time and need a connection; the stacked views (Visits, Deep and
  the others) mix many exposures and show no flags of their own. A pixel of the displayed image takes the
  flags of the four detector pixels it was resampled from, so a flagged pixel reaches one pixel further than
  on the detector. The plain-language meaning given for each flag is ours; the file's own short description
  is used for any flag the site does not know.
- A dip at a molecule's wavelength is a hint, not a detection: other molecules and the shape of the spectrum
  itself can produce one.
- The search for passing bodies reaches about magnitude 18, and a body has to be caught at two moments of
  one stop, or by both detectors of a pair at one moment: fainter bodies and bodies in a single exposure are
  missed. In front of a star a body is found only when it is strong (15 times the noise, in three images),
  or where a track already leads to it. A body that shows in the two long-wavelength detectors only (the gas
  of a comet, a very dark and warm body) is turned away with the faults of those detectors. A sighting that
  is not part of a straight track of three stops is kept only after the pipeline's flags of its dots have been
  read, which needs a connection. SkyBoT's places, which name the bodies found, are computed for the centre of
  the Earth; seen from SPHEREx a main-belt asteroid lies up to a few arcseconds from there (the path of a body
  opened by name is shifted to where the spacecraft was; the comparison with SkyBoT is not). A dot that SkyBoT
  does not know can still be a fault of the image.
- A hunt reads about three hundred exposures, a few hundred megabytes, and takes two to four minutes; it
  needs the orbit service (Miriade) and the archive. Its field is picked for an asteroid of magnitude 16.5 or
  brighter that stayed in it for three stops of the telescope: of the two hunts read in full, one found its
  asteroid at all five stops and one at two of three. A hunt finds catalogued bodies: asteroids bright
  enough for a single SPHEREx exposure have been known for years.
- The places written into a report are centroids on images resampled to 3.1-arcsecond pixels from pixels of
  6.15: good to about 0.7 arcseconds for a clear dot, and stated as such in the file. The file is a draft in
  the right format, not a submission: the Minor Planet Center asks to be contacted before archival
  observations are sent, the reporter's name has to be put into it, and whether positions of this accuracy
  are wanted for a body it already knows is for the Center to say.
- A body opened by name is shown where it stayed inside one field for the most stops of the telescope; a
  fast one, such as a near-Earth asteroid, is caught at one or two. Planets and their moons are named, but
  not linked to an orbit page, and no report is written for them: the Minor Planet Center collects the
  positions of minor planets, comets and the far-out small moons, not of planets and their large moons. The
  brightest planets have not been tried.
- The ice bands of a body of the solar system are measured on its light divided by a black body of 5772 K
  standing in for the Sun, from the few exposures of one visit; the band beyond 3 microns is set against its
  short-wavelength side alone, because methane ice leaves no bright stretch on the other.
- A star close to saturating the camera is located less faithfully: Barnard's Star is 1.7 arcseconds off its
  prediction in its first visit in one detector, while its other visits agree to 0.2 to 0.4.
- The all-sky map is coarser (about 13 arcseconds per pixel) than the images loaded for a selected spot.
- Away from the five test objects, the number of exposures is an estimate until they have been read, and the
  WISE overlay is CatWISE2020 when the CDS catalogue service answers and AllWISE otherwise.
- The ladder of brightness sets visual magnitudes beside SPHEREx's infrared limit, which is on the AB scale.
  For a body that shines by reflected sunlight the two agree to about 0.3 magnitude between 1.2 and 2.2
  microns, and the body is 1 to 2 magnitudes fainter beyond 3 microns (the Sun's colours, Willmer 2018), so
  the conclusion holds; methane, as on Neptune, would make it fainter still.
- Nothing here claims a discovery. The tool is meant to help more people look.

## Data and credits

- SPHEREx images and all-sky cube: NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA)
  and the `nasa-irsa-spherex` open data bucket on AWS.
- 2MASS, AllWISE and DSS sky maps: HiPS built by CDS, served by IRSA.
- The Years view: 2MASS Atlas Images (Skrutskie et al. 2006; University of Massachusetts and IPAC/Caltech, for
  NASA and the NSF), from IRSA; WISE (Wright et al. 2010) and NEOWISE (Mainzer et al. 2011, 2014) single
  exposures, JPL/Caltech and UCLA for NASA, from IRSA's open data bucket `nasa-irsa-wise` on AWS.
- Gaia DR3: ESA/Gaia/DPAC. CatWISE2020: Marocco et al. 2021. AllWISE: Cutri et al. 2013. Queried through IRSA
  for the test objects and through VizieR (CDS and its mirror at Harvard) everywhere else.
- Object identification and name resolution: SIMBAD and Sesame, CDS, Strasbourg, and their mirrors at the
  Center for Astrophysics, Harvard & Smithsonian.
- Bodies of the solar system: named by SkyBoT, their paths from Miriade, both IMCCE, Observatoire de Paris
  (Berthier et al. 2006, 2009); Pluto's path through its showcase field is from JPL Horizons. SPHEREx's
  observatory code, MPChecker and the rules for reporting: IAU Minor Planet Center. The report format: ADES
  (IAU; checked with its `iau-ades` tools).
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
