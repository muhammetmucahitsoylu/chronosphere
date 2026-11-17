// Pre-build a body of the solar system as a showcase object, next to the test objects made by prebuild.py:
//
//     node scripts/build_body.mjs pluto
//
// A star stays where it is, so a showcase star is a place in the sky. A planet moves on, so a showcase body is a
// place and a time: the patch of sky it crossed during a few days, with the body's path through it.
//   - The path comes from JPL Horizons (seen from the centre of the Earth, one point every six hours).
//   - The field is centred between the body's places on the first and the last of those days.
//   - The exposures are read from NASA's open archive with the reader the site itself uses (web/js/archive.js),
//     and stored in the same form as the other showcase objects (web/data/<slug>/d1..d6.ndjson).
//   - The stars of the field (Gaia DR3, CatWISE2020) and the encyclopedia card are stored with it, so that the
//     guided tour needs no look-up at all.
// The entry in web/data/targets.json carries the path (`eph`: [[MJD, RA, Dec], …]), which the page follows.
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
const A = await load('archive.js'), C = await load('core.js'), Info = await load('info.js');

// ---- the path, from JPL Horizons
const mjdOf = iso => Date.parse(iso + (iso.includes('T') ? ':00Z' : 'T00:00:00Z')) / 864e5 + 40587;
const day = mjd => new Date((mjd - 40587) * 864e5).toISOString().slice(0, 10);
const t0 = mjdOf(B.from), t1 = mjdOf(B.to);
const q = new URLSearchParams({ format: 'json', COMMAND: `'${B.command}'`, OBJ_DATA: 'NO', MAKE_EPHEM: 'YES', EPHEM_TYPE: 'OBSERVER', CENTER: "'500@399'",
  START_TIME: `'${day(t0 - 3)}'`, STOP_TIME: `'${day(t1 + 4)}'`, STEP_SIZE: "'6 h'", QUANTITIES: "'1,9,19,20'", ANG_FORMAT: "'DEG'", CSV_FORMAT: "'YES'", EXTRA_PREC: "'YES'" });
const txt = (await (await realFetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + q, { headers: AGENT })).json()).result;
const soe = txt.indexOf('$$SOE'), eoe = txt.indexOf('$$EOE');
if (soe < 0) { console.error(txt.slice(0, 1200)); process.exit(1); }
// date, solar presence, lunar presence, RA, Dec, apparent magnitude, surface brightness, r, r-dot, delta, delta-dot
const rows = txt.slice(soe + 5, eoe).trim().split('\n').map(l => l.split(',').map(s => s.trim())).map(c => ({
  mjd: Date.parse(c[0].replace(/^(\d{4})-(\w{3})-(\d{2}) /, '$2 $3 $1 ') + ' UTC') / 864e5 + 40587, ra: +c[3], dec: +c[4], mag: +c[5], r: +c[7], delta: +c[9] })).filter(e => isFinite(e.mjd) && isFinite(e.ra));
const eph = rows.map(e => [+e.mjd.toFixed(4), +e.ra.toFixed(6), +e.dec.toFixed(6)]);
const at = mjd => { const i = Math.max(1, rows.findIndex(e => e.mjd > mjd)), a = rows[i - 1], b = rows[i], f = (mjd - a.mjd) / (b.mjd - a.mjd); return { ra: a.ra + f * (b.ra - a.ra), dec: a.dec + f * (b.dec - a.dec), mag: a.mag, r: a.r, delta: a.delta }; };
const p0 = at(t0), p1 = at(t1), mid = at((t0 + t1) / 2);
const ra = +((p0.ra + p1.ra) / 2).toFixed(6), dec = +((p0.dec + p1.dec) / 2).toFixed(6);
const moved = Math.hypot((p1.ra - p0.ra) * Math.cos(dec * Math.PI / 180), p1.dec - p0.dec) * 3600;
console.log(`[${slug}] ${rows.length} points of its path from JPL Horizons; field at ${ra}, ${dec}; it moves ${moved.toFixed(0)}″ between ${B.from} and ${B.to}; magnitude ${mid.mag.toFixed(1)}, ${mid.r.toFixed(2)} au from the Sun, ${mid.delta.toFixed(2)} au from Earth`);

// ---- the exposures
const dir = join(DATA, slug);
mkdirSync(dir, { recursive: true });
const found = await A.findFrames(ra, dec);
let head = null;
for (let det = 1; det <= 6; det++) {
  const lines = [], started = Date.now();
  await A.stream(ra, dec, B.size, det, l => {
    if (l.t === 'head') { head ??= l; lines.push(JSON.stringify(l)); }
    else if (l.t === 'frame') { const { data, ...rest } = l; lines.push(JSON.stringify({ ...rest, b64: C.encodeF16(data) })); }
    else if (l.t === 'done') { lines.push(JSON.stringify(l)); if (l.failed) console.log(`   D${det}: ${l.failed} exposures could not be read`); }
  }, undefined, found);
  writeFileSync(join(dir, `d${det}.ndjson`), lines.join('\n') + '\n');
  console.log(`   D${det}: ${lines.length - 2} exposures in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

// ---- the stars of the field, for the overlays
for (const [name, read] of [['gaia', () => Info.gaiaStars(ra, dec, B.size * 0.75 + 0.5)], ['catwise', () => Info.wiseSources(ra, dec, B.size * 0.75 + 0.5)]]) {
  try { const js = await read(); writeFileSync(join(dir, `${name}.json`), JSON.stringify(js)); console.log(`   ${name}: ${js.sources.length} sources`); }
  catch (e) { console.log(`   ${name}: not to be had (${e.message})`); }
}

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

// ---- the entry in the list of showcase objects: after the test objects, where the guided tour ends with it
const { command, from, to, number, ...words } = B;
const entry = { slug, query: B.label, ...words, ra, dec, size: B.size, built: new Date().toISOString().slice(0, 19) + 'Z',
  summary: { total: head.total, avail: head.avail, releases: head.releases, epochs: head.epochs },
  // what the body is, so that the page asks no catalogue of stars about this place
  info: { name: B.label, type: B.type, body: true },
  body: { number, mag: +mid.mag.toFixed(1), sun: +mid.r.toFixed(2), earth: +mid.delta.toFixed(2), moved: Math.round(moved), from: +t0.toFixed(3), to: +t1.toFixed(3), source: 'JPL Horizons' },
  eph, ...(wikiCard ? { wikiCard } : {}) };
const idx = join(DATA, 'targets.json'), list = JSON.parse(readFileSync(idx, 'utf8')).filter(t => t.slug !== slug);
writeFileSync(idx, JSON.stringify([...list, entry], null, 1));
console.log(`done: ${head.total} exposures of this field in the archive`);
