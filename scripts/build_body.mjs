// Pre-build a body of the solar system as a showcase object, next to the test objects made by prebuild.py:
//
//     node scripts/build_body.mjs pluto
//     node scripts/build_body.mjs 3i-atlas
//
// A star stays where it is, so a showcase star is a place in the sky. A planet moves on, so a showcase body is a
// place and a time: the patch of sky it crossed during a few days, with the body's path through it.
//   - The path comes from JPL Horizons (seen from the centre of the Earth).
//   - The field is centred between the body's places on the first and the last of those days.
//   - The exposures are read from NASA's open archive with the reader the site itself uses (web/js/archive.js),
//     and stored in the same form as the other showcase objects (web/data/<slug>/d1..d6.ndjson).
//   - The stars of the field (Gaia DR3, CatWISE2020) and the encyclopedia card are stored with it, so that the
//     guided tour needs no look-up at all.
// The entry in web/data/targets.json carries the path (`eph`: [[MJD, RA, Dec], …]), which the page follows.
//
// A body that crosses a field within hours is followed instead (`follow`): every exposure that had it in view is cut
// out around the place the body had at the middle of that exposure, seen from where the spacecraft was then. In such
// a set the body stays in the middle and the stars behind it change from one exposure to the next. Each exposure's
// record says which centre was used (`c`), how much light catalogued stars add inside the measuring circle (`star`),
// and whether the pipeline marked a quarter or more of that circle as faulty (`fault`).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), WEB = join(HERE, '..', 'web'), DATA = join(WEB, 'data');
const AGENT = { 'User-Agent': 'sky-viewer-prebuild/1.0' };

// What is said about each body. Every number has its source: positions, distances and brightness come from JPL
// Horizons at build time; the rest is quoted in the text itself.
const BODIES = {
  pluto: {
    command: '999', label: 'Pluto', wiki: 'Pluto', type: 'Dwarf planet', kind: 'body', number: 134340,
    from: '2025-10-03T23:00', to: '2025-10-12T10:00', size: 5,
    view: { det: 2, mode: 'trail' },
    blurb: 'The dwarf planet that Clyde Tombaugh found in 1930 by comparing two photographs. SPHEREx caught it here in October 2025, moving on from one stop of the telescope to the next.',
    look: 'Each image is one stop of the telescope, in time order. The stars stay where they are; the dot in the ring moves west along the dotted line, the path that NASA’s JPL computes from Pluto’s orbit. Under the images, the tool’s own search for moving dots reports what it found without being told where to look.',
  },
  // Comet 3I/ATLAS (C/2025 N1): reported on 1 July 2025 by the ATLAS survey telescope in Río Hurtado, Chile, and the
  // third body known to pass through the solar system from outside (NASA, "Quick Facts about 3I/ATLAS"). SPHEREx had
  // it in view in August and in December 2025 (IRSA, "SPHEREx observations of Comet 3I/ATLAS"). It crossed a field
  // of ten arcminutes within hours, so it is followed. Not part of the guided tour (`extra`).
  '3i-atlas': {
    command: 'DES=C/2025 N1;', label: '3I/ATLAS', wiki: '3I/ATLAS', type: 'Interstellar comet', kind: 'body', follow: true, extra: true,
    aka: ['3I', 'C/2025 N1'],          // its other names: a search for either opens it
    visits: [['2025-07-31T00:00', '2025-08-16T12:00'], ['2025-12-07T00:00', '2025-12-16T00:00']], size: 10,
    view: { det: 2, mode: 'epochs' },
    // where to read on, beside the encyclopedia and the orbit databases
    links: [{ label: 'IRSA', title: 'SPHEREx observations of comet 3I/ATLAS at IRSA, with the papers of the SPHEREx team', url: 'https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html' },
      { label: 'NASA', title: 'NASA’s pages on comet 3I/ATLAS', url: 'https://science.nasa.gov/solar-system/comets/3i-atlas/' }],
    blurb: 'A comet from another star: the third body ever seen passing through the solar system from outside. SPHEREx caught it in August 2025 on its way in, and again in December 2025, six weeks after it had passed the Sun.',
    look: 'Every image is centred on the comet, so it stays in the middle while the stars behind it change. In August it is a faint dot; in December it is more than twenty times brighter and has a tail. In the spectrum under the images, the points that stand far above the rest near 4.3 microns are carbon dioxide gas glowing around the comet. In December water vapour (2.7 microns) and carbon monoxide (4.7 microns) glow as well.',
  },
};

const slug = process.argv[2], B = BODIES[slug];
if (!B) { console.error(`usage: node scripts/build_body.mjs <${Object.keys(BODIES).join('|')}>`); process.exit(1); }

// The site's own code, run here: it reads its sky index with fetch('index/…') and fixes its language when loaded.
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => (typeof u === 'string' && u.startsWith('index/'))
  ? Promise.resolve(existsSync(join(WEB, u.split('?')[0])) ? new Response(readFileSync(join(WEB, u.split('?')[0]))) : new Response('', { status: 404 }))
  : realFetch(u, o);
globalThis.location = { search: '' };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const load = f => import(pathToFileURL(join(WEB, 'js', f)).href);
const A = await load('archive.js'), C = await load('core.js'), Info = await load('info.js'), Bodies = await load('bodies.js'), Movers = await load('movers.js');

// ---- the path, from JPL Horizons
const mjdOf = iso => Date.parse(iso + (iso.includes('T') ? ':00Z' : 'T00:00:00Z')) / 864e5 + 40587;
const day = mjd => new Date((mjd - 40587) * 864e5).toISOString().slice(0, 10);
const D2R = Math.PI / 180;
const sepArcsec = (r1, d1, r2, d2) => Math.hypot((((r1 - r2 + 540) % 360) - 180) * Math.cos((d1 + d2) / 2 * D2R), d1 - d2) * 3600;
/** Where the body was, seen from the centre of the Earth, from `start` to `stop` (days, MJD) every `step`: rows of { mjd, ra, dec, mag, r, delta }. */
async function horizons(start, stop, step) {
  const q = new URLSearchParams({ format: 'json', COMMAND: `'${B.command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'500@399'",
    START_TIME: `'${day(start)}'`, STOP_TIME: `'${day(stop)}'`, STEP_SIZE: `'${step}'`, QUANTITIES: "'1,9,19,20'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", EXTRA_PREC: "'YES'" });
  const txt = (await (await realFetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q, { headers: AGENT })).json()).result;
  const soe = txt.indexOf('$$SOE'), eoe = txt.indexOf('$$EOE');
  if (soe < 0) { console.error(txt.slice(0, 1200)); process.exit(1); }
  // date, solar presence, lunar presence, RA, Dec, magnitude (a comet: of the whole comet, as a model gives it), a second brightness, r, r-dot, delta, delta-dot
  return txt.slice(soe + 5, eoe).trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => ({
    mjd: Date.parse(c[0].replace(/^(\d{4})-(\w{3})-(\d{2}) /, '$2 $3 $1 ') + ' UTC') / 864e5 + 40587, ra: +c[3], dec: +c[4], mag: +c[5], r: +c[7], delta: +c[9] })).filter(e => isFinite(e.mjd) && isFinite(e.ra));
}
/** A path as a function of time, straight between its points: { ra, dec, mag, r, delta }, null outside them. */
const along = rows => mjd => {
  if (mjd < rows[0].mjd || mjd > rows[rows.length - 1].mjd) return null;
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].mjd <= mjd) lo = m; else hi = m; }
  const a = rows[lo], b = rows[hi], f = (mjd - a.mjd) / Math.max(b.mjd - a.mjd, 1e-9), mix = k => a[k] + f * (b[k] - a[k]);
  let dra = b.ra - a.ra; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
  return { ra: (a.ra + f * dra + 360) % 360, dec: mix('dec'), mag: a.mag, r: mix('r'), delta: mix('delta') };
};

const dir = join(DATA, slug);
mkdirSync(dir, { recursive: true });
const write = (det, lines) => writeFileSync(join(dir, `d${det}.ndjson`), lines.join('\n') + '\n');
const stored = r => { const { data, ...rest } = r; return JSON.stringify({ t: 'frame', ...rest, b64: C.encodeF16(data) }); };

let entry;
if (B.follow) entry = await followed(); else entry = await crossing();

// ---- the encyclopedia card
let wikiCard = null;
try {
  const js = await (await realFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(B.wiki.replace(/ /g, '_'))}?redirect=true`, { headers: AGENT })).json();
  if (js.type === 'standard') {
    wikiCard = { title: js.title, extract: js.extract || '', description: js.description || '', url: js.content_urls?.desktop?.page, thumb: null };
    const src = js.thumbnail?.source;
    if (src) {
      const img = await realFetch(src, { headers: AGENT });
      if (img.ok) { const ext = /\.png$/i.test(src) ? '.png' : '.jpg'; writeFileSync(join(dir, `thumb${ext}`), Buffer.from(await img.arrayBuffer())); wikiCard.thumb = `data/${slug}/thumb${ext}`; }
    }
  }
} catch (e) { console.log(`   encyclopedia card: not to be had (${e.message})`); }
if (wikiCard) entry.wikiCard = wikiCard;

// ---- the entry in the list of showcase objects: after the test objects, where the guided tour ends with Pluto
const idx = join(DATA, 'targets.json'), list = JSON.parse(readFileSync(idx, 'utf8')).filter(t => t.slug !== slug);
// the objects of the guided tour first, in their order; what is not part of the tour after them
const all = [...list, entry], ordered = [...all.filter(t => !t.extra), ...all.filter(t => t.extra)];
writeFileSync(idx, JSON.stringify(ordered, null, 1));
console.log(`done: ${entry.summary.total} exposures`);

/** A body that stays in one field for days: the field, its exposures, its stars. */
async function crossing() {
  const t0 = mjdOf(B.from), t1 = mjdOf(B.to);
  const rows = await horizons(t0 - 3, t1 + 4, '6 h'), at = along(rows);
  const eph = rows.map(e => [+e.mjd.toFixed(4), +e.ra.toFixed(6), +e.dec.toFixed(6)]);
  const p0 = at(t0), p1 = at(t1), mid = at((t0 + t1) / 2);
  const ra = +((p0.ra + p1.ra) / 2).toFixed(6), dec = +((p0.dec + p1.dec) / 2).toFixed(6);
  const moved = Math.hypot((p1.ra - p0.ra) * Math.cos(dec * D2R), p1.dec - p0.dec) * 3600;
  console.log(`[${slug}] ${rows.length} points of its path from JPL Horizons; field at ${ra}, ${dec}; it moves ${moved.toFixed(0)}″ between ${B.from} and ${B.to}; magnitude ${mid.mag.toFixed(1)}, ${mid.r.toFixed(2)} au from the Sun, ${mid.delta.toFixed(2)} au from Earth`);

  // the exposures
  const found = await A.findFrames(ra, dec);
  let head = null;
  for (let det = 1; det <= 6; det++) {
    const lines = [], started = Date.now();
    await A.stream(ra, dec, B.size, det, l => {
      if (l.t === 'head') { head ??= l; lines.push(JSON.stringify(l)); }
      else if (l.t === 'frame') lines.push(stored(l));
      else if (l.t === 'done') { lines.push(JSON.stringify(l)); if (l.failed) console.log(`   D${det}: ${l.failed} exposures could not be read`); }
    }, undefined, found);
    write(det, lines);
    console.log(`   D${det}: ${lines.length - 2} exposures in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }

  // the stars of the field, for the overlays
  for (const [name, read] of [['gaia', () => Info.gaiaStars(ra, dec, B.size * 0.75 + 0.5)], ['catwise', () => Info.wiseSources(ra, dec, B.size * 0.75 + 0.5)]]) {
    try { const js = await read(); writeFileSync(join(dir, `${name}.json`), JSON.stringify(js)); console.log(`   ${name}: ${js.sources.length} sources`); }
    catch (e) { console.log(`   ${name}: not to be had (${e.message})`); }
  }

  const { command, from, to, number, ...words } = B;
  return { slug, query: B.label, ...words, ra, dec, size: B.size, built: new Date().toISOString().slice(0, 19) + 'Z',
    summary: { total: head.total, avail: head.avail, releases: head.releases, epochs: head.epochs },
    // what the body is, so that the page asks no catalogue of stars about this place
    info: { name: B.label, type: B.type, body: true },
    body: { number, mag: +mid.mag.toFixed(1), sun: +mid.r.toFixed(2), earth: +mid.delta.toFixed(2), moved: Math.round(moved), from: +t0.toFixed(3), to: +t1.toFixed(3), source: 'JPL Horizons' },
    eph };
}

/** A body that is followed: every exposure that had it in view, cut out around the place it had at that moment. */
async function followed() {
  const windows = B.visits.map(([a, b]) => [mjdOf(a), mjdOf(b)]), inVisit = mjd => windows.some(([a, b]) => mjd >= a && mjd <= b);
  const first = windows[0][0], last = windows[windows.length - 1][1];
  const rows = await horizons(first - 2, last + 20, '1 h'), at = along(rows);
  console.log(`[${slug}] ${rows.length} hourly points of its path from JPL Horizons, ${day(rows[0].mjd)} to ${day(rows[rows.length - 1].mjd)}`);

  // ---- the exposures that had it in view: anywhere on the image, also near its edge (the reader leaves out the ones that miss)
  const pts = []; let was = null;
  for (const r of rows) if (inVisit(r.mjd) && (!was || sepArcsec(r.ra, r.dec, was.ra, was.dec) > 1500)) { pts.push([r.ra, r.dec]); was = r; }
  const found = await A.findAlong(pts, mjd => { const p = inVisit(mjd) ? at(mjd) : null; return p ? [p.ra, p.dec] : null; }, undefined, 2.55);
  console.log(`   ${found.length} exposures with their centre within 2.55 degrees of it`);
  const n0 = A.makeGrid(0, 0, B.size).n, c0 = (n0 - 1) / 2, scale0 = A.makeGrid(0, 0, B.size).scale;
  const kept = [];
  let next = 0, missed = 0, failed = 0;
  const worker = async () => {
    while (next < found.length) {
      const f = found[next++];
      try {
        const r = await A.readFrame(f, ({ mjd, sc }) => { const p = at(mjd); if (!p) return null; const [ra, dec] = Bodies.fromSpacecraft(p.ra, p.dec, p.delta, sc); return A.makeGrid(ra, dec, B.size); });
        // kept when the exposure looked at the body itself: the pixels within 12 arcseconds of the centre, and half of the stamp
        let seen = 0, all = 0;
        if (r) for (let j = Math.floor(c0 - 4); j <= Math.ceil(c0 + 4); j++) for (let i = Math.floor(c0 - 4); i <= Math.ceil(c0 + 4); i++) {
          if (Math.hypot(i - c0, j - c0) * scale0 > 12) continue;
          all++; if (r.data[j * n0 + i] === r.data[j * n0 + i]) seen++;
        }
        if (!r || r.cov < 0.5 || seen < 0.9 * all) { missed++; continue; }
        kept.push(r);
        if (kept.length % 40 === 0) console.log(`   … ${kept.length} read`);
      } catch (e) { failed++; console.log(`   could not be read: ${f.id} D${f.det} (${e.message})`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  kept.sort((a, b) => a.mjd - b.mjd || a.det - b.det);
  console.log(`   ${kept.length} exposures show it; ${missed} missed it (it lay off the detector or on masked pixels); ${failed} could not be read`);

  // ---- the stars it passed in front of: how much light each adds inside the measuring circle of each exposure
  await starsBehind(kept);
  // ---- and what the pipeline itself marked there
  await faultsInside(kept, n0, scale0);

  // ---- the files, one for each detector
  const epochs = A.epochsOf(kept.map(r => r.mjd)), avail = {}, releases = {};
  for (let d = 1; d <= 6; d++) avail[d] = kept.filter(r => r.det === d).length;
  for (const r of kept) releases[r.coll] = (releases[r.coll] || 0) + 1;
  // the place the map goes to: where it was in the middle of its last visit
  const lastVisit = epochs[epochs.length - 1], home = at((lastVisit[0] + lastVisit[1]) / 2), ra = +home.ra.toFixed(6), dec = +home.dec.toFixed(6);
  const grid = A.makeGrid(ra, dec, B.size);
  for (let det = 1; det <= 6; det++) {
    const mine = kept.filter(r => r.det === det);
    write(det, [JSON.stringify({ t: 'head', det, grid: { ra: grid.ra, dec: grid.dec, n: grid.n, scale: grid.scale, size: grid.size }, band: A.DET_BANDS[det],
      total: kept.length, avail, releases, epochs, use: mine.length, found: mine.length }), ...mine.map(stored), JSON.stringify({ t: 'done', n: mine.length, skipped: 0, failed: 0 })]);
    console.log(`   D${det}: ${mine.length} exposures`);
  }

  // ---- what is told about each visit, from the same path
  const visits = epochs.map(([t0, t1]) => {
    const fr = kept.filter(r => r.mjd >= t0 && r.mjd <= t1), mid = (t0 + t1) / 2, p = at(mid), q = at(mid + 1 / 24), a = at(t0), z = at(t1);
    const dE = (((q.ra - p.ra + 540) % 360) - 180) * Math.cos(p.dec * D2R) * 3600, dN = (q.dec - p.dec) * 3600;
    return { t0: +t0.toFixed(4), t1: +t1.toFixed(4), exposures: fr.length, stops: new Set(fr.map(r => Movers.stopOf(r.id))).size,
      rate: +Math.hypot(dE, dN).toFixed(1), pa: Math.round((Math.atan2(dE, dN) / D2R + 360) % 360),          // arcseconds an hour; its direction, degrees from north through east
      sun: [+a.r.toFixed(2), +z.r.toFixed(2)], earth: [+a.delta.toFixed(2), +z.delta.toFixed(2)], ra: +p.ra.toFixed(5), dec: +p.dec.toFixed(5) };
  });
  // closest to the Sun and to the Earth, from the hourly path (only if the path reaches beyond those moments on both sides)
  const least = k => { let m = 0; rows.forEach((r, i) => { if (r[k] < rows[m][k]) m = i; }); return m > 0 && m < rows.length - 1 ? { mjd: +rows[m].mjd.toFixed(2), au: +rows[m][k].toFixed(3) } : null; };
  const peri = least('r'), near = least('delta');
  for (const v of visits) console.log(`   visit ${day(v.t0)} to ${day(v.t1)}: ${v.exposures} exposures at ${v.stops} stops; ${v.rate}″ an hour towards ${v.pa}°; ${v.sun.join('–')} au from the Sun, ${v.earth.join('–')} au from Earth`);
  if (peri) console.log(`   closest to the Sun ${day(peri.mjd)}: ${peri.au} au`);
  if (near) console.log(`   closest to Earth ${day(near.mjd)}: ${near.au} au`);
  // its path at the visits, every six hours, with its distance: for a field of another size at the same place, read live
  const eph = rows.filter((r, i) => i % 6 === 0 && windows.some(([a, b]) => r.mjd >= a - 1 && r.mjd <= b + 1)).map(e => [+e.mjd.toFixed(4), +e.ra.toFixed(6), +e.dec.toFixed(6), +e.delta.toFixed(5)]);

  const { command, visits: _v, ...words } = B;
  return { slug, query: B.label, ...words, ra, dec, size: B.size, built: new Date().toISOString().slice(0, 19) + 'Z',
    summary: { total: kept.length, avail, releases, epochs },
    info: { name: B.label, type: B.type, body: true },
    body: { id: B.command.replace(/^DES=|;$/g, ''), kind: 'comet', source: 'JPL Horizons', from: visits[0].t0, to: visits[visits.length - 1].t1, visits, ...(peri ? { peri } : {}), ...(near ? { near } : {}) },
    eph };
}

/**
 * The light that catalogued stars add inside the measuring circle (9.2 arcseconds) of each exposure of a followed
 * body, in millijansky at that exposure's wavelength: written to the record as `star` when it is worth a mention.
 * The stars come from Gaia DR3, 2MASS and CatWISE2020 (VizieR), asked once for every stop of the telescope.
 *   - Up to 2.6 microns a star's brightness is read between its 2MASS magnitudes J, H and Ks; a star too faint for
 *     2MASS gets them from its Gaia magnitude and colour (J = G − 0.26 − 0.9 (BP − RP), H = J − 0.5, Ks = J − 0.6).
 *   - Beyond 2.6 microns it is read between its CatWISE magnitudes W1 and W2; a star without them is taken to fade
 *     as the square of the wavelength from its Ks brightness.
 *   - A star off the centre adds the share of its light that falls inside the circle, for an image 4.4 arcseconds
 *     wide (one sigma): what the site's own measurements of single stars lose outside that circle.
 * It is an estimate, good enough to say which measurements a star has spoiled.
 */
async function starsBehind(kept) {
  const ZERO = { J: [1.235, 1594], H: [1.662, 1024], K: [2.159, 666.7], W1: [3.353, 309.54], W2: [4.603, 171.79] };          // microns; janskys at magnitude 0
  const mJy = (band, mag) => (mag === mag && mag != null ? ZERO[band][1] * 1e3 * 10 ** (-0.4 * mag) : NaN);
  const between = (pts, lam) => {          // straight in log-log between the points; level before the first; as 1/wavelength² after the last
    const v = pts.filter(p => p[1] > 0);
    if (!v.length) return 0;
    if (lam <= v[0][0]) return v[0][1];
    const z = v[v.length - 1];
    if (lam >= z[0]) return z[1] * (z[0] / lam) ** 2;
    let i = 1; while (v[i][0] < lam) i++;
    const t = Math.log(lam / v[i - 1][0]) / Math.log(v[i][0] / v[i - 1][0]);
    return Math.exp(Math.log(v[i - 1][1]) * (1 - t) + Math.log(v[i][1]) * t);
  };
  const SIGMA = 4.4, R = 9.2;
  const share = d => {          // of a star d arcseconds from the centre, the part inside the circle
    if (d > R + 4 * SIGMA) return 0;
    let inside = 0, total = 0;
    for (let y = -4 * SIGMA; y <= 4 * SIGMA; y += 0.4) for (let x = -4 * SIGMA; x <= 4 * SIGMA; x += 0.4) { const w = Math.exp(-(x * x + y * y) / (2 * SIGMA * SIGMA)); total += w; if (Math.hypot(x + d, y) <= R) inside += w; }
    return inside / total;
  };
  const HOSTS = ['https://vizier.cds.unistra.fr/viz-bin/asu-tsv', 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv'];
  const viz = async (source, ra, dec, radius, cols) => {
    const q = `?-source=${encodeURIComponent(source)}&-c=${ra.toFixed(6)}${dec >= 0 ? '%2B' : ''}${dec.toFixed(6)}&-c.rs=${radius.toFixed(0)}&-out=${cols.map(encodeURIComponent).join(',')}&-out.max=500`;
    let lastErr = null;
    for (const host of HOSTS) {
      try {
        const r = await realFetch(host + q, { headers: AGENT });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text(), lines = text.split('\n'), bar = lines.findIndex(l => /^-+(\t-+)*\s*$/.test(l));
        if (!/^#RESOURCE=/m.test(text) && bar < 2) throw new Error('not a table');          // an error page is no empty sky
        if (bar < 2) return [];
        const names = lines[bar - 2].split('\t').map(s => s.trim()), out = [];
        for (let i = bar + 1; i < lines.length && lines[i].trim(); i++) { const v = lines[i].split('\t'), o = {}; names.forEach((k, j) => { const x = (v[j] ?? '').trim(); o[k] = x === '' ? NaN : +x; }); out.push(o); }
        return out;
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  };
  const stops = new Map();
  for (const r of kept) { const k = Movers.stopOf(r.id); if (!stops.has(k)) stops.set(k, []); stops.get(k).push(r); }
  let marked = 0, asked = 0, lost = 0;
  const used = new Set();
  for (const fr of stops.values()) {
    const ra0 = fr.reduce((s, r) => s + r.c[0], 0) / fr.length, dec0 = fr.reduce((s, r) => s + r.c[1], 0) / fr.length;
    const reach = 40 + Math.max(...fr.map(r => sepArcsec(r.c[0], r.c[1], ra0, dec0)));
    let gaia, tm, cw;
    try {
      gaia = await viz('I/355/gaiadr3', ra0, dec0, reach, ['RA_ICRS', 'DE_ICRS', 'Gmag', 'BP-RP']);
      tm = await viz('II/246/out', ra0, dec0, reach, ['RAJ2000', 'DEJ2000', 'Jmag', 'Hmag', 'Kmag']);
      cw = (await viz('II/365/catwise', ra0, dec0, reach, ['RA_ICRS', 'DE_ICRS', 'W1mproPM', 'W2mproPM'])).map(s => ({ ra: s.RA_ICRS, dec: s.DE_ICRS, w1: s.W1mproPM, w2: s.W2mproPM }));
      if (cw.length) used.add('CatWISE2020');
      else {          // a mirror that does not hold CatWISE answers with an empty table: AllWISE then
        cw = (await viz('II/328/allwise', ra0, dec0, reach, ['RAJ2000', 'DEJ2000', 'W1mag', 'W2mag'])).map(s => ({ ra: s.RAJ2000, dec: s.DEJ2000, w1: s.W1mag, w2: s.W2mag }));
        if (cw.length) used.add('AllWISE');
      }
      asked++;
    } catch (e) { lost++; continue; }
    // the stars in the near infrared: 2MASS, and Gaia's stars that 2MASS does not have
    const near = tm.map(s => ({ ra: s.RAJ2000, dec: s.DEJ2000, pts: [[ZERO.J[0], mJy('J', s.Jmag)], [ZERO.H[0], mJy('H', s.Hmag)], [ZERO.K[0], mJy('K', s.Kmag)]] }));
    for (const s of gaia) {
      if (!(s.Gmag === s.Gmag) || near.some(t => sepArcsec(t.ra, t.dec, s.RA_ICRS, s.DE_ICRS) < 1.5)) continue;
      const J = s.Gmag - 0.26 - 0.9 * (s['BP-RP'] === s['BP-RP'] ? s['BP-RP'] : 1.4);
      near.push({ ra: s.RA_ICRS, dec: s.DE_ICRS, pts: [[ZERO.J[0], mJy('J', J)], [ZERO.H[0], mJy('H', J - 0.5)], [ZERO.K[0], mJy('K', J - 0.6)]] });
    }
    // and in the mid infrared: CatWISE, and the others faded from their Ks brightness
    const far = cw.map(s => ({ ra: s.ra, dec: s.dec, pts: [[ZERO.W1[0], mJy('W1', s.w1)], [ZERO.W2[0], mJy('W2', s.w2)]], rising: true }));
    for (const s of near) if (!far.some(t => sepArcsec(t.ra, t.dec, s.ra, s.dec) < 2.5)) far.push({ ra: s.ra, dec: s.dec, pts: [s.pts.filter(p => p[1] > 0).pop()].filter(Boolean) });
    for (const r of fr) {
      const lam = r.lam, list = lam < 2.6 ? near : far;
      let add = 0;
      for (const s of list) {
        const d = sepArcsec(s.ra, s.dec, r.c[0], r.c[1]);
        if (d > R + 4 * SIGMA) continue;
        // a star seen by WISE only and asked about short of its W1 band: brighter there, as 1/wavelength²
        const f = s.rising && lam < s.pts[0][0] && s.pts[0][1] > 0 ? s.pts[0][1] * (s.pts[0][0] / lam) ** 2 : between(s.pts, lam);
        add += f * share(d);
      }
      if (add >= 0.02) { r.star = +add.toFixed(3); marked++; }
    }
    await new Promise(done => setTimeout(done, 150));
  }
  console.log(`   stars behind it: Gaia DR3, 2MASS and ${[...used].join(' / ') || 'no WISE catalogue'} asked for ${asked} stops${lost ? `, not to be had for ${lost}` : ''}; ${marked} exposures with 0.02 mJy or more of starlight in the measuring circle`);
  if (lost) { console.error('   the star catalogues could not be reached for every stop: build again when they can'); process.exit(1); }
}

/**
 * What the pipeline marked inside the measuring circle of each exposure: where a quarter or more of the circle's
 * pixels carry a flag that says the pixel's value cannot be trusted, the record names those flags (`fault`).
 * A flagged jump in the signal (a cosmic-ray hit, which the processing repairs) and charge left over from an earlier
 * exposure are not counted: measurements with those in the circle agree with their neighbours in these data.
 */
async function faultsInside(kept, n, scale) {
  const BAD = ['NONFUNC', 'SUR_ERROR', 'COLD', 'HOT', 'MISSING_DATA', 'OVERFLOW'], c = (n - 1) / 2;
  let next = 0, marked = 0, unread = 0;
  const worker = async () => {
    while (next < kept.length) {
      const r = kept[next++];
      try {
        const res = await A.readFlags(r, { ra: r.c[0], dec: r.c[1], n, scale, size: B.size });
        const bits = res.planes.filter(p => BAD.includes(p.name)), count = new Map();
        let inside = 0;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          if (Math.hypot(i - c, j - c) * scale > 9.2) continue;
          inside++;
          for (const p of bits) if (res.bits[j * n + i] & (1 << p.bit)) count.set(p.name, (count.get(p.name) || 0) + 1);
        }
        const names = [...count].filter(([, k]) => k >= inside / 4).map(([name]) => name);
        if (names.length) { r.fault = names; marked++; }
      } catch (e) { unread++; }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`   the pipeline's flags: ${marked} exposures with a quarter or more of the measuring circle marked faulty${unread ? `; flags not to be read for ${unread}` : ''}`);
}
