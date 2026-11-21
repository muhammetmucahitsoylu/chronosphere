import * as C from './core.js';
import { Plot, dateTicks } from './plot.js';
import * as Sky from './sky.js';
import * as Info from './info.js';
import { buildTour } from './tour.js';
import { SHEETS, NAV } from './pages.js';
import * as Archive from './archive.js';
import * as Movers from './movers.js';
import * as Bodies from './bodies.js';
import * as Lang from './lang.js';
import * as Years from './years.js';

const T = Lang.t, G = Lang.G;          // the words of the front page, the tour and the walk through the panel, in the language in use
const PAGE_FILES = { planetx: 'planet-x.html', hunt: 'find-asteroids.html', spherex: 'what-is-spherex.html', how: 'how-it-works.html', about: 'about.html' };
const OBJECT_FILES = { barnard: 'barnards-star.html', epsindib: 'epsilon-indi-b.html', wise0855: 'wise-0855.html', rwaur: 'rw-aurigae.html', rdra: 'r-draconis.html', pluto: 'pluto.html', '3i-atlas': '3i-atlas.html' };
/**
 * A showcase body that is followed, when a typed text names it: one of its names (`aka` in the list of objects) as the
 * whole text or at its start ("3I", "3I/ATLAS (C/2025 N1)"), also after a word or two that say what it is ("comet 3I").
 */
const followedNamed = text => {
  const fold = v => String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const said = fold(text), tries = [said, said.replace(/^\S+ /, ''), said.replace(/^\S+ \S+ /, '')];
  return S.targets.find(t => t.follow && [t.label, ...(t.aka || [])].some(n => { const a = fold(n); return tries.some(v => v === a || (v.startsWith(a) && !/[a-z0-9]/.test(v[a.length]))); })) || null;
};

const API = (window.CHRONO_API || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const yearNow = C.epochNow;
const NUM = new Intl.NumberFormat('en'), NUM2 = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });      // made once: making one per number is slow
const nExp = n => Lang.N(n, 'exposure');
// The showcase objects that have a name of their own in other languages (the tour's ladder of brightness names them).
const NAMED = { barnard: 'ladder.r3', pluto: 'ladder.r4' };
const nameOf = t => (NAMED[t.slug] && Lang.lang !== 'en' ? T(NAMED[t.slug]) : t.label);
// SPHEREx's survey began at the end of April 2025: the path of a body of the solar system is asked for from then until today.
const SURVEY0 = 60785, surveyDays = () => Math.ceil(Date.now() / 864e5 + 40587 - SURVEY0) + 1;

const MODES = {
  epochs: G`One stacked image per SPHEREx visit to this spot, played in a loop. Anything that moved between visits jumps.`,
  years: G`The same patch of sky over a quarter of a century: 2MASS (1997 to 2001), WISE in 2010 and every half year from 2014 to 2024 (NEOWISE), then each SPHEREx visit, every telescope in its band nearest to this detector. A star that moves walks across the field; one too cold for the shorter wavelengths shows only at the longer ones.`,
  frames: G`Every single exposure in time order. Each one sees the sky at a slightly different wavelength, so stars flicker naturally.`,
  color: G`Time shown as colour: first visit in red, last in blue. Stars that stayed put look white; anything that moved or changed splits into colours.`,
  diff: G`A later visit minus an earlier one. Steady stars mostly cancel, leaving at most a faint smudge; a moving object leaves a strong dark-and-bright pair.`,
  deep: G`All exposures of this detector added together: the deepest, cleanest image.`,
  bands: G`The same patch of sky in each of the six detectors, from 0.75 to 5 microns, then all six as one colour picture (short wavelengths blue, long red). Cold objects only appear at the long end.`,
  trail: G`One image for every stop of the telescope that caught this body, in time order. The stars stay where they are; the body moves on.`,
};

// The Years view of a place that has no images built for it: the sky maps of the older telescopes.
const YEARS_MAPS = G`This place as 2MASS saw it (1997 to 2001) and as WISE saw it (2010), from the sky maps that NASA/IPAC serves, then each SPHEREx visit: every telescope in its band nearest to this detector. The older pictures are shown as their makers stretched them: where a star’s light lies is measured on them, not how bright it is.`;

// The same views of a body that is followed (every exposure cut out around the body itself): what each one shows then.
const FOLLOWED = {
  epochs: G`One stacked image for each visit of SPHEREx to the comet, on one scale of brightness. Every exposure is cut out around the comet, so the stars behind it differ from one exposure to the next and drop out of the stack.`,
  frames: G`Every single exposure in time order, each cut out around the comet and each at a slightly different wavelength. The comet stays in the middle; the stars behind it change.`,
  bands: G`The comet in each of the six detectors, from 0.75 to 5 microns, then all six as one colour picture (short wavelengths blue, long red): the exposures of its last visit, stacked.`,
  trail: G`One image for every stop of the telescope that caught the comet, each cut out around it: the comet stays in the middle, the stars behind it change from stop to stop.`,
};

const S = {
  targets: [], target: null, track: null, ra: 0, dec: 0, size: 5,
  head: null, grid: null, det: 2, dets: {}, mode: 'epochs',
  seq: [], idx: 0, playing: false, fps: 2, timer: null,
  sel: null, view: { z: 1, cx: 0, cy: 0 }, white: 0, invert: false, smooth: false, mask: false,
  showGaia: true, marks: true, busyUntil: 0, gaia: null, off: new Set(), abort: null, deep: null, hi: 1, gen: 0,
  info: null, infoState: 'idle', wiki: null, openTok: 0, showBands: true, embed: false, find: {}, years: null, yearsIdx: {},
};

const cv = $('sky'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'), octx = off.getContext('2d');
const specPlot = new Plot($('spec'), $('spec').nextElementSibling);
const lcPlot = new Plot($('lc'), $('lc').nextElementSibling);

// ------------------------------------------------------------ loading
const isPreset = () => !!(S.target && S.size === S.target.size);
/** A showcase body whose every exposure is cut out around the body itself (scripts/build_body.mjs): it stays in the middle, the stars behind it change. */
const followed = () => !!S.target?.follow && isPreset();
/** The objects of the guided tour: the showcase objects without the ones that stand beside it. */
const tourTargets = () => S.targets.filter(t => !t.extra);
/** The size of field for the next object: the one chosen in the menu, or the one that was chosen before a followed body set its own. */
const fovPick = () => +(S.fovKept ?? $('fov').value);
/** Where the sky is taken for a measurement: a ring 18″ to 30″ from the spot; around a followed comet, whose glow reaches far, 100″ to 140″. */
const skyRing = () => (followed() ? [100, 140] : [18, 30]);
/** The Years view: for a showcase star with images built for it, and for any other place (sky maps); not for bodies of the solar system. */
const yearsOk = () => !!S.grid && !followed() && !S.track?.eph && !S.hunt && (isPreset() ? !!S.yearsIdx?.[S.target.slug] : true);
/** The grid the images on show are laid on: in the Years view of a showcase star, a wider one of its own (the star walks across it). */
const vg = () => (S.mode === 'years' && S.years?.grid) || S.grid;
/**
 * A measurement of a followed body in which something else has a part: catalogued stars behind it that add a quarter
 * or more of the light measured ('star'), or pixels that the pipeline marks as faulty over a quarter of the circle
 * ('fault'). Both come with the exposure, worked out when the object was built (scripts/build_body.mjs).
 */
const spoiledBy = (f, a) => (f.fault ? 'fault' : f.star >= 0.25 * Math.max(a.flux, 3 * a.err) ? 'star' : null);
/** Address of a showcase file. It carries the build date, so a rebuilt showcase is fetched afresh. */
const dataUrl = (t, file) => `data/${t.slug}/${file}?v=${encodeURIComponent(t.built || '')}`;

// Finished live queries are kept on this device, so a repeat visit is instant and works offline.
const liveKey = (ra, dec, size, det) => `${ra.toFixed(5)}_${dec.toFixed(5)}_${size}_${det}`;
const Store = {
  name: 'chrono-live-v1', max: 120,
  async has(key) { try { return !!(await (await caches.open(this.name)).match(`./__live/${key}`)); } catch { return false; } },
  async get(key) {
    try {
      const c = await caches.open(this.name), r = await c.match(`./__live/${key}`);
      return r ? (await r.text()).split('\n').filter(Boolean).map(l => JSON.parse(l)) : null;
    } catch { return null; }
  },
  async put(key, lines) {
    try {
      const text = lines.filter(l => l.t !== 'skip').map(l => {
        if (l.t !== 'frame') return JSON.stringify(l);
        const { data, ...rest } = l;
        return JSON.stringify({ ...rest, b64: C.encodeF16(data) });
      }).join('\n');
      const c = await caches.open(this.name);
      await c.put(`./__live/${key}`, new Response(text, { headers: { 'content-type': 'application/x-ndjson' } }));
      const keys = await c.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - this.max))) await c.delete(k);
    } catch { /* storage full or unavailable: nothing to do */ }
  },
};

async function go({ ra, dec, size, target = null, track = null, det, mode, info = null, hunt = null, fly = true, keepZoom = false }) {
  coachEnd();
  S.abort?.abort(); S.abort = new AbortController();
  const gen = ++S.gen;
  stop();
  Object.assign(S, { ra, dec, size: size || 5, target, track: track || (target && (target.eph ? { name: target.label, eph: target.eph } : target.resolved)) || null,
    head: null, grid: null, dets: {}, seq: [], idx: 0, sel: null, gaia: null, catwise: null, deep: null, off: new Set(), stacks: null, epochs: null, pts: [], bandCache: {}, stackCache: {}, haloDets: [], years: null });
  S.info = info; S.infoState = info ? 'done' : 'loading'; S.wiki = null; S.found = null; S.moved = null; S.find = {};
  S.movers = null; S.bodyMemo = null; S.scMemo = null; S.hunt = hunt; S.expect = null;
  S.detPicked = !!det; S.autoNote = '';
  S.wantPlay = !calmMotion();          // the sequence starts playing by itself once it has loaded
  S.busyUntil = performance.now() + 9000;
  if (det) S.det = det;
  if (mode && MODES[mode]) S.mode = mode;
  if (Sky.isReady()) {
    // The panel opens (which changes the size of the map) and the map goes to the object, as one move.
    const opening = $('app').dataset.panel !== 'open';
    // A visitor who has zoomed in closer than the usual view of an object and clicks a star stays that close.
    const zoomNow = Sky.fov(), width = w => (keepZoom ? clamp(zoomNow, 0.12, Sky.objectFov(S.size, w)) : Sky.objectFov(S.size, w));
    if (fly) Sky.flyTo(ra, dec, width, { layout: opening ? openPanel : null });
    else if (opening) Sky.reshape(openPanel);
    Sky.mark(ra, dec, S.size, target ? nameOf(target) : info ? info.name : track?.name || '');
  }
  openPanel();
  const mapFirst = Sky.isReady() ? Promise.race([Sky.onItsWay(), nap(450)]) : null;
  loadInfo(gen);
  // A followed body has one size of field, its own: the size the visitor had chosen comes back with the next object.
  if (followed()) S.fovKept ??= $('fov').value; else S.fovKept = null;
  $('fov').value = String(S.size);
  $('notice').hidden = true; S.failed = null; $('reportask').hidden = true;
  syncUrl(); renderChips(); renderAbout(); renderModes(); renderDets(); show(); refreshPlots(); renderHunt(); renderMovers();
  setStatus(G`Finding the exposures that cover this spot…`);
  if (!followed()) loadCatalog(gen);          // a followed body has different stars behind it in every exposure: none are marked
  try {
    if (S.showWise && !followed()) setTimeout(loadCatwise, 1500);
    // The map and the images want the same processor: the map goes first (it needs a fraction of a second).
    if (mapFirst) { await mapFirst; if (gen !== S.gen) return; }
    await loadDet(S.det, gen);
    if (gen !== S.gen) return;
    if (!S.head || !S.head.total) return;
    for (let d = 1; d <= 6; d++) {
      if (gen !== S.gen) return;
      if (!S.dets[d] && +S.head.avail[d] > 0) await loadDet(d, gen);
    }
    if (gen === S.gen) { setStatus(''); autoDetector(); renderMotion(); maybeAutoplay(); if (!followed()) findBodies(gen); }
  } catch (e) {
    if (e.name === 'AbortError' || gen !== S.gen) return;
    console.error(e);
    // Say what happened and offer to try again; a returning connection retries by itself.
    const retry = () => go({ ra, dec, size: S.size, target, track, det: S.det, mode: S.mode, info, hunt, fly: false });
    S.failed = retry;
    setStatus(''); renderHunt();
    const el = $('notice');
    el.innerHTML = G`${S.head ? G`The connection dropped while the images were loading.` : G`NASA’s open archive could not be reached just now.`} Objects you have already opened still work offline.<br><button type="button">Try again</button>`;
    el.hidden = false;
    el.querySelector('button').onclick = retry;
    refreshPlots();
  }
}
window.addEventListener('online', () => { if (S.failed) S.failed(); });

async function loadDet(det, gen) {
  const D = S.dets[det] = { frames: [], total: 0, done: false, loading: true };
  renderDets();
  let last = 0;
  const handle = line => {
    if (gen !== S.gen) return;
    if (line.t === 'head') {
      D.found = line.found; D.total = line.use ?? Math.min(line.found ?? line.total, 160);   // exposures coming for this detector
      if (!S.head) {
        const raw = line.epochs || [];
        line.epochs = C.refineEpochs(raw); line.split = line.epochs.length > raw.length;     // a long continuous visit, cut into months
        S.head = line; S.grid = line.grid;
        resetView();
        renderReleases(); renderAbout();
        if (!line.total && !+line.avail[det]) {
          const other = [1, 2, 3, 4, 5, 6].find(d => +line.avail[d] > 0);
          if (!other) setStatus(G`SPHEREx has no public exposures at this position yet.`);
        }
      }
      renderDets();
    } else if (line.t === 'frame') {
      if (line.b64) { line.data = C.decodeF16(line.b64); delete line.b64; }
      D.frames.push(line);
      const now = performance.now();
      if (now - last > 600) { last = now; onData(det); }
    } else if (line.t === 'skip') {
      D.total = Math.max(D.frames.length, D.total - 1);     // an exposure that turned out not to cover the spot
    } else if (line.t === 'done') {
      D.done = true; D.loading = false; onData(det);
    }
  };
  if (isPreset()) {
    await C.loadStream(dataUrl(S.target, `d${det}.ndjson`), handle, S.abort.signal);
  } else {
    const key = liveKey(S.ra, S.dec, S.size, det);
    const cached = await Store.get(key);
    if (cached) cached.forEach(handle);
    else {
      try {
        // Straight from NASA's open data, in this browser: no server of ours is involved.
        S.found ??= Archive.findFrames(S.ra, S.dec, S.abort.signal);
        S.found.then(v => { if (gen === S.gen && !S.expect) { S.expect = {}; for (const f of v) if (f.dist <= 1.75) S.expect[f.det] = (S.expect[f.det] || 0) + 1; renderHunt(); } }).catch(() => {});
        const lines = [];
        await Archive.stream(S.ra, S.dec, S.size, det, line => { lines.push(line); handle(line); }, S.abort.signal, await S.found);
        if (gen === S.gen) Store.put(key, lines);
      } catch (e) {
        if (e.name === 'AbortError' || !API) throw e;
        await C.loadStream(`${API}/api/stream?ra=${S.ra.toFixed(6)}&dec=${S.dec.toFixed(6)}&size=${S.size}&det=${det}`, handle, S.abort.signal);
      }
    }
  }
  D.loading = false; D.frames.sort((a, b) => a.mjd - b.mjd);
  // Empty detector: fall forward to one that has data.
  if (gen === S.gen && det === S.det && !D.frames.length && S.head) {
    const other = [1, 2, 3, 4, 5, 6].find(d => +S.head.avail[d] > 0 && d !== det);
    if (other) { S.det = other; syncUrl(); }
  }
  renderDets();
}

function onData(det) {
  const D = S.dets[det];
  D.frames.sort((a, b) => a.mjd - b.mjd);
  if (det === S.det) {
    setStatus(D.done ? '' : G`Loading detector ${det}: ${D.frames.length} of ${D.total} exposures`, D.done ? 0 : D.frames.length / Math.max(1, D.total));
    rebuild();
  } else if ((S.mode === 'bands' || S.mode === 'trail') && D.done) { rebuild();
  } else if (!S.dets[S.det]?.loading) {
    setStatus(D.done ? '' : G`Loading detector ${det} for the spectrum: ${D.frames.length} of ${D.total}`, D.done ? 0 : D.frames.length / Math.max(1, D.total));
  }
  renderDets();
  refreshPlots();
  renderHunt();
  if (D.done) maybeAutoplay();
}

/**
 * Once everything has arrived: if the detector in use cannot show the target (its core is saturated
 * there, or it is too faint to see), move to the one that shows it best. Never after the visitor
 * has chosen a detector, and never for the showcase objects, whose view is chosen by hand.
 */
function autoDetector() {
  if (S.detPicked || isPreset() || !S.grid || !S.sel) return;
  const pts = measureAll(), med = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const score = d => {                       // typical signal-to-noise of the target in a detector; saturated ones do not count
    const v = pts.filter(p => p.det === d && !p.halo);
    return v.length >= 5 ? med(v.map(p => p.flux / p.err)) : 0;
  };
  const here = score(S.det), sat = (S.haloDets || []).includes(S.det);
  if (!sat && here >= 5) return;
  const others = [1, 2, 3, 4, 5, 6].filter(d => d !== S.det), flux = d => med(pts.filter(p => p.det === d).map(p => p.flux));
  const good = others.filter(d => score(d) >= 15).sort((a, b) => flux(a) - flux(b));
  const best = good[0] || others.sort((a, b) => score(b) - score(a))[0];
  if (!best || score(best) < 8) return;
  S.autoNote = sat ? G`Showing D${best}: in D${S.det} the star's core is saturated.` : G`Showing D${best}: the spot is too faint to see in D${S.det}.`;
  S.det = best; S.seq = []; S.idx = 0;
  renderDets(); rebuild(); refreshPlots(); syncUrl();
}

/** Start the sequence by itself, once, when everything it needs has arrived. */
function maybeAutoplay() {
  if (!S.wantPlay || !S.head || S.playing) return;
  const ready = S.mode === 'bands' || S.mode === 'trail'
    ? [1, 2, 3, 4, 5, 6].every(d => !+S.head.avail[d] || S.dets[d]?.done)
    : S.mode === 'years' ? !!S.dets[S.det]?.done && !!S.years?.frames && !S.years.busy          // the Years view waits for its older images too
    : !!S.dets[S.det]?.done;
  if (!ready) return;
  S.wantPlay = false;
  if (S.seq.length > 1) play();
}

async function loadCatalog(gen) {
  try {
    let js;
    if (isPreset()) js = await (await fetch(dataUrl(S.target, 'gaia.json'), { signal: S.abort.signal })).json();
    else if (API) js = await (await fetch(`${API}/api/catalog?ra=${S.ra.toFixed(5)}&dec=${S.dec.toFixed(5)}&size=${S.size}&cat=gaia`, { signal: S.abort.signal })).json();
    else {                                                                  // Gaia DR3 from VizieR; if that fails, stars with known motion from SIMBAD
      const r = S.size * 0.75 + 0.5;
      js = await Info.gaiaStars(S.ra, S.dec, r).catch(() => null);
      if (!js || !js.sources.length) js = await Info.fieldStars(S.ra, S.dec, r);
    }
    if (gen === S.gen && js) { S.gaia = js; paint(); }
  } catch { /* overlay is optional */ }
}
async function loadCatwise() {
  if (S.catwise || !S.grid || followed()) return;
  const gen = S.gen;
  try {
    setStatus(G`Loading WISE sources…`);
    let js;
    if (isPreset()) js = await (await fetch(dataUrl(S.target, 'catwise.json'), { signal: S.abort.signal })).json();
    else if (API) js = await (await fetch(`${API}/api/catalog?ra=${S.ra.toFixed(5)}&dec=${S.dec.toFixed(5)}&size=${S.size}&cat=catwise`, { signal: S.abort.signal })).json();
    else js = await Info.wiseSources(S.ra, S.dec, S.size * 0.75 + 0.5);
    if (gen === S.gen) { S.catwise = js; setStatus(''); paint(); }
  } catch { setStatus(G`The WISE catalogue could not be reached just now.`); }
}

// ------------------------------------------------------------ sequence
const usable = det => (S.dets[det]?.frames || []).filter(f => !S.off.has(f.coll) && f.cov >= 0.5);
function gEpoch(mjd) {
  const eps = S.head?.epochs || [];
  for (let i = 0; i < eps.length; i++) if (mjd >= eps[i][0] && mjd <= eps[i][1]) return i;
  let best = 0, bd = Infinity;
  for (let i = 0; i < eps.length; i++) { const d = Math.min(Math.abs(mjd - eps[i][0]), Math.abs(mjd - eps[i][1])); if (d < bd) { bd = d; best = i; } }
  return best;
}
const epochColor = mjd => C.EPOCH_COLORS[gEpoch(mjd) % C.EPOCH_COLORS.length];

function rebuild() {
  if (!S.grid) return;
  if (S.mode === 'trail' && S.sel && !bodyStops()) S.mode = 'epochs';          // nothing is being followed any more
  const own = followed();
  if (own && ['color', 'diff', 'deep'].includes(S.mode)) S.mode = 'epochs';    // views that set one patch of sky against itself: a followed body has no such patch
  if (S.mode === 'years' && !yearsOk()) S.mode = 'epochs';
  const fresh = S.mode !== S.builtMode; S.builtMode = S.mode;
  const n = S.grid.n, npx = n * n, frames = usable(S.det);
  const keepMjd = S.seq[S.idx]?.mjd, keepDet = S.seq[S.idx]?.det;
  // Group by the archive-wide observing seasons so every detector agrees on what "season 2" is.
  const byEp = new Map();
  for (const f of frames) { const k = gEpoch(f.mjd); if (!byEp.has(k)) byEp.set(k, []); byEp.get(k).push(f); }
  S.epochs = [...byEp.keys()].sort((a, b) => a - b).map(k => {
    const fr = byEp.get(k); return { i: k, frames: fr, t0: fr[0].mjd, t1: fr[fr.length - 1].mjd, mid: (fr[0].mjd + fr[fr.length - 1].mjd) / 2 };
  });
  const stacks = S.epochs.map(e => {
    const img = C.medianStack(e.frames, npx), st = C.robustStats(img);
    return { kind: 'stack', img, sig: st.sig, top: Math.max(st.p(0.997), 25 * st.sig), mjd: e.mid, n: e.frames.length, ep: e,
      title: `${S.head?.split ? '' : G`Visit ${gEpoch(e.mid) + 1} · `}${C.fmtMonth(e.mid)}`, sub: `${nExp(e.frames.length)} · ${C.fmtRange(e.t0, e.t1)}` };
  });
  // A followed body: its visits are shown on one scale of brightness, the brightest visit's, so that a visit in which it was faint looks faint.
  if (own && stacks.length) { const top = Math.max(...stacks.map(st => st.top)); for (const st of stacks) st.hi = top; }
  S.stacks = stacks;
  const deepFrames = frames.length > 80 ? frames.filter((_, i) => i % Math.ceil(frames.length / 80) === 0) : frames;
  S.deep = frames.length ? C.medianStack(deepFrames, npx) : null;
  if (S.deep) {
    const st = C.robustStats(S.deep);
    S.deepSig = st.sig; S.hi = Math.max(st.p(0.997), 25 * st.sig);
  }
  let seq = [];
  if (S.mode === 'frames') {
    seq = frames.map(f => ({ kind: 'frame', img: f.data, sig: f.sig, mjd: f.mjd, frame: f,
      ...(own ? { hi: stacks.find(st => st.ep.i === gEpoch(f.mjd))?.top } : {}),          // each exposure of a followed body on the scale of its own visit
      title: C.fmtDate(f.mjd, true), sub: `${lamAt(f).toFixed(3)} µm · ${f.id}` }));
  } else if (S.mode === 'epochs') seq = stacks;
  else if (S.mode === 'years') seq = yearsSeq(stacks);
  else if (S.mode === 'deep') {
    if (S.deep) seq = [{ kind: 'stack', img: S.deep, sig: S.deepSig, mjd: frames[frames.length >> 1].mjd, n: frames.length,
      title: G`Deep sum`, sub: G`${nExp(frames.length)}, all visits` }];
  } else if (S.mode === 'bands') {
    S.bandCache = S.bandCache || {};
    const per = {};
    for (let d = 1; d <= 6; d++) {
      // a followed body is bright at one visit and faint at another: its last visit is shown, not a mix of the two
      const all = usable(d), lastEp = own && all.length ? gEpoch(all[all.length - 1].mjd) : -1, fr = own ? all.filter(f => gEpoch(f.mjd) === lastEp) : all; if (!fr.length) continue;
      const key = `${S.gen}:${fr.length}:${S.off.size}`;
      if (S.bandCache[d]?.key !== key) {
        const sub = fr.length > 80 ? fr.filter((_, i) => i % Math.ceil(fr.length / 80) === 0) : fr;
        const img = C.medianStack(sub, npx), st = C.robustStats(img);
        S.bandCache[d] = { key, kind: 'stack', det: d, img, sig: st.sig, hi: Math.max(st.p(0.997), 25 * st.sig), mjd: fr[fr.length >> 1].mjd,
          n: fr.length, title: G`${C.DET_BANDS[d][0]} to ${C.DET_BANDS[d][1]} µm`, sub: own ? `${nExp(fr.length)} · ${C.fmtRange(fr[0].mjd, fr[fr.length - 1].mjd)}` : G`${nExp(fr.length)}, all visits` };
      }
      per[d] = S.bandCache[d]; seq.push(per[d]);
    }
    const R = per[6] || per[5], Gn = per[4] || per[3], B = per[2] || per[1];
    if (R && Gn && B && R !== Gn && Gn !== B) seq.push({ kind: 'rgb', rgb: [R, Gn, B], mjd: Gn.mjd, det: 0, title: G`Infrared colour`,
      sub: G`blue D${B.det} · green D${Gn.det} · red D${R.det}` });
  } else if (S.mode === 'color') {
    if (stacks.length >= 2) {
      const a = stacks[0], b = stacks[stacks.length - 1], m = stacks.length > 2 ? stacks[stacks.length >> 1] : null;
      seq = [{ kind: 'rgb', rgb: [a, m, b], mjd: b.mjd, title: G`Time as colour`,
        sub: m ? G`red ${C.fmtMonth(a.mjd)} · green ${C.fmtMonth(m.mjd)} · blue ${C.fmtMonth(b.mjd)}` : G`red ${C.fmtMonth(a.mjd)} · cyan ${C.fmtMonth(b.mjd)}` }];
    }
  } else if (S.mode === 'trail') {
    // One image per stop of the telescope that caught the body: the exposures of that stop in one detector, combined.
    // The detector in use decides which half of the camera is shown (D1 to D3, or D4 to D6).
    for (const q of bodyStops() || []) {
      const d = q.dets.find(x => (x <= 3) === (S.det <= 3)) ?? q.dets[0], fr = usable(d).filter(f => Movers.stopOf(f.id) === q.stop);
      if (!fr.length) continue;
      const img = fr.length >= 3 ? C.medianStack(fr, npx) : fr.length === 2 ? Float32Array.from(fr[0].data, (v, p) => (fr[1].data[p] < v ? fr[1].data[p] : v)) : fr[0].data;
      const st = C.robustStats(img);
      seq.push({ kind: 'stack', det: d, img, sig: st.sig, hi: Math.max(st.p(0.997), 25 * st.sig), mjd: q.mjd, n: fr.length, at: q,
        title: C.fmtDate(q.mjd, true), sub: `${nExp(fr.length)} · ${lamRange(fr)}` });
    }
  } else if (S.mode === 'diff') {
    const pair = (a, b) => {
      const img = C.subtract(b.img, a.img);
      return { kind: 'diff', img, sig: C.robustStats(img).sig, mjd: b.mjd, title: G`${C.fmtMonth(b.mjd)} minus ${C.fmtMonth(a.mjd)}`, sub: G`white = brighter later, black = brighter earlier` };
    };
    for (let i = 1; i < stacks.length; i++) seq.push(pair(stacks[i - 1], stacks[i]));
    if (stacks.length > 2) seq.push(pair(stacks[0], stacks[stacks.length - 1]));
  }
  S.seq = seq;
  if (S.viewOf !== vg()) { S.viewOf = vg(); resetView(); }          // the Years view of a showcase star has a grid of its own
  let idx = 0;
  if (keepMjd !== undefined && seq.length && !(fresh && S.mode === 'years')) {          // the Years view starts at its oldest image
    let bd = Infinity;
    seq.forEach((it, i) => { const d = Math.abs(it.mjd - keepMjd); if (d < bd) { bd = d; idx = i; } });
  }
  if (S.mode === 'bands' && seq.length) {     // stay on the same detector; start on the colour picture
    const want = keepDet !== undefined ? keepDet : 0;
    let i = seq.findIndex(it => it.det === want);
    if (i < 0) i = seq.findIndex(it => it.det === S.det);
    idx = i < 0 ? seq.length - 1 : i;
  }
  S.idx = clamp(idx, 0, Math.max(0, seq.length - 1));
  if (!S.sel && !S.hunt) defaultSelection();          // on a hunt nothing is circled until a body has been found
  $('seek').max = Math.max(0, seq.length - 1);
  renderModes(); renderMotion(); renderScan(); renderYears();
  show();
}

// ------------------------------------------------------------ the Years view
/** The images of the Years view for the detector in use: 2MASS and WISE in their bands nearest to it, then SPHEREx. */
function yearsSeq(stacks) {
  const Y = S.years, [b2, bw] = Years.NEAR[S.det];
  if (!Y || Y.need !== S.det) loadYears();
  if (!S.years?.frames) return [];
  const Z = S.years;
  const old = Z.frames.filter(f => f.survey !== 'SPHEREx' && (f.band === b2 || f.band === bw));
  const now = Z.src === 'built' ? Z.frames.filter(f => f.survey === 'SPHEREx' && f.det === S.det && f.n >= 5)          // a visit of fewer exposures is too noisy to set beside the others
    : stacks.map(st => ({ survey: 'SPHEREx', det: S.det, mjd: st.mjd, t0: st.ep.t0, t1: st.ep.t1, n: st.n, img: st.img, sig: st.sig, hi: st.top }));
  return [...old, ...now].sort((a, b) => a.mjd - b.mjd).map(f => {
    if (f.pic && f.lo === undefined) { const st = C.robustStats(f.img); f.lo = st.med; f.top = Math.max(st.p(0.999), st.med + 40); f.sig = st.sig; }          // a picture is drawn from its sky to its brightest stars
    const { title, sub } = Years.caption(f);
    return { kind: f.pic ? 'pic' : 'stack', img: f.img, sig: f.sig, hi: f.hi, lo: f.lo, top: f.top, mjd: f.mjd, det: 0, years: f, color: Years.COLOR[f.survey], title, sub };
  });
}
/**
 * What the Years view needs: for a showcase star, the built images for the detector in use (2MASS, the nearer band of
 * WISE, SPHEREx); for any other place, the 2MASS and AllWISE sky maps, read once for all detectors.
 */
async function loadYears() {
  if (!S.grid) return;
  const gen = S.gen, det = S.det, Y = S.years ||= { frames: null, files: new Set() };
  Y.need = det;
  if (Y.busy) return;
  const entry = isPreset() ? S.yearsIdx?.[S.target.slug] : null;
  const want = entry ? Years.filesFor(det).filter(f => !Y.files.has(f)) : Y.frames ? [] : ['maps'];
  if (!want.length) return;
  Y.busy = true; setStatus(G`Loading the images of 2MASS and WISE…`);
  try {
    if (entry) {
      Y.src = 'built'; Y.grid = entry.grid;
      const got = await Promise.all(want.map(f => Years.loadBuilt(`data/${S.target.slug}/${f}?v=${encodeURIComponent(entry.built)}`, S.abort.signal)));
      if (gen !== S.gen) return;
      Y.frames = [...(Y.frames || []), ...got.flat()]; want.forEach(f => Y.files.add(f));
    } else {
      Y.src = 'maps'; Y.grid = null;
      // the night 2MASS looked: asked again once after a pause, since the catalogue service is at times slow to answer
      const night = await Info.twomassNight(S.grid.ra, S.grid.dec).catch(() => nap(1500).then(() => Info.twomassNight(S.grid.ra, S.grid.dec)).catch(() => null));
      const frames = await Years.loadMaps(S.grid, night, S.abort.signal);
      if (gen !== S.gen) return;
      Y.frames = frames;
    }
  } catch (e) {
    if (e.name === 'AbortError' || gen !== S.gen) return;
    Y.failed = true; Y.frames ||= [];
  } finally { if (gen === S.gen) Y.busy = false; }
  setStatus('');
  if (S.mode === 'years') { rebuild(); maybeAutoplay(); }
  if (Y.need !== det && S.mode === 'years') loadYears();          // the detector changed while these were on their way
}
/**
 * Where a star's light is centred near a place, also when it is so bright that the core of its image is missing (the
 * detector was saturated there): the missing pixels count as the brightest light around them, and the centre is taken
 * over a window of six pixels. On Barnard's Star, saturated in every WISE image, this puts its light 0.6″ (r.m.s.) from
 * the catalogue's place in 27 images over 26 years; windows of 2.5 or 4 pixels without the filling stray by 7 to 8″.
 */
function starAt(img, n, x, y, flat = Infinity) {
  const x0 = Math.round(x), y0 = Math.round(y);
  let holes = 0, full = 0;
  for (let j = y0 - 2; j <= y0 + 2; j++) for (let i = x0 - 2; i <= x0 + 2; i++) { const v = img[j * n + i]; if (v !== v) holes++; else if (v >= flat) full++; }
  // a sky map's picture is cut off at its brightest grey: a star that fills it there is saturated too, and is centred the same way
  if (!holes && full >= 3) { const m = C.locate(img, n, x, y, 6); return m && { ...m, sat: true }; }
  if (!holes) { const m = C.locate(img, n, x, y, 3); return m && { ...m, sat: false }; }
  const out = Float32Array.from(img), R = 8;
  let top = -Infinity;
  for (let j = y0 - R; j <= y0 + R; j++) for (let i = x0 - R; i <= x0 + R; i++) { const v = img[j * n + i]; if (v > top) top = v; }
  for (let j = y0 - R; j <= y0 + R; j++) for (let i = x0 - R; i <= x0 + R; i++) {
    const k = j * n + i; if (out[k] !== out[k] && Math.hypot(i - x, j - y) <= R) out[k] = top;
  }
  const m = C.locate(out, n, x, y, 6);
  return m && { ...m, sat: true };
}
/** Where the ring goes in the Years view: on a catalogued star, where it was on that date; on a spot, the same place in the sky. */
function yearsSel(mjd) {
  const g = vg();
  if (!S.sel || !g) return null;
  if (S.sel.follow && S.track && !S.track.eph) { const p = trackPos(mjd, g); return p[0] === p[0] ? p : null; }
  if (S.sel.x !== undefined) return C.skyToGrid(g, ...C.gridToSky(S.grid, S.sel.x, S.sel.y));
  return null;
}
/**
 * Under the images in the Years view: for a catalogued star in built images, where its light lies in each image
 * against the place the catalogue gives for that date, and the motion that the images themselves show; for sky maps,
 * what they are, and whether the star stood inside the field when 2MASS looked.
 */
function renderYears() {
  const el = $('years');
  if (!el) return;
  const Y = S.years;
  if (S.mode !== 'years' || !Y?.frames || Y.busy) { el.innerHTML = ''; return; }
  const name = S.target ? nameOf(S.target) : S.info?.name || G`The star`;
  const rows = [];
  if (Y.failed && !Y.frames.length) { el.innerHTML = `<p class="hint">${G`The images of 2MASS and WISE could not be fetched just now.`}</p>`; return; }
  let notes = '';
  if (Y.src === 'maps') {
    const old = Y.frames.find(f => f.survey === '2MASS');
    let out = '', outside = false;
    if (S.track && !S.track.eph && old) {
      const p = trackPos(old.mjd), n = S.grid.n;
      if (!(p[0] > 2 && p[1] > 2 && p[0] < n - 3 && p[1] < n - 3)) {
        outside = true;
        const far = Math.hypot(p[0] - (n - 1) / 2, p[1] - (n - 1) / 2) * S.grid.scale / 60, need = [10, 20, 40].find(v => v / 2 > far + 0.7);
        out += `<p class="yearsnote">${G`When 2MASS looked, in ${C.fmtMonth(old.mjd)}, ${esc(name)} stood ${far.toFixed(1)}′ from where it is now: outside this field.`}${need ? ` <button type="button" data-wider="${need}">${G`Open a field of ${need}′`}</button>` : ''}</p>`;
      }
    }
    if (old?.guessed) out += `<p class="hint">${G`The night 2MASS looked at this place could not be looked up: its images are dated 1997 to 2001.`}</p>`;
    // a catalogued star inside the field, on dated pictures, is measured as in the images built for the test objects
    if (outside || old?.guessed || !S.track || S.track.eph) {
      el.innerHTML = out;
      el.querySelector('[data-wider]')?.addEventListener('click', e => {
        const size = +e.currentTarget.dataset.wider;
        go({ ra: S.ra, dec: S.dec, size, target: S.target, track: S.track, info: S.info, det: S.det, mode: 'years', fly: true });
      });
      return;
    }
    notes = `${out}<p class="hint">${G`The pictures of 2MASS and AllWISE are dated by the night 2MASS looked at this place and by the middle of 2010 (AllWISE adds up WISE’s passes over it in 2010 and early 2011).`}</p>`;
  }
  if (!S.track || S.track.eph || !S.seq.length) { el.innerHTML = ''; return; }
  const g = vg(), seen = [], missed = [];
  for (const it of S.seq) {
    const p = trackPos(it.mjd, g);
    if (!(p[0] > 9 && p[1] > 9 && p[0] < g.n - 10 && p[1] < g.n - 10)) continue;
    // a saturated star is centred from its wings, which a neighbour can pull a little: it may lie up to 8″ off; any other within 4″
    const pic = it.kind === 'pic', m = starAt(it.img, g.n, p[0], p[1], pic ? 250 : Infinity);
    // the brightest light where the star should be, against the sky of the image: a sky map's picture is stretched
    // by its makers (bright stars squeezed together, a crowded sky lifted), so it is judged on that, not on the centroid's peak
    let top = -Infinity; const x0 = Math.round(p[0]), y0 = Math.round(p[1]);
    for (let j = y0 - 2; j <= y0 + 2; j++) for (let i = x0 - 2; i <= x0 + 2; i++) { const v = it.img[j * g.n + i]; if (v !== v) top = Infinity; else if (v > top) top = v; }          // a missing core is a saturated, bright one
    const lift = top - (it.sky ??= C.robustStats(it.img).med);
    const there = pic ? lift > 3 * it.sig : !!m && m.peak > 10 * it.sig;
    if (!m || !there || Math.hypot(m.x - p[0], m.y - p[1]) * g.scale > (m.sat ? 8 : 4)) {
      // not measured: was there no light at all where the star should be, or light that could not be centred (a crowded field)?
      missed.push({ it, dark: lift < (pic ? 1.5 : 5) * it.sig });
      continue;
    }
    seen.push({ it, dE: -(m.x - p[0]) * g.scale, dN: (m.y - p[1]) * g.scale, t: C.mjdToYear(it.mjd) });
  }
  if (seen.length < 2) { el.innerHTML = notes; return; }
  // The motion the images show: the catalogue's, corrected by the straight line through the offsets of the light from it.
  const fit = key => {
    const tm = seen.reduce((a, q) => a + q.t, 0) / seen.length, vm = seen.reduce((a, q) => a + q[key], 0) / seen.length;
    const num = seen.reduce((a, q) => a + (q.t - tm) * (q[key] - vm), 0), den = seen.reduce((a, q) => a + (q.t - tm) ** 2, 0);
    return den > 0 ? num / den : 0;
  };
  const pmE = (S.track.pmra || 0) / 1000 + fit('dE'), pmN = (S.track.pmdec || 0) / 1000 + fit('dN');
  const cat = Math.hypot(S.track.pmra || 0, S.track.pmdec || 0) / 1000, mine = Math.hypot(pmE, pmN);
  const a = seen[0], b = seen[seen.length - 1], years = b.t - a.t;
  const rms = Math.sqrt(seen.reduce((s2, q) => s2 + q.dE ** 2 + q.dN ** 2, 0) / seen.length);
  const by = new Map();
  for (const q of seen) { const k = q.it.years.survey; if (!by.has(k)) by.set(k, []); by.get(k).push(q); }
  for (const [k, v] of by) {
    const r = Math.sqrt(v.reduce((s2, q) => s2 + q.dE ** 2 + q.dN ** 2, 0) / v.length), y0 = Math.floor(v[0].t), y1 = Math.floor(v[v.length - 1].t);
    rows.push(`<tr><td>${k}</td><td>${v.length}</td><td>${y0 === y1 ? y0 : `${y0}–${y1}`}</td><td>${r.toFixed(1)}″</td></tr>`);
  }
  const moved = cat * years;
  let say = '';
  if (moved >= 2 * g.scale) {
    say = G`From ${a.it.years.survey} in ${C.fmtMonth(a.it.mjd)} to ${b.it.years.survey} in ${C.fmtMonth(b.it.mjd)}, ${esc(name)} moved ${arc(mine * years)} towards the ${compass(pmE, pmN)}. Measured in these ${seen.length} images: ${mine.toFixed(2)}″ a year; the catalogue gives ${cat.toFixed(2)}″.`;
  } else {
    say = G`In ${years.toFixed(0)} years, from ${a.it.years.survey} to ${b.it.years.survey}, ${esc(name)} moved less than this view can show (${(cat * years).toFixed(1)}″ by the catalogue).`;
  }
  // a telescope in whose images it does not show at all: too faint, or too cold, at that wavelength (WISE 0855 in 2MASS)
  // only where there was no light at all: a bright star that could not be centred is not "too faint"
  const unseen = [...new Set(missed.filter(q => q.dark).map(q => q.it.years.survey))].filter(k => !by.has(k)).map(k => missed.find(q => q.dark && q.it.years.survey === k).it.years);
  const none = unseen.map(f => G`It does not show in the ${f.survey} image (${f.band}, ${Years.LAM[f.band].toFixed(2)} µm, ${f.guessed ? '1997–2001' : C.fmtMonth(f.mjd)}): at that wavelength it is too faint for ${f.survey}.`).join(' ');
  el.innerHTML = `<p class="yearssay">${say} ${G`Its light lies ${rms.toFixed(1)}″ (r.m.s.) from where the catalogue puts it on each date.`}${none ? ` ${none}` : ''}</p>${notes}
    <table class="t"><thead><tr><th>${G`Telescope`}</th><th>${G`Images`}</th><th>${G`Years`}</th><th>${G`Off the catalogue`}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  yearsBrightness(el, name);
}
/**
 * How bright a star that changes was, visit by visit of WISE and NEOWISE, in the band of WISE in view: as measured in
 * these images (the light of a ring 15″ to 30″ around the star, a saturated core left out), and by WISE's own
 * catalogues (profile fits, stored with the images by scripts/build_years.py). Shown only when the two agree that the
 * star changed (correlation 0.8 or more over eight visits or more, and a third or more between its faintest and
 * brightest visit in the images): the catalogues' fits of a heavily saturated star scatter widely on their own
 * (Barnard's Star, which is steady, by a factor of five), and a faint star's ring holds only noise. RW Aurigae passes
 * (correlation 0.96 in W1, 0.97 in W2); the ring shows large changes smaller than the catalogue does, and both ranges are given.
 */
function yearsBrightness(el, name) {
  const band = Years.NEAR[S.det][1], cat = (S.yearsIdx?.[S.target?.slug]?.cat || {})[band] || [];
  if (cat.length < 8) return;
  const med = v => { const s2 = [...v].sort((a, b) => a - b); return s2[s2.length >> 1]; };
  const cf = cat.map(r => 10 ** (-0.4 * r[1])), cm = med(cf), rel = cf.map(v => v / cm);
  const g = vg(), n = g.n, ring = [];
  for (const it of S.seq) {
    const f = it.years;
    if (!f || f.band !== band || !(f.survey === 'WISE' || f.survey === 'NEOWISE')) continue;
    const [x, y] = trackPos(it.mjd, g); let sum = 0, k = 0; const sky = [];
    for (let j = Math.max(0, Math.floor(y - 30 / g.scale)); j <= Math.min(n - 1, Math.ceil(y + 30 / g.scale)); j++) for (let i = Math.max(0, Math.floor(x - 30 / g.scale)); i <= Math.min(n - 1, Math.ceil(x + 30 / g.scale)); i++) {
      const r = Math.hypot(i - x, j - y) * g.scale, v = it.img[j * n + i];
      if (r >= 15 && r < 30 && v === v) { sum += v; k++; }
    }
    for (let j = 0; j < n; j += 2) for (let i = 0; i < n; i += 2) { const r = Math.hypot(i - x, j - y) * g.scale, v = it.img[j * n + i]; if (r >= 60 && r < 90 && v === v) sky.push(v); }
    ring.push({ mjd: it.mjd, v: sum - med(sky.length ? sky : [0]) * k });
  }
  const rm = med(ring.map(r => r.v));
  if (!(rm > 0)) return;
  const mine = ring.map(r => ({ mjd: r.mjd, rel: r.v / rm }));
  // the visits both have, and how closely the two agree on them
  const pairs = mine.map(m => { const k = cat.findIndex(r => Math.abs(r[0] - m.mjd) < 12); return k >= 0 ? [m.rel, rel[k]] : null; }).filter(Boolean);
  if (pairs.length < 8) return;
  const ax = pairs.reduce((a, p) => a + p[0], 0) / pairs.length, ay = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
  const corr = pairs.reduce((a, p) => a + (p[0] - ax) * (p[1] - ay), 0) / Math.sqrt(pairs.reduce((a, p) => a + (p[0] - ax) ** 2, 0) * pairs.reduce((a, p) => a + (p[1] - ay) ** 2, 0));
  const hi = mine.reduce((a, m) => (m.rel > a.rel ? m : a)), lo = mine.reduce((a, m) => (m.rel < a.rel ? m : a));
  if (!(corr >= 0.8) || hi.rel / lo.rel < 4 / 3) return;
  const lam = Years.LAM[band].toFixed(1);
  const say = G`At ${lam} µm (${band}), ${esc(name)} changed from visit to visit. In these images, in the light of a ring around its saturated core, it was brightest in ${C.fmtMonth(hi.mjd)}, ${hi.rel.toFixed(1)} times its usual brightness, and faintest in ${C.fmtMonth(lo.mjd)}, ${lo.rel.toFixed(2)} times.`;
  const theirs = G`The catalogue of WISE and NEOWISE, which fits the saturated star itself, follows the same ups and downs (correlation ${corr.toFixed(2)}), over a wider range: ${Math.min(...rel).toFixed(2)} to ${Math.max(...rel).toFixed(1)} times.`;
  el.insertAdjacentHTML('beforeend', `<p class="yearssay lcsay">${say} ${theirs}</p><div class="plotwrap"><canvas id="yearslc" aria-label="${esc(G`Brightness over the years`)}"></canvas><div class="tip" hidden></div></div>
    <div class="legend"><span><i style="background:#06d6a0"></i>${esc(G`these images (ring around the core)`)}</span><span><i style="background:#f2c14e"></i>${esc(G`catalogue of WISE and NEOWISE`)}</span></div>`);
  const cv2 = $('yearslc'), plot = new Plot(cv2, cv2.nextElementSibling);
  // a catalogue point's bar: how much its single measurements in that visit scatter
  const pts = [...cat.map((r, k) => ({ x: r[0], y: rel[k], err: rel[k] * 0.921 * r[2], color: '#f2c14e', what: G`catalogue` })), ...mine.map(m => ({ x: m.mjd, y: m.rel, color: '#06d6a0', what: G`these images` }))];
  const top = Math.max(...pts.map(p => p.y)) * 1.15;
  plot.set(pts, { ylim: [0, top], hline: 1, ylabel: G`× usual brightness`, xTicks: (a, b) => { const out = []; for (let y = Math.ceil(C.mjdToYear(a)); y <= C.mjdToYear(b); y++) if (y % 2 === 0) out.push({ v: 51544.5 + (y - 2000) * 365.25, label: String(y) }); return out; },
    tipText: p => `${C.fmtMonth(p.x)} · ${p.what} · ×${p.y.toFixed(2)}` });
}
const lamRange = fr => { const v = fr.map(f => f.lam).sort((a, b) => a - b); return v.length > 1 ? `${v[0].toFixed(2)}–${v[v.length - 1].toFixed(2)} µm` : `${v[0].toFixed(2)} µm`; };

function defaultSelection() {
  if (S.track) { S.sel = { follow: true }; return; }
  const n = S.grid.n, c = (n - 1) / 2, R = Math.min(c - 12, 45 / S.grid.scale);
  let bx = c, by = c, bv = -Infinity;
  if (S.deep) for (let j = Math.round(c - R); j <= c + R; j++) for (let i = Math.round(c - R); i <= c + R; i++) {
    const v = S.deep[j * n + i]; if (v > bv && Math.hypot(i - c, j - c) <= R) { bv = v; bx = i; by = j; }
  }
  const hit = S.deep && C.centroid(S.deep, n, bx, by, 2.5);
  S.sel = hit ? { x: hit.x, y: hit.y } : { x: c, y: c };
}
/** Where the catalogued target should be on a date: its year-2000 position, moved by its proper
 *  motion and, for nearby stars, by its parallax. Returned in grid pixels. */
function trackPos(mjd, g = S.grid) {
  if (followed()) { const c = (g.n - 1) / 2; return [c, c]; }          // every exposure is cut out around it
  if (S.track.eph) {          // a body of the solar system: its path is given for the centre of the Earth, the spacecraft sees it a little to the side
    const p = ephAt(S.track.eph, mjd);
    return p ? C.skyToGrid(g, ...Bodies.fromSpacecraft(p[0], p[1], p[2], scAt(mjd))) : [NaN, NaN];
  }
  let [ra, dec] = C.propagate({ ra: S.track.ra2000, dec: S.track.dec2000, pmra: S.track.pmra, pmdec: S.track.pmdec }, 2000, C.mjdToYear(mjd));
  const plx = S.target?.dist?.plx ?? S.track.plx;
  if (plx > 20) {
    const [dE, dN] = C.parallaxOffset(ra, dec, plx, mjd);
    ra += dE / 3600 / Math.max(Math.cos(dec * Math.PI / 180), 1e-6); dec += dN / 3600;
  }
  return C.skyToGrid(g, ra, dec);
}
function selPos(mjd) {
  if (!S.sel) return null;
  if (S.sel.trail) { const t = S.sel.trail; return mjd >= t.t0 - 0.05 && mjd <= t.t1 + 0.05 ? Movers.trackAt(t, mjd) : null; }      // a body is somewhere else on other days
  if (S.sel.follow && S.track) { const p = trackPos(mjd); return p[0] === p[0] ? p : null; }
  return [S.sel.x, S.sel.y];
}
/**
 * Where a body of the solar system was at a moment, seen from the centre of the Earth, from its path
 * [[mjd, ra, dec, au from Earth], …]: [ra, dec, au] (0 au when the path does not say), null outside the days the path covers.
 */
function ephAt(eph, mjd) {
  if (!eph.length || mjd < eph[0][0] || mjd > eph[eph.length - 1][0]) return null;
  let lo = 0, hi = eph.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (eph[m][0] <= mjd) lo = m; else hi = m; }
  const a = eph[lo], b = eph[hi], t = (mjd - a[0]) / Math.max(b[0] - a[0], 1e-9);
  let dra = b[1] - a[1]; if (dra > 180) dra -= 360; else if (dra < -180) dra += 360;
  return [a[1] + t * dra, a[2] + t * (b[2] - a[2]), a[3] > 0 ? a[3] + t * (b[3] - a[3]) : 0];
}
/**
 * Where the spacecraft was at a moment ([x, y, z] in km from the centre of the Earth), from the exposures loaded,
 * which say so in their headers: between two of them taken minutes apart, in a straight line. Null when none was
 * taken within a few minutes, and for the showcase objects, whose stored exposures do not carry it.
 */
function scAt(mjd) {
  const key = `${S.gen}:${[1, 2, 3, 4, 5, 6].map(d => S.dets[d]?.frames.length || 0).join()}`;
  if (S.scMemo?.key !== key) {
    const v = [];
    for (let d = 1; d <= 6; d++) for (const f of S.dets[d]?.frames || []) if (f.sc) v.push([f.mjd, f.sc[0], f.sc[1], f.sc[2]]);
    S.scMemo = { key, v: v.sort((a, b) => a[0] - b[0]) };
  }
  const v = S.scMemo.v;
  if (!v.length) return null;
  let lo = 0, hi = v.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (v[m][0] <= mjd) lo = m; else hi = m; }
  const a = v[lo], b = v[hi];
  if (mjd >= a[0] && mjd <= b[0] && b[0] > a[0] && b[0] - a[0] < 0.01) { const t = (mjd - a[0]) / (b[0] - a[0]); return [1, 2, 3].map(k => a[k] + t * (b[k] - a[k])); }
  const near = Math.abs(a[0] - mjd) <= Math.abs(b[0] - mjd) ? a : b;
  return Math.abs(near[0] - mjd) < 0.003 ? near.slice(1) : null;
}
/**
 * The body of the solar system being followed, if any: the stops of the telescope that caught it, in time order,
 * each with the place of the body on the grid and the detectors that looked: [{ stop, mjd, x, y, dets }].
 * Either a track found in these images (S.sel.trail), or a body whose path is known (S.track.eph).
 */
function bodyStops() {
  const trail = S.sel?.trail, known = !trail && S.sel?.follow && S.track?.eph;
  if (!S.grid || (!trail && !known)) return null;
  const key = `${S.gen}:${trail ? 'found' : 'known'}:${[1, 2, 3, 4, 5, 6].map(d => S.dets[d]?.frames.length || 0).join()}:${[...S.off].join()}`;
  if (S.bodyMemo?.key === key && S.bodyMemo.trail === trail) return S.bodyMemo.stops;
  const n = S.grid.n, by = new Map();
  for (let d = 1; d <= 6; d++) for (const f of usable(d)) {
    const p = selPos(f.mjd);
    if (!p || !(p[0] > 4 && p[1] > 4 && p[0] < n - 5 && p[1] < n - 5)) continue;
    const v = f.data[Math.round(p[1]) * n + Math.round(p[0])];
    if (v !== v) continue;                                               // this exposure did not look at that place
    const k = Movers.stopOf(f.id);
    if (trail && !trail.sightings.some(q => q.stop === k)) continue;      // a found track counts where it was found
    if (!by.has(k)) by.set(k, { stop: k, mjd: 0, x: 0, y: 0, k: 0, dets: new Set() });
    const o = by.get(k); o.mjd += f.mjd; o.x += p[0]; o.y += p[1]; o.k++; o.dets.add(d);
  }
  const stops = [...by.values()].map(o => ({ stop: o.stop, mjd: o.mjd / o.k, x: o.x / o.k, y: o.y / o.k, dets: [...o.dets].sort() })).sort((a, b) => a.mjd - b.mjd);
  S.bodyMemo = { key, trail, stops };
  return stops;
}
function lamAt(f) {
  const p = selPos(f.mjd), c = (S.grid.n - 1) / 2;
  return p ? f.lam + f.lgx * (p[0] - c) + f.lgy * (p[1] - c) : f.lam;
}

// ------------------------------------------------------------ drawing
function stretch(v, lo, soft, norm) {
  const t = Math.asinh((v - lo) / soft) / norm;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}
function paint() {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const it = S.seq[S.idx];
  if (!it || !S.grid) return;
  const n = vg().n, npx = n * n;
  if (off.width !== n) { off.width = off.height = n; }
  const im = octx.createImageData(n, n), px = im.data;
  const hi = S.hi * Math.pow(10, -S.white);
  const gain = Math.pow(10, -S.white);
  const chan = (img, sig, own) => {
    const top = own ? own * gain : hi;
    const lo = -2 * sig, soft = 3 * sig, norm = Math.asinh((Math.max(top, 10 * sig) - lo) / soft);
    return v => stretch(v, lo, soft, norm);
  };
  if (it.kind === 'rgb') {
    const [a, m, b] = it.rgb, fa = chan(a.img, a.sig, a.hi), fb = chan(b.img, b.sig, b.hi), fm = m ? chan(m.img, m.sig, m.hi) : null;
    for (let p = 0; p < npx; p++) {
      const o = ((n - 1 - ((p / n) | 0)) * n + (p % n)) * 4;
      const r = a.img[p], bl = b.img[p], g = m ? m.img[p] : bl;
      if (r !== r || bl !== bl || g !== g) { px[o] = S.mask ? 90 : 0; px[o + 1] = 0; px[o + 2] = 0; px[o + 3] = 255; continue; }
      px[o] = 255 * fa(r); px[o + 1] = 255 * (fm ? fm(g) : fb(g)); px[o + 2] = 255 * fb(bl); px[o + 3] = 255;
    }
  } else if (it.kind === 'pic') {
    // a sky map's picture: grey levels as its makers stretched them, made lighter or darker by the brightness slider
    const gain = Math.pow(10, -0.6 * S.white), span = Math.max(1, it.top - it.lo);
    for (let p = 0; p < npx; p++) {
      const o = ((n - 1 - ((p / n) | 0)) * n + (p % n)) * 4, v = it.img[p];
      let t = v === v ? clamp(0.06 + 0.94 * (v - it.lo) / span * gain, 0, 1) : 0;
      if (S.invert) t = 1 - t;
      px[o] = px[o + 1] = px[o + 2] = 255 * t; px[o + 3] = 255;
    }
  } else {
    const diff = it.kind === 'diff', f = chan(it.img, it.sig, it.hi), k = 8 * it.sig * Math.pow(10, -S.white);
    if (!diff && it.sat === undefined) it.sat = C.saturatedMask(it.img, n, Math.max((it.hi || S.hi) * 0.5, 40 * it.sig));
    const sat = diff ? null : it.sat;
    for (let p = 0; p < npx; p++) {
      const o = ((n - 1 - ((p / n) | 0)) * n + (p % n)) * 4, v = it.img[p];
      if (v !== v) {
        const satur = sat && sat[p] && !S.mask, c0 = satur ? (S.invert ? 0 : 255) : 0;
        px[o] = S.mask ? 150 : c0; px[o + 1] = c0; px[o + 2] = S.mask ? 40 : c0; px[o + 3] = 255; continue;
      }
      let t = diff ? clamp(0.5 + 0.5 * v / k, 0, 1) : f(v);
      if (S.invert) t = 1 - t;
      px[o] = px[o + 1] = px[o + 2] = 255 * t; px[o + 3] = 255;
    }
  }
  octx.putImageData(im, 0, 0);
  const s = W / n * S.view.z;
  ctx.save();
  ctx.imageSmoothingEnabled = S.smooth;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - (S.view.cx + 0.5) * s), dpr * (H / 2 - (n - 0.5 - S.view.cy) * s));
  ctx.drawImage(off, 0, 0);
  const marked = flagLayer(it, n);
  if (marked) { ctx.imageSmoothingEnabled = false; ctx.drawImage(marked, 0, 0); }
  ctx.restore();
  overlays(it, W, H, s);
}
const g2c = (x, y, W, H, s) => [(x - S.view.cx) * s + W / 2, (S.view.cy - y) * s + H / 2];
function c2g(X, Y) {
  const W = cv.clientWidth, H = cv.clientHeight, s = W / vg().n * S.view.z;
  return [S.view.cx + (X - W / 2) / s, S.view.cy - (Y - H / 2) / s];
}

function overlays(it, W, H, s) {
  const g = vg(), year = C.mjdToYear(it.mjd), own = followed(), yrs = S.mode === 'years';          // a followed body: nothing in its images is fixed to the sky, so no star is marked and no path drawn
  ctx.lineWidth = 1.2; ctx.font = '12px system-ui, sans-serif';
  // The circled spot. Everything else is drawn so that the inside of this ring stays clear:
  // a faint object must never be hidden by the marks that point at it.
  const sel = S.marks ? (yrs ? yearsSel(it.mjd) : selPos(it.mjd)) : null;
  const [PX, PY] = sel ? g2c(sel[0], sel[1], W, H, s) : [-1e6, -1e6], rAp = 9.2 / g.scale * s, clear = rAp + 3;
  if (S.marks) {
    // Gaia: circle at each star's catalogue position for this date; arrows for fast movers.
    if (S.showGaia && S.gaia && !own) {
      for (const src of S.gaia.sources) {
        if (src.g > (S.view.z < 2 ? 16.5 : S.view.z < 4 ? 18.5 : 99)) continue;
        const [ra, dec] = C.propagate(src, S.gaia.epoch, year), [x, y] = C.skyToGrid(g, ra, dec);
        const [X, Y] = g2c(x, y, W, H, s);
        if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
        const pm = Math.hypot(src.pmra || 0, src.pmdec || 0), own = Math.hypot(X - PX, Y - PY) < rAp * 0.7;
        ctx.strokeStyle = pm > 150 ? '#ffd166' : '#4cc9f066';
        if (!own) { ctx.beginPath(); ctx.arc(X, Y, Math.max(3.5, 4 / g.scale * s), 0, 7); ctx.stroke(); }
        if (pm > 150) {   // arrow: motion over the next 5 years, starting outside the ring
          const [ra2, dec2] = C.propagate(src, S.gaia.epoch, year + 5), [x2, y2] = C.skyToGrid(g, ra2, dec2), [X2, Y2] = g2c(x2, y2, W, H, s);
          const len = Math.hypot(X2 - X, Y2 - Y), off = own ? clear : Math.max(3.5, 4 / g.scale * s) + 2;
          if (len > off + 8) arrow(X + (X2 - X) * off / len, Y + (Y2 - Y) * off / len, X2, Y2, '#ffd166');
          ctx.fillStyle = '#ffd166'; ctx.fillText(G`${(pm / 1000).toFixed(1)}″/yr`, X2 + 6, Y2 - 6);
        }
      }
    }
    // WISE: squares, so they read differently from Gaia circles.
    if (S.showWise && S.catwise && !own) {
      ctx.strokeStyle = '#ff9f1c99';
      for (const src of S.catwise.sources) {
        if (src.w2 > (S.view.z < 2 ? 15.5 : 99)) continue;
        const [ra, dec] = C.propagate(src, S.catwise.epoch, year), [x, y] = C.skyToGrid(g, ra, dec), [X, Y] = g2c(x, y, W, H, s);
        if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
        if (Math.hypot(X - PX, Y - PY) < rAp * 0.7) continue;                      // the ring already marks this one
        const r = Math.max(4, 4.5 / g.scale * s);
        ctx.strokeRect(X - r, Y - r, 2 * r, 2 * r);
      }
    }
    // Predicted path of the catalogued target: a dotted line with one tick per visit. The line stops
    // short of the ring and the ticks sit beside the path, so the object itself stays in view.
    if (S.track && S.head?.epochs?.length && !own) {
      // in the Years view the path runs from the oldest image to the newest, without the ticks of the SPHEREx visits
      const eps = yrs ? [[S.seq[0].mjd, S.seq[0].mjd], [S.seq[S.seq.length - 1].mjd, S.seq[S.seq.length - 1].mjd]] : S.head.epochs;
      const a = trackPos(eps[0][0] - 200, g), b = trackPos(eps[eps.length - 1][1] + 200, g);
      const [AX, AY] = g2c(a[0], a[1], W, H, s), [BX, BY] = g2c(b[0], b[1], W, H, s), L = Math.hypot(BX - AX, BY - AY);
      if (L > 10) {
        const ux = (BX - AX) / L, uy = (BY - AY) / L, nx = -uy, ny = ux;
        const t0 = (PX - AX) * ux + (PY - AY) * uy, perp = Math.abs((PX - AX) * nx + (PY - AY) * ny);
        const gap = perp < clear ? Math.sqrt(clear * clear - perp * perp) : 0;
        ctx.strokeStyle = '#ffffff66'; ctx.setLineDash([3, 3]); ctx.beginPath();
        if (gap > 0) {
          if (t0 - gap > 0) { ctx.moveTo(AX, AY); ctx.lineTo(AX + ux * (t0 - gap), AY + uy * (t0 - gap)); }
          if (t0 + gap < L) { ctx.moveTo(AX + ux * (t0 + gap), AY + uy * (t0 + gap)); ctx.lineTo(BX, BY); }
        } else { ctx.moveTo(AX, AY); ctx.lineTo(BX, BY); }
        ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 2;
        if (!yrs) eps.forEach((e, i) => {
          const q = trackPos((e[0] + e[1]) / 2), [QX, QY] = g2c(q[0], q[1], W, H, s);
          ctx.strokeStyle = C.EPOCH_COLORS[i % C.EPOCH_COLORS.length];
          for (const sgn of [-1, 1]) {
            ctx.beginPath(); ctx.moveTo(QX + nx * sgn * (clear + 1), QY + ny * sgn * (clear + 1));
            ctx.lineTo(QX + nx * sgn * (clear + 7), QY + ny * sgn * (clear + 7)); ctx.stroke();
          }
        });
        ctx.lineWidth = 1.2;
      }
    }
    // A body of the solar system that is being followed: its path from stop to stop, with a dot at each stop. Kept out of the ring.
    const path = own || yrs ? null : bodyStops();
    if (path && path.length > 1) {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(PX, PY, clear, 0, 7); ctx.clip('evenodd');
      ctx.strokeStyle = '#ffffff77'; ctx.setLineDash([3, 3]); ctx.beginPath();
      path.forEach((q, i) => { const [X, Y] = g2c(q.x, q.y, W, H, s); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffffffcc';
      for (const q of path) { const [X, Y] = g2c(q.x, q.y, W, H, s); ctx.beginPath(); ctx.arc(X, Y, 1.8, 0, 7); ctx.fill(); }
      ctx.restore();
    }
    // The other bodies that the search found in the exposures of this very stop: a gold corner mark and a name.
    const here = it.frame ? Movers.stopOf(it.frame.id) : it.at?.stop;
    if (here && S.movers?.tracks && !yrs) for (const t of S.movers.tracks) {
      if (t === S.sel?.trail || (t.body?.own && S.sel?.follow)) continue;
      const q = t.sightings.find(x => x.stop === here); if (!q) continue;
      const [X, Y] = g2c(q.x, q.y, W, H, s), r = rAp + 4, k = 6;
      ctx.strokeStyle = ctx.fillStyle = '#f2c14e'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(X + sx * r, Y + sy * (r - k)); ctx.lineTo(X + sx * r, Y + sy * r); ctx.lineTo(X + sx * (r - k), Y + sy * r); }
      ctx.stroke(); ctx.fillText(bodyLabel(t), X + r + 5, Y + 4);
    }
    // Stars that the field check flagged: a diamond, wide enough to leave the star in view.
    if (scanResult?.flags?.length && scanKey.startsWith(`${S.gen}:${S.det}:`) && !yrs) {
      ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.4;
      for (const f of scanResult.flags) {
        if (f.own) continue;
        const [X, Y] = g2c(f.s.x, f.s.y, W, H, s), r = rAp + 5;
        if (Math.hypot(X - PX, Y - PY) < rAp) continue;
        ctx.beginPath(); ctx.moveTo(X, Y - r); ctx.lineTo(X + r, Y); ctx.lineTo(X, Y + r); ctx.lineTo(X - r, Y); ctx.closePath(); ctx.stroke();
      }
    }
    // Measurement aperture.
    if (sel) {
      ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(PX, PY, rAp, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#06d6a055'; ctx.lineWidth = 1;
      for (const r of skyRing()) { ctx.beginPath(); ctx.arc(PX, PY, r / g.scale * s, 0, 7); ctx.stroke(); }
    }
  }
  // Compass and scale bar.
  const bar = niceBar(W * 0.25 * g.scale / s), bl = bar / g.scale * s, by = H - 34;
  ctx.strokeStyle = ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W - 14 - bl, by); ctx.lineTo(W - 14, by); ctx.stroke();
  ctx.textAlign = 'right'; ctx.fillText(bar >= 60 ? `${bar / 60}′` : `${bar}″`, W - 14, by - 6);
  ctx.lineWidth = 1.2; ctx.textAlign = 'center';
  const ox = W - 16, oy = H - 62;                 // with the scale bar, out of the caption's way
  arrow(ox, oy, ox, oy - 20, '#fff'); ctx.fillText('N', ox, oy - 24);
  arrow(ox, oy, ox - 20, oy, '#fff'); ctx.fillText('E', ox - 27, oy + 4);
  ctx.textAlign = 'left';
}
function niceBar(arcsec) { return [600, 300, 120, 60, 30, 20, 10, 5, 2, 1].find(v => v <= arcsec) || 1; }
function arrow(x0, y0, x1, y1, color) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a - 0.4), y1 - 6 * Math.sin(a - 0.4));
  ctx.moveTo(x1, y1); ctx.lineTo(x1 - 6 * Math.cos(a + 0.4), y1 - 6 * Math.sin(a + 0.4)); ctx.stroke();
}

function show() {
  const it = S.seq[S.idx];
  $('seek').value = S.idx;
  $('count').textContent = S.seq.length ? `${S.idx + 1} / ${S.seq.length}` : '';
  $('caption').innerHTML = it ? `<b><i style="background:${it.color || epochColor(it.mjd)}"></i>${it.title}</b><span>${it.det === 0 ? '' : `D${it.det || S.det} · `}${it.sub}</span>` : '';
  const single = S.seq.length < 2;
  $('play').disabled = $('prev').disabled = $('next').disabled = single;
  if (single) stop();
  if (!S.seq.length && S.head && S.dets[S.det]?.done) {
    $('caption').innerHTML = S.mode === 'color' || S.mode === 'diff'
      ? G`<b>Needs two visits</b><span>SPHEREx has visited this spot only once with this detector so far.</span>`
      : G`<b>No exposures</b><span>Detector ${S.det} has no data at this position.</span>`;
  }
  paint(); renderMeta(); markCurrent();
}
function step(d) { if (S.seq.length) { S.idx = (S.idx + d + S.seq.length) % S.seq.length; show(); } }
function play() {
  if (S.seq.length < 2) return;
  S.playing = true; $('play').textContent = G`❚❚ Pause`;
  clearInterval(S.timer); S.timer = setInterval(() => step(1), 1000 / S.fps);
}
function stop() { S.playing = false; $('play').textContent = G`▶ Play`; clearInterval(S.timer); }

// ------------------------------------------------------------ photometry & plots
let plotTimer = 0, plotDue = 0;
/** Redraw the plots soon. While detectors are still arriving one after another, wait for a pause (but never long). */
function refreshPlots() {
  const now = performance.now(), busy = !!S.head && [1, 2, 3, 4, 5, 6].some(d => S.dets[d]?.loading);
  if (!plotDue) plotDue = now + 900;
  clearTimeout(plotTimer);
  plotTimer = setTimeout(() => { plotDue = 0; drawPlots(); }, Math.max(0, Math.min(busy ? 320 : 120, plotDue - now)));
}
function measureAll() {
  if (!S.grid || !S.sel) return [];
  const n = S.grid.n, c = (n - 1) / 2, sc = S.grid.scale, pts = [], own = followed(), [rin, rout] = skyRing();
  S.haloDets = [];
  const body = bodyStops(), stopsOf = body && new Set(body.map(q => q.stop));
  for (let det = 1; det <= 6; det++) {
    const fr = usable(det).filter(f => (body ? stopsOf.has(Movers.stopOf(f.id)) : true) && selPos(f.mjd)); if (!fr.length) continue;
    const pos = fr.map(f => selPos(f.mjd));
    // What is measured in an exposure depends only on the spot and the method, so it is worked out once
    // and remembered on the exposure: the plots are redrawn many times while detectors arrive.
    const memo = (f, key, work) => { const m = (f.memo ||= {}); if (!(key in m)) m[key] = work(); return m[key]; };
    const at = p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
    // Saturated star? Then the core is masked in most exposures: measure the halo instead, for all of them.
    const nSat = fr.reduce((k, f, i) => k + (memo(f, `core:${at(pos[i])}`, () => C.coreMasked(f.data, n, sc, pos[i][0], pos[i][1])) > 0 ? 1 : 0), 0);
    const useHalo = nSat > 0.3 * fr.length;
    let ring = 21;
    if (useHalo) {
      S.haloDets.push(det);
      // Smallest ring that clears the saturated core in nearly every exposure of this detector.
      const stride = Math.ceil(fr.length / 30);
      for (const r of [15, 21, 30, 42, 54]) {
        ring = r;
        let ok = 0, all = 0;
        fr.forEach((f, i) => { if (i % stride) return; all++; if (memo(f, `halo${r}:${at(pos[i])}`, () => C.halo(f.data, n, sc, pos[i][0], pos[i][1], f.sig, r)).valid >= 0.9) ok++; });
        if (ok >= 0.8 * all) break;
      }
    }
    fr.forEach((f, i) => {
      const p = pos[i];
      let a = useHalo ? memo(f, `halo${ring}:${at(p)}`, () => C.halo(f.data, n, sc, p[0], p[1], f.sig, ring)) : memo(f, `ap:${at(p)}:${rin}`, () => C.aperture(f.data, n, sc, p[0], p[1], f.sig, 9.2, rin, rout));
      if (a && a.halo && !(a.valid >= 0.7 && a.flux === a.flux)) a = null;
      if (!a) return;
      pts.push({ lam: f.lam + f.lgx * (p[0] - c) + f.lgy * (p[1] - c), flux: a.flux, err: a.err, mjd: f.mjd, det, frame: f, halo: useHalo, ...(own ? { spoiled: spoiledBy(f, a) } : {}) });
    });
  }
  // Saturated detectors follow the shape of the spectrum but not its level: join each to its neighbour.
  S.haloAnchored = pts.some(p => !p.halo);
  if (S.haloDets.length) {
    const sc = C.stitchScales(pts);
    let norm = 1;
    if (!S.haloAnchored) {              // every detector saturated: no absolute level at all, show it relative to its own median
      const v = pts.map(p => p.flux * (sc[p.det] ?? 1)).filter(x => x > 0).sort((a, b) => a - b);
      if (v.length) norm = 1 / v[v.length >> 1];
    }
    for (const p of pts) if (p.halo) { const k = (sc[p.det] ?? 1) * norm; p.flux *= k; p.err *= k; }
  }
  return pts;
}
function pct(v, f) { const s = [...v].sort((a, b) => a - b); return s[clamp(Math.round(f * (s.length - 1)), 0, s.length - 1)]; }
function drawPlots() {
  const pts = S.pts = measureAll(), cur = S.seq[S.idx]?.frame, own = followed();
  const fl = pts.map(p => p.flux);
  // A followed comet is a hundred times as bright in a gas band as beside it, and at one visit as at another: its
  // brightness is drawn in powers of ten, from a floor that the measurements of its faint visit still clear.
  const floor = 0.03, peak = own ? Math.max(1, ...pts.filter(p => !p.spoiled).map(p => p.flux)) : 0;
  const relative = S.haloDets?.length > 0 && !S.haloAnchored;
  const inJy = !relative && fl.length > 0 && pct(fl, 0.9) >= 2000, u = inJy ? 0.001 : 1, unit = inJy ? 'Jy' : 'mJy';
  const sp = pts.map(p => ({ x: p.lam, y: p.flux * u, err: p.err * u, color: epochColor(p.mjd), src: p, big: p.frame === cur, hollow: p.halo || !!p.spoiled, dim: own && p.flux <= floor }));
  const ymax = fl.length ? pct(fl, 0.98) * 1.25 * u : 1, ymin = fl.length ? Math.min(0, pct(fl, 0.02)) * u : 0;
  specPlot.set(sp, {
    xlabel: G`wavelength (µm)`, ylabel: relative ? G`relative brightness` : G`brightness (${unit})`,
    ...(own ? { logY: true, ylim: [floor, 2 * peak] } : { ylim: [ymin - (ymax - ymin) * 0.04, ymax > ymin ? ymax : ymin + 1] }),
    xlim: [0.7, 5.1], empty: S.failed ? G`No images to measure` : !S.grid ? G`Waiting for the images…` : S.sel ? G`Measuring…` : G`Click or tap a star in the image`,
    shade: [...(S.grid ? [{ x0: C.DET_BANDS[S.det][0], x1: C.DET_BANDS[S.det][1], color: '#ff7b3916' }] : []),
      ...(S.showBands ? (own ? C.GASES : bodyStops() ? C.ICES : C.MOLECULES).map((m, i) => ({ x0: m.band[0], x1: m.band[1], color: '#ffffff12', label: m.f, row: i % 2 })) : [])],
    tipText: p => `${p.x.toFixed(3)} µm · ${relative ? `×${p.y.toFixed(2)}` : `${p.src.halo ? '≈ ' : ''}${p.y.toFixed(p.y >= 100 ? 0 : 2)}${p.src.halo ? '' : ` ± ${p.err.toFixed(2)}`} ${unit}`} · ${C.fmtDate(p.src.mjd)} · D${p.src.det}${p.src.spoiled === 'star' ? G` · a star behind it adds to this one` : p.src.spoiled === 'fault' ? G` · faulty pixels in the circle` : ''}`,
    onPick: p => jumpTo(p.src),
  });
  // Variability: each point relative to the spot's own median spectrum.
  const medErr = pts.length ? pct(pts.map(p => p.err), 0.5) : 0;
  const ref = C.referenceSpectrum(pts);
  const lc = [];
  for (const p of pts) {
    if (p.det !== S.det) continue;
    // a followed comet: its brightness itself, visit by visit, in powers of ten
    if (own) { if (!p.spoiled) lc.push({ x: p.mjd, y: p.flux * u, err: p.err * u, color: epochColor(p.mjd), src: p, big: p.frame === cur, dim: p.flux <= floor }); continue; }
    const r = ref(p.lam);
    if (!(r > 5 * medErr)) continue;
    lc.push({ x: p.mjd, y: p.flux / r, err: p.err / r, color: epochColor(p.mjd), src: p, big: p.frame === cur });
  }
  const ly = lc.map(p => p.y), lo = ly.length ? Math.min(0.5, pct(ly, 0.02)) : 0, hi = ly.length ? Math.max(1.5, pct(ly, 0.98)) : 2;
  const check = own ? followedChange(pts) : realityCheck(lc);
  // the note under this plot is written in the page for a star (its brightness against its own spectrum); for a followed comet it says what is drawn instead
  const lcnote = $('lcnote');
  if (lcnote) { lcnote.dataset.usual ??= lcnote.textContent; lcnote.textContent = own ? G`Each measurement of the comet in the selected detector, on a scale in powers of ten: its visits lie far apart in brightness. Hollow points of the spectrum are left out.` : lcnote.dataset.usual; }
  lcPlot.set(lc, own ? {
    xlabel: G`date`, ylabel: G`brightness (${unit})`, logY: true, ylim: [floor, 2 * peak], xTicks: dateTicks,
    empty: S.failed ? G`No images to measure` : G`Waiting for the images…`,
    tipText: p => `${C.fmtDate(p.x)} · ${p.y.toFixed(p.y >= 100 ? 0 : 2)} ${unit} · ${p.src.lam.toFixed(2)} µm`,
    onPick: p => jumpTo(p.src),
  } : {
    xlabel: G`date`, ylabel: G`relative brightness`, ylim: [lo - 0.1, hi + 0.1], hline: 1, errors: lc.length < 400,
    band: check?.steady != null ? { y0: 1 - check.steady, y1: 1 + check.steady } : null,
    xTicks: dateTicks, empty: pts.length ? G`Too faint (or saturated) in D${S.det} to measure changes` : S.failed ? G`No images to measure` : !S.grid ? G`Waiting for the images…` : G`Click or tap a star in the image`,
    tipText: p => `${C.fmtDate(p.x)} · ×${p.y.toFixed(2)} · ${p.src.lam.toFixed(2)} µm`,
    onPick: p => jumpTo(p.src),
  });
  renderMolecules(own ? pts : steadied(pts));
  $('lctitle').textContent = G`Brightness over time · D${S.det} (${C.DET_BANDS[S.det].join('–')} µm)`;
  $('speclegend').innerHTML = (S.head?.epochs || []).map((e, i) => `<span><i style="background:${C.EPOCH_COLORS[i % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((e[0] + e[1]) / 2)}</span>`).join('');
  const loadingMore = !!S.head && [1, 2, 3, 4, 5, 6].some(d => +S.head.avail[d] > 0 && !S.dets[d]?.done);
  const haloNote = !S.haloDets?.length ? ''
    : relative ? G`<b>Too bright for the camera in ${loadingMore ? G`the detectors loaded so far` : G`every detector`}.</b> The star's core is saturated, so it is measured from its faint outer glow instead (hollow points). The scale is relative${loadingMore ? G` until the other detectors arrive` : ''}; the changes over time are real. `
      : G`<b>Too bright for the camera in ${S.haloDets.map(d => 'D' + d).join(', ')}.</b> There the star's core is saturated, so it is measured from its faint outer glow and each detector is scaled to join its neighbour (hollow points). The overall shape is right; the level and the fine detail are approximate. `;
  const hollow = !S.haloDets?.length ? '' : relative ? G` The star is too bright for the camera, so the scale is relative (hollow points).` : G` Hollow points (${S.haloDets.map(d => 'D' + d).join(', ')}): the star is too bright for the camera there, so they are approximate.`;
  $('specnote').innerHTML = !pts.length ? '' : own ? G`<p class="hint">Each point is one exposure, coloured by visit: ${pts.length} so far. Click a point to see that exposure. Hollow points: a star behind the comet, or faulty pixels, add to that exposure.</p>
    <details><summary>How this is measured</summary><p class="hint">Every exposure is cut out around the comet and sees it at a different wavelength, so stepping through them builds a spectrum. Measured in a circle of 9″ radius around its centre, with the sky taken from a ring 100″ to 140″ away, clear of most of its glow. A comet's glow has no edge: this is the part of it nearest the nucleus. The scale runs in powers of ten, so that the faint visit and the bright one both show; a measurement at or below the floor of the plot sits on its bottom line. Hollow points are exposures in which catalogued stars behind the comet add a quarter or more of the light measured (Gaia, 2MASS and WISE say where they are and how bright), or in which the pipeline marks a quarter of the circle as faulty.</p></details>`
    : G`<p class="hint">Each point is one exposure, coloured by visit: ${pts.length} so far. Click a point to see that exposure.${hollow}</p>
    <details><summary>How this is measured</summary><p class="hint">${haloNote}Every exposure sees the spot at a different wavelength, so stepping through time builds a spectrum. Measured in a circle of 9″ radius, which reads roughly 10 to 15% low because some starlight falls outside it.</p></details>`;
}
/** Take out visit-to-visit brightness changes, detector by detector, so that a variable star's
 *  spectrum from different visits lines up before absorption bands are measured in it. */
function steadied(pts) {
  const med = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const out = [];
  for (let d = 1; d <= 6; d++) {
    const v = pts.filter(p => p.det === d);
    if (v.length < 8) { out.push(...v); continue; }
    const ref = C.referenceSpectrum(v), by = new Map();
    for (const p of v) { const r = ref(p.lam); if (!(r > 0)) continue; const k = gEpoch(p.mjd); if (!by.has(k)) by.set(k, []); by.get(k).push(p.flux / r); }
    const fac = new Map([...by].map(([k, a]) => [k, a.length >= 3 ? med(a) : 1]));
    for (const p of v) { const f = fac.get(gEpoch(p.mjd)); out.push(f > 0.2 && f < 5 ? { ...p, flux: p.flux / f, err: p.err / f } : p); }
  }
  return out;
}
/**
 * A followed comet has brightened or faded from one visit to the next: said in the detector on show, from the middle
 * value of each visit's measurements. No star is there to compare with, and none is needed for a change this large.
 */
function followedChange(pts) {
  const el = $('lccheck'), by = new Map(), mid = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  for (const p of pts) if (p.det === S.det && !p.spoiled) { const k = gEpoch(p.mjd); if (!by.has(k)) by.set(k, []); by.get(k).push(p.flux); }
  const v = [...by].filter(([, a]) => a.length >= 5).sort((a, b) => a[0] - b[0]).map(([k, a]) => ({ k, n: a.length, mid: mid(a) }));
  const a = v[0], z = v[v.length - 1];
  if (v.length < 2 || !(a.mid > 0) || !(z.mid > 0)) { el.innerHTML = ''; S.find.change = null; renderFindings(); return null; }
  const eps = S.head.epochs, when = x => C.fmtMonth((eps[x.k][0] + eps[x.k][1]) / 2), up = z.mid >= a.mid, times = up ? z.mid / a.mid : a.mid / z.mid;
  const shown = times >= 10 ? String(Math.round(times)) : times.toFixed(1), vis = S.target.body?.visits || [], far = vis[a.k], near = vis[z.k];
  const au = x => x.sun.map(d => d.toFixed(2)).join('–');
  const where = far && near ? G` It was ${au(far)} au from the Sun at the first of those visits and ${au(near)} au at the last: 1 au is the distance from the Earth to the Sun.` : '';
  el.innerHTML = up
    ? G`<p class="hint verdict"><b>${shown} times as bright in ${when(z)} as in ${when(a)}</b>, in D${S.det}: the middle value of ${z.n} exposures against that of ${a.n}, each the light within 9″ of the comet's centre.${where}</p>`
    : G`<p class="hint verdict"><b>${shown} times fainter in ${when(z)} than in ${when(a)}</b>, in D${S.det}: the middle value of ${z.n} exposures against that of ${a.n}, each the light within 9″ of the comet's centre.${where}</p>`;
  S.find.change = { cls: 'found', html: up ? G`<b>${shown} times as bright in ${when(z)} as in ${when(a)}</b>, in D${S.det}.` : G`<b>${shown} times fainter in ${when(z)} than in ${when(a)}</b>, in D${S.det}.` };
  renderFindings();
  return null;
}
/** A followed comet: which gases glow around it, visit by visit. What counts as a glow is said in core.js (glowBands). */
function renderGlow(pts) {
  const el = $('molecules'), eps = S.head?.epochs || [], good = pts.filter(p => !p.spoiled && !p.halo);
  const visits = eps.map((e, k) => ({ when: C.fmtMonth((e[0] + e[1]) / 2), rows: C.glowBands(good.filter(p => gEpoch(p.mjd) === k)) })).filter(v => v.rows.some(m => m.times !== null));
  if (!S.showBands || !visits.length) { el.innerHTML = ''; S.find.bands = null; renderFindings(); return; }
  const and = a => (a.length > 1 ? G`${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);
  const lit = visits.map(v => ({ when: v.when, names: v.rows.filter(m => m.glows).map(m => G(m.said)) })).filter(v => v.names.length);
  S.find.bands = lit.length ? { cls: 'found', html: G`<b>Gas glowing around it:</b> ${lit.map(v => `${and(v.names)} (${v.when})`).join('; ')}.` } : null;
  renderFindings();
  const cell = m => (m.times === null ? '–' : !m.glows ? G`no clear glow` : m.times > 100 ? G`more than ×100` : `×${m.times >= 10 ? Math.round(m.times) : m.times.toFixed(1)}`);
  const rows = C.GASES.map((g, i) => `<tr><td>${G(g.name)} <span class="none">${g.f}</span></td><td>${g.band[0].toFixed(2)}–${g.band[1].toFixed(2)}</td>${visits.map(v => `<td class="${v.rows[i].glows ? 'peak' : 'none'}">${cell(v.rows[i])}</td>`).join('')}</tr>`).join('');
  el.innerHTML = G`<table class="t mol"><thead><tr><th>Gas</th><th>Band <span class="asis">(µm)</span></th>${visits.map(v => `<th>${v.when}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">×49 means: inside the band the comet is, at its brightest measurement there, 49 times as bright as in the plain spectrum beside the band. A gas around a comet takes up sunlight and gives it back at its own wavelengths: that is the glow. It counts when two or more measurements in the band stand clear of the spectrum beside it; hollow points are left out. The SPHEREx team reports these gases from the same exposures: <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html" target="_blank" rel="noopener">its papers, listed at IRSA</a>.</p>`;
}
function renderMolecules(pts) {
  if (followed()) return renderGlow(pts);
  const el = $('molecules');
  if (!S.showBands || pts.length < 30) { el.innerHTML = ''; S.find.bands = null; renderFindings(); return; }
  // A star or a brown dwarf is checked for the gases of its atmosphere; a body of the solar system, which shines by
  // reflected sunlight, for the ices on its surface, and only what is found is said: most asteroids carry none.
  const body = !!bodyStops(), rowsData = body ? C.bandDepths(pts, C.ICES, true) : C.bandDepths(pts);
  if (body && !rowsData.some(m => m.depth !== null && m.depth > 0.12 && m.depth > 4 * m.err)) { el.innerHTML = ''; S.find.bands = null; renderFindings(); return; }
  {
    // The table below, said in one line. Only what is beyond doubt makes the headline: a band has to
    // stand out by six times its uncertainty here, against four in the table. What passes the table's
    // test but not this one is called possible.
    const seen = m => m.depth !== null && Math.abs(m.depth) > 0.12 && Math.abs(m.depth) > 4 * m.err;
    const sure = m => seen(m) && Math.abs(m.depth) > 0.15 && Math.abs(m.depth) > 6 * m.err;
    const short = { 'Water vapour': G`water`, 'Carbon monoxide, methane': G`carbon monoxide or methane`, 'Methane, or water ice': G`methane or water ice`, 'Carbon dioxide, gas or ice': G`carbon dioxide`, 'Carbon monoxide': G`carbon monoxide`, 'Methane ice': G`methane ice` };
    const and = a => (a.length > 1 ? G`${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a[0]);
    const names = rows => [...new Set(rows.map(m => short[m.name] || G(m.name).toLowerCase()))];
    const dips = names(rowsData.filter(m => sure(m) && m.depth > 0)), maybe = names(rowsData.filter(m => seen(m) && !sure(m) && m.depth > 0)).filter(x => !dips.includes(x));
    const glows = [...new Set(rowsData.filter(m => sure(m) && m.depth < 0).map(m => G(m.glow || 'Something').replace(/^./, c => c.toLowerCase())))];
    const measured = rowsData.filter(m => m.depth !== null).length;
    S.find.bands = dips.length || glows.length
      ? { cls: 'found', html: `${dips.length ? G`<b>Dips in its spectrum</b> where these absorb: ${dips.join('; ')}` : ''}${dips.length && glows.length ? '. ' : ''}${glows.length ? G`<b>Glow</b> from ${and(glows)}` : ''}.` }
      : maybe.length ? { cls: 'unsure', html: G`<b>A possible dip</b> in its spectrum where ${maybe.join('; ')} absorb${maybe.length > 1 ? '' : 's'}.` }
        : measured >= 4 && !rowsData.some(seen) ? { cls: 'none', html: G`<b>Smooth spectrum:</b> no dips at the molecule bands checked.` } : null;
    renderFindings();
  }
  let glow = false;
  const whyNot = m => (m.why === 'star too bright to tell' ? G`the star is too bright for the camera` : m.why === 'too faint to tell' ? G`the spot is too faint` : m.why === 'too uneven to tell' ? G`the measurements scatter too much` : G`there are not enough measurements yet`);
  const unmeasured = rowsData.filter(m => m.depth === null);
  const rows = rowsData.filter(m => m.depth !== null).map(m => {
    let cls = 'none', txt = G`flat`;
    {
      const pc = Math.round(Math.abs(m.depth) * 100), sure = Math.abs(m.depth) > 4 * m.err;
      if (m.depth > 0.12 && sure) { cls = 'dip'; txt = G`${pc}% dip`; }
      else if (m.depth < -0.12 && sure) { cls = 'peak'; txt = G`${pc}% brighter`; glow = true; }
    }
    // Brighter inside the band than beside it: nothing absorbs there, something glows.
    const label = cls === 'peak' ? `${G(m.glow || 'Something glowing')} <span class="none">${G`emission`}</span>` : `${G(m.name)} <span class="none">${m.f}</span>`;
    return `<tr><td>${label}</td><td>${m.band[0].toFixed(2)}–${m.band[1].toFixed(2)}</td><td class="${cls}">${txt}</td></tr>`;
  }).join('');
  if (rowsData.every(m => m.depth === null)) {
    el.innerHTML = G`<p class="hint">Molecule bands cannot be measured here: ${whyNot(rowsData.find(m => m.why === 'star too bright to tell') || rowsData.find(m => m.why === 'too faint to tell') || rowsData.find(m => m.why === 'too uneven to tell') || {})}.</p>`;
    return;
  }
  el.innerHTML = G`<table class="t mol"><thead><tr><th>Molecule</th><th>Band <span class="asis">(µm)</span></th><th>Measured</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">How much fainter the spot is inside each band than just outside it. A dip is a hint that the molecule is there, not proof.${(glow ? G` Where a band is brighter instead, hot gas or dust is glowing at that wavelength.` : '') + (unmeasured.length ? G` Bands that could not be measured: ${unmeasured.length} (${[...new Set(unmeasured.map(whyNot))].join('; ')}).` : '')}</p>`;
}
function markCurrent() {
  const cur = S.seq[S.idx]?.frame;
  for (const pl of [specPlot, lcPlot]) { for (const p of pl.pts) p.big = !!cur && p.src.frame === cur; pl.draw(); }
}
function jumpTo(src) {
  S.wantPlay = false; stop();
  S.det = src.det; S.mode = 'frames';
  renderModes(); renderDets(); rebuild();
  const i = S.seq.findIndex(it => it.frame === src.frame);
  if (i >= 0) { S.idx = i; show(); }
  syncUrl();
}

/**
 * The answer first: what the sections below have measured, in a few words each. Every line is
 * written by the function that makes the detailed section, from the same numbers, so the two
 * cannot disagree. Shown once the detector on show has arrived in full.
 */
function renderFindings() {
  const el = $('findings');
  if (!el) return;
  const f = S.find || {}, ready = !!S.dets[S.det]?.done, here = lightHere();
  const rows = ready ? [['here', here], ['motion', f.motion], ['lccheck', f.change], ['molecules', f.bands], ['movers', S.sel?.trail ? null : f.movers || stillLooking()]].filter(r => r[1]) : [];
  const html = rows.length ? G`<h2>What the measurements say</h2><ul>${rows.map(([to, r]) => G`<li class="${r.cls}"><button type="button" data-to="${to}" title="Show how this was measured">${r.html}</button></li>`).join('')}</ul>` : '';
  if (el.dataset.was !== html) { el.dataset.was = html; el.innerHTML = html; }
  el.hidden = !rows.length;
  leadState();
}
/**
 * The ringed spot itself: was the light there one of the bodies that passed through the field? A visitor who rings a
 * dot that is in one visit and gone in the next is asking exactly this. Within 12 arcseconds of the ring (its own
 * radius is 9) at one stop of the telescope counts.
 */
/** A field read live is searched once all six detectors have arrived, which takes minutes when it is wide: said meanwhile. */
function stillLooking() {
  if (S.target || S.hunt || S.failed || !S.grid || !S.head) return null;          // a showcase object is searched in seconds; a hunt tells its own story
  const all = [1, 2, 3, 4, 5, 6].every(d => S.dets[d]?.done);
  if (S.movers ? S.movers.state !== 'working' : all) return null;
  return { cls: 'wait', html: G`<b>Still looking</b> for asteroids and other bodies passing through this field…` };
}
function lightHere() {
  const ring = S.sel && S.sel.x != null && S.grid ? S.sel : null, tracks = S.movers?.state === 'done' ? S.movers.tracks : null;
  if (!ring || !tracks) return null;
  for (const t of tracks) {
    if (t.body?.own) continue;
    const q = t.sightings.find(v => Math.hypot(v.x - ring.x, v.y - ring.y) * S.grid.scale < 12);
    if (q) return { cls: 'found', follow: t, html: G`<b>The light in the ring: ${esc(bodyLabel(t))}</b>, which passed through this very spot on ${C.fmtDate(q.mjd, true)} and moved on. Press this line to follow it.` };
  }
  return null;
}
/** The lead of the panel (what to look for, what the measurements say) takes no room while it has nothing to say. */
function leadState() { document.querySelector('.cols').classList.toggle('nolook', !$('lookbox').innerHTML && $('findings').hidden && $('bodybox').hidden && $('huntbox').hidden); }
$('findings').addEventListener('click', e => {
  const to = e.target.closest('button')?.dataset.to;
  if (to === 'here') { const t = lightHere()?.follow; if (t) followBody(t); return; }
  if (to) $(to)?.scrollIntoView({ behavior: calmMotion() ? 'auto' : 'smooth', block: 'center' });
});

// ------------------------------------------------------------ is the change real?
/**
 * Bright, isolated, unsaturated stars in the stacked image of the selected detector: the yardstick.
 * A star close to a much brighter target sits in that target's glow and would follow its changes,
 * so the fainter a star is compared with the target, the farther away it has to be.
 */
function findComparisons(targetFlux = 0) {
  const g = S.grid, n = g.n, img = S.deep, frames = usable(S.det);
  if (!img || frames.length < 6) return [];
  const noise = pct(frames.map(f => f.sig), 0.5);              // per-pixel noise of one exposure
  const edge = Math.ceil(34 / g.scale), peaks = [];
  for (let j = edge; j < n - edge; j++) for (let i = edge; i < n - edge; i++) {
    const v = img[j * n + i];
    if (!(v > 0)) continue;
    let top = true;
    for (let dj = -2; dj <= 2 && top; dj++) for (let di = -2; di <= 2; di++) {
      const u = img[(j + dj) * n + i + di];
      if (u !== u || u > v) { top = false; break; }          // masked pixels nearby: a saturated star, no use as a yardstick
    }
    if (!top) continue;
    // Bright enough to be measured to about 15% or better in a single exposure.
    const a = C.aperture(img, n, g.scale, i, j, noise);
    if (a && a.flux > 6.5 * a.err) peaks.push({ x: i, y: j, v: a.flux });
  }
  peaks.sort((a, b) => b.v - a.v);
  const eps = S.head?.epochs || [];
  // Never the catalogued target itself, nor whatever is circled at the moment.
  const mine = [...(S.track ? eps.map(e => trackPos((e[0] + e[1]) / 2)) : []), ...(S.sel && S.sel.x != null ? [[S.sel.x, S.sel.y]] : [])].filter(m => m[0] === m[0]);
  const crowd = 26 / g.scale;
  const clear = p => mine.every(m => {
    const d = Math.hypot(m[0] - p.x, m[1] - p.y) * g.scale;                       // arcseconds from the target
    return d >= 40 && p.v >= targetFlux * 0.006 * Math.pow(40 / d, 2.2);
  });
  return peaks.filter(p => clear(p) && !peaks.some(q => q !== p && q.v > 0.3 * p.v && Math.hypot(q.x - p.x, q.y - p.y) < crowd))
    .slice(0, 5).map(p => C.centroid(img, n, p.x, p.y, 2) || p);
}
/**
 * How much did the circled spot change from visit to visit, and how much did ordinary stars in the
 * very same images change? If they stayed steady and the spot did not, the change is in the sky.
 */
function realityCheck(lc) {
  const el = $('lccheck'), eps = S.head?.epochs || [];
  const med = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const perVisit = rows => {                                   // rows: [{mjd, ratio}] -> ratios per visit
    const by = new Map();
    for (const r of rows) { const k = gEpoch(r.mjd); if (!by.has(k)) by.set(k, []); by.get(k).push(r.ratio); }
    return by;
  };
  const tv = perVisit(lc.map(p => ({ mjd: p.x, ratio: p.y })));
  const visits = [...tv.keys()].filter(k => tv.get(k).length >= 5).sort((a, b) => a - b);
  if (!S.grid || visits.length < 2) { el.innerHTML = ''; S.find.change = null; renderFindings(); return null; }
  const base = med(tv.get(visits[0]));
  const target = visits.map(k => { const v = tv.get(k), m = med(v); return { k, n: v.length, rel: m / base, err: 1.4826 * med(v.map(x => Math.abs(x - m))) / Math.sqrt(v.length) / base }; });
  const mine = (S.pts || []).filter(p => p.det === S.det);
  const sn = mine.length ? med(mine.map(p => Math.abs(p.flux) / p.err)) : 0;                    // how well one exposure measures the spot
  const relative = S.haloDets?.length > 0 && !S.haloAnchored;
  const flux = relative ? Infinity : mine.length ? med(mine.map(p => p.flux)) : 0;
  // the same measurement on comparison stars
  const g = S.grid, n = g.n, c = (n - 1) / 2, frames = usable(S.det), comps = [];
  for (const s of findComparisons(flux)) {
    const pts = [];
    for (const f of frames) {
      const a = C.aperture(f.data, n, g.scale, s.x, s.y, f.sig);
      if (a && a.flux > 0) pts.push({ lam: f.lam + f.lgx * (s.x - c) + f.lgy * (s.y - c), flux: a.flux, mjd: f.mjd });
    }
    if (pts.length < 0.6 * frames.length) continue;
    const ref = C.referenceSpectrum(pts), pv = perVisit(pts.map(p => ({ mjd: p.mjd, ratio: p.flux / ref(p.lam) })));
    if (!visits.every(k => (pv.get(k)?.length || 0) >= 3)) continue;
    const b = med(pv.get(visits[0]));
    comps.push(visits.map(k => med(pv.get(k)) / b));
  }
  // "within X%": the largest departure among the comparison stars (leaving out the single worst when there are four or more)
  const steadyAt = i => {
    if (comps.length < 2) return null;
    const d = comps.map(cs => Math.abs(cs[i] - 1)).sort((x, y) => y - x);
    return Math.max(0.01, comps.length >= 4 ? d[1] : d[0]);
  };
  const steady = comps.length >= 2 ? Math.max(...visits.slice(1).map((_, i) => steadyAt(i + 1))) : null;
  const biggest = target.slice(1).reduce((m, t) => (Math.abs(t.rel - 1) > Math.abs(m.rel - 1) ? t : m), target[1]);
  const change = Math.abs(biggest.rel - 1), sig = change / Math.max(Math.hypot(biggest.err, target[0].err), 1e-3);
  const pc = v => G`${Math.round(v * 100)}%`;
  const stars = Lang.N(comps.length, 'ordinary star');
  let verdict, word = 'none';
  if (sn < 5) verdict = G`The spot is too faint in D${S.det} to check for changes: one exposure measures it only to about ${pc(Math.min(1, 1 / Math.max(sn, 1)))}. Try a detector where it is brighter.`;
  else if (steady == null) verdict = relative
    ? G`A change of ${pc(change)} between visits. It cannot be checked against other stars here: next to a star this bright, every faint neighbour sits in its glow.`
    : G`A change of ${pc(change)} between visits. There are not enough ordinary stars in this small field to check it against.`;
  else if (change >= Math.max(3 * steady, 0.08) && sig >= 5) { word = 'real'; verdict = G`<b>The change is real.</b> The spot ${biggest.rel > 1 ? G`brightened` : G`faded`} by ${pc(change)} between visits in D${S.det}, while ${stars} in the same images stayed constant to within ${pc(steady)}.`; }
  else if (change >= Math.max(2 * steady, 0.04) && sig >= 3) { word = 'maybe'; verdict = G`Possibly changing: ${pc(change)} between visits in D${S.det}, against ${pc(steady)} for ${stars} in the same images. Worth a closer look.`; }
  else { word = 'steady'; verdict = G`<b>No significant change.</b> Between visits the spot differs by ${pc(change)} in D${S.det}; ${stars} in the same images differ by up to ${pc(steady)}.`; }
  const rows = visits.length <= 6 ? G`<table class="t"><thead><tr><th>${S.head.split ? G`Month` : G`Visit`}</th><th>This spot</th><th>Ordinary stars</th></tr></thead><tbody>${target.map((t, i) =>
    `<tr><td><i style="background:${C.EPOCH_COLORS[t.k % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((eps[t.k][0] + eps[t.k][1]) / 2)}</td><td>${i ? `×${t.rel.toFixed(2)}` : G`reference`}</td><td>${i ? (steadyAt(i) == null ? '–' : G`within ${pc(steadyAt(i))}`) : ''}</td></tr>`).join('')}</tbody></table>` : '';
  el.innerHTML = `${sn >= 5 ? rows : ''}<p class="hint verdict">${verdict}${steady != null && sn >= 5 ? G` The grey band in the plot is that steadiness.` : ''}</p>`;
  const spread = Math.max(...target.map(t => t.rel)) - Math.min(...target.map(t => t.rel));      // from the faintest visit to the brightest
  S.find.change = sn < 5 ? null
    : word === 'real' ? { cls: 'found', html: G`<b>${biggest.rel > 1 ? G`Brightened` : G`Faded`} by ${pc(change)}</b> between visits in D${S.det}, while ${stars} nearby stayed within ${pc(steady)}.` }
    : word === 'maybe' ? { cls: 'unsure', html: G`<b>Possibly changing:</b> ${pc(change)} between visits in D${S.det}, against ${pc(steady)} for the stars nearby.` }
    : word === 'steady' ? { cls: 'none', html: G`<b>Brightness steady:</b> within ${pc(change)} between visits in D${S.det}, like the stars nearby.` }
    : spread >= 0.08 ? { cls: 'unsure', html: G`<b>Varies by ${pc(spread)}</b> from visit to visit in D${S.det}; there are no ordinary stars here to check it against.` } : null;
  renderFindings();
  return { steady: sn >= 5 ? steady : null, comps: comps.length, word };
}

// ------------------------------------------------------------ every star in the field
/**
 * Check every measurable star of the field, in the selected detector, for the two things this
 * tool is about: did it move, and did its brightness change between visits? The yardstick is the
 * field itself: most stars do neither, so the typical star tells how well positions and
 * brightnesses repeat here. Flags are prompts to look, never findings.
 */
function scanField() {
  const g = S.grid, n = g.n, c = (n - 1) / 2, img = S.deep, frames = usable(S.det), stacks = S.stacks || [];
  if (!img || frames.length < 8 || stacks.length < 2) return null;
  const med = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  const noise = pct(frames.map(f => f.sig), 0.5), edge = Math.ceil(34 / g.scale);
  // every clear, unsaturated star
  const stars = [], sat = [];
  for (let j = 2; j < n - 2; j++) for (let i = 2; i < n - 2; i++) {
    const v = img[j * n + i];
    if (v !== v) { if ([img[j * n + i - 1], img[j * n + i + 1], img[(j - 1) * n + i], img[(j + 1) * n + i]].some(u => u > 40 * S.deepSig)) sat.push([i, j]); continue; }
    if (!(v > 0) || i < edge || j < edge || i >= n - edge || j >= n - edge) continue;
    let top = true;
    for (let dj = -2; dj <= 2 && top; dj++) for (let di = -2; di <= 2; di++) { const u = img[(j + dj) * n + i + di]; if (u !== u || u > v) { top = false; break; } }
    if (!top) continue;
    const a = C.aperture(img, n, g.scale, i, j, noise);
    if (a && a.flux > 6.5 * a.err) stars.push({ x: i, y: j, flux: a.flux });
  }
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) * g.scale;
  const usableStars = stars.filter(s =>
    !sat.some(([i, j]) => Math.hypot(i - s.x, j - s.y) * g.scale < 90)                                   // in the glow of a saturated star
    && !stars.some(b => b !== s && b.flux > s.flux && s.flux < b.flux * 0.006 * Math.pow(40 / Math.max(40, dist(s, b)), 2.2))   // in the glow of a brighter one
    && !stars.some(b => b !== s && b.flux > 0.3 * s.flux && dist(s, b) < 13)                             // blended with a neighbour
    && !stars.some(b => b !== s && b.flux > s.flux && dist(s, b) < 25));                                 // a brighter star close enough to pull its position
  if (usableStars.length < 4) return { checked: usableStars.length, flags: [] };
  const eps = S.head.epochs;
  for (const s of usableStars) {
    const cen = C.centroid(img, n, s.x, s.y, 2); if (cen) { s.x = cen.x; s.y = cen.y; }
    // position in every visit, following it from visit to visit
    let last = [s.x, s.y]; s.pos = [];
    for (const st of stacks) {
      let m = C.locate(st.img, n, last[0], last[1], 3);
      if (m && !(m.peak > 4 * st.sig)) m = null;
      if (m) last = [m.x, m.y];
      s.pos.push(m ? { x: m.x, y: m.y, mjd: st.mjd, sn: m.peak / st.sig } : null);
    }
    const seen = s.pos.filter(Boolean);
    if (seen.length >= 2) {
      const a = seen[0], b = seen[seen.length - 1];
      s.real = lightMoved(stacks[s.pos.indexOf(a)], stacks[s.pos.lastIndexOf(b)], a, b);
      s.dE = -(b.x - a.x) * g.scale; s.dN = (b.y - a.y) * g.scale; s.shift = Math.hypot(s.dE, s.dN);
      s.fuzz = Math.hypot(8 / Math.max(4, a.sn), 8 / Math.max(4, b.sn)); s.years = Math.max((b.mjd - a.mjd) / 365.25, 0.05);
    }
    // brightness in every visit, relative to the star's own spectrum
    const pts = [];
    for (const f of frames) {
      const a = C.aperture(f.data, n, g.scale, s.x, s.y, f.sig);
      if (a && a.flux > 0) pts.push({ lam: f.lam + f.lgx * (s.x - c) + f.lgy * (s.y - c), flux: a.flux, err: a.err, mjd: f.mjd });
    }
    if (pts.length >= 0.6 * frames.length) {
      const ref = C.referenceSpectrum(pts), by = new Map();
      for (const p of pts) { const r = ref(p.lam); if (!(r > 0)) continue; const k = gEpoch(p.mjd); if (!by.has(k)) by.set(k, []); by.get(k).push(p.flux / r); }
      const vis = [...by.keys()].filter(k => by.get(k).length >= 5).sort((a, b) => a - b).map(k => { const v = by.get(k), m = med(v); return { k, m, e: 1.4826 * med(v.map(x => Math.abs(x - m))) / Math.sqrt(v.length) }; });
      if (vis.length >= 2) {
        let best = null;
        for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
          const ch = vis[j].m / vis[i].m - 1, sig = Math.abs(vis[j].m - vis[i].m) / Math.max(Math.hypot(vis[i].e, vis[j].e), 1e-4);
          if (!best || Math.abs(ch) > Math.abs(best.ch)) best = { ch, sig, from: vis[i].k, to: vis[j].k };
        }
        s.change = best;
      }
    }
  }
  // the field's own yardsticks: how the typical star behaves
  const shifts = usableStars.filter(s => s.shift != null).map(s => s.shift), changes = usableStars.filter(s => s.change).map(s => Math.abs(s.change.ch));
  const align = shifts.length >= 3 ? Math.max(0.3, 1.5 * med(shifts)) : 0.8, steady = changes.length >= 3 ? Math.max(0.01, 1.5 * med(changes)) : 0.05;
  const flags = [];
  for (const s of usableStars) {
    const own = S.track && eps.some(e => { const t = trackPos((e[0] + e[1]) / 2); return Math.hypot(t[0] - s.x, t[1] - s.y) < 4; });
    if (s.shift != null && s.real && s.shift > Math.max(3.5 * Math.hypot(align, s.fuzz), 2)) {
      flags.push({ s, own, kind: 'moved', text: G`Moved ${s.shift.toFixed(1)}″ ${compass(s.dE, s.dN)}`, note: G`about ${(s.shift / s.years).toFixed(1)}″ per year` });
    } else if (s.change && Math.abs(s.change.ch) >= Math.max(0.15, 5 * steady) && s.change.sig >= 6) {
      const mon = k => C.fmtMonth((eps[k][0] + eps[k][1]) / 2);
      flags.push({ s, own, kind: 'changed', text: G`${s.change.ch > 0 ? G`Brightened` : G`Faded`} by ${Math.round(Math.abs(s.change.ch) * 100)}%`, note: G`between ${mon(s.change.from)} and ${mon(s.change.to)}` });
    }
  }
  return { checked: usableStars.length, flags, align, steady };
}
let scanKey = '', scanResult = null;
function renderScan() {
  const el = $('scan');
  if (!el) return;
  const D = S.dets[S.det];
  // (a followed body has other stars behind it in every exposure: there is no field of stars to check)
  if (!S.grid || !D?.done || !S.stacks || S.stacks.length < 2 || followed()) { el.innerHTML = ''; scanResult = null; scanKey = ''; return; }
  const key = `${S.gen}:${S.det}:${D.frames.length}:${[...S.off].join()}`;
  if (key !== scanKey) { scanKey = key; try { scanResult = scanField(); } catch (e) { console.error(e); scanResult = null; } }
  const r = scanResult;
  if (!r || r.checked < 4) { el.innerHTML = r ? G`<p class="hint">Too few clear stars in this field to check them against each other.</p>` : ''; return; }
  const steadyN = r.checked - r.flags.length;
  const head = G`<p class="hint verdict"><b>Every clear star in this field, checked.</b> ${r.checked} stars in D${S.det}: ${r.flags.length ? G`${steadyN} did not move or change, ${r.flags.length} stand${r.flags.length === 1 ? 's' : ''} out.` : G`none moved, none changed.`} Here, positions repeat to ${r.align.toFixed(1)}″ and brightness to ${Math.round(r.steady * 100)}%.</p>`;
  const list = r.flags.length ? `<ul class="flags">${r.flags.map((f, i) => `<li><button type="button" data-flag="${i}">${f.text}</button><span>${f.note}${f.own ? G` · the catalogued object` : ''}</span></li>`).join('')}</ul>
    <p class="hint">${G`Press one to circle it. A flag is a reason to look, not a finding: check it in another detector and in the tools above.`}</p>` : '';
  el.innerHTML = head + list;
  el.querySelectorAll('[data-flag]').forEach(b => { b.onclick = () => {
    const f = r.flags[+b.dataset.flag];
    S.sel = f.own ? { follow: true } : { x: f.s.x, y: f.s.y };
    if (S.mode === 'trail') { rebuild(); renderMovers(); }
    paint(); renderMeta(); renderMotion(); refreshPlots();
    $('sky').scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
  }; });
}

// ------------------------------------------------------------ side panels
function renderChips() {
  const el = $('examples'); el.innerHTML = '';
  for (const t of [...S.targets.filter(x => x.extra), ...tourTargets()]) {          // a link to the object's plain page (a search engine, a new tab); a plain press opens the object here
    const a = document.createElement('a'), file = OBJECT_FILES[t.slug];
    a.href = file ? (Lang.lang === 'en' ? '' : `${Lang.lang}/`) + file : `?target=${t.slug}`;
    a.textContent = nameOf(t);
    a.onclick = e => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); openTarget(t); };
    el.appendChild(a);
  }
  // Suggestions on which the tool has been tried: nearby fast movers, brown dwarfs, a nebula, a galaxy.
  const en = Lang.lang === 'en';
  $('suggest').innerHTML = [...S.targets.map(nameOf), 'Proxima Centauri', 'Luhman 16', 'Wolf 359', ...(en ? ["Teegarden's Star", "Kapteyn's Star"] : []), 'NGC 7027', en ? 'Andromeda Galaxy' : 'M31', 'Ceres', '4 Vesta', '433 Eros',
    { tr: 'Uranüs', es: 'Urano', pl: 'Uran' }[Lang.lang] || 'Uranus', '2P/Encke']
    .map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
}
const openTarget = t => go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, ...(t.view || { mode: 'epochs' }) });
$('heroshot').onclick = () => {          // the front page's picture: Barnard's Star over 26 years, opened in the Years view
  const t = S.targets.find(x => x.slug === 'barnard');
  if (t) go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, det: t.view?.det || 5, mode: 'years' });
  else location.search = '?target=barnard&mode=years';          // pressed before the list of objects has arrived
};

function openPanel() {
  if ($('app').dataset.panel === 'open') return;
  $('app').dataset.panel = 'open'; $('welcome').hidden = true;
  if (Sky.isReady()) Sky.resize();
  requestAnimationFrame(() => { paint(); specPlot.draw(); lcPlot.draw(); });
}
function closePanel() {
  coachEnd();
  S.abort?.abort(); S.gen++; stop();
  const shut = () => { $('app').dataset.panel = 'closed'; if (Sky.isReady()) { Sky.clearMark(); Sky.resize(); } };
  if (Sky.isReady()) Sky.reshape(shut); else shut();
  history.replaceState(null, '', location.pathname);
  document.title = HOME_TITLE;
}
/** The page's own title, in the language in use. */
const HOME_TITLE = Lang.lang === 'en' ? document.title : `Chronosphere — ${T('hero.title').replace(/\.$/, '')}`;

/** Find out what the selected spot is, then look for an encyclopedia card. */
async function loadInfo(gen) {
  try {
    if (!S.info) {
      const found = await Info.identifyFull(S.ra, S.dec, 10, 6).catch(() => null);      // within one SPHEREx pixel, the brightest object is the one whose light is seen
      if (gen !== S.gen) return;
      if (!found) { S.infoState = 'failed'; renderAbout(); return; }          // the catalogue did not answer
      S.info = found.best; S.moved = found.moved;
      if (S.info && !S.target && Sky.isReady()) Sky.mark(S.ra, S.dec, S.size, S.info.name);      // now the marker can carry its name
    }
    S.infoState = 'done'; renderAbout();
    if (S.target && 'info' in S.target) { S.wiki = S.target.wikiCard || null; renderAbout(); localWiki(gen); return; }      // baked in: no look-up needed
    const titles = [];
    if (S.target?.wiki) titles.push(S.target.wiki);
    if (S.info?.wiki) titles.push(...S.info.wiki);          // a body of the solar system opened by name
    else if (S.info?.oid != null) {
      const ids = await Info.aliases(S.info.oid);
      if (gen !== S.gen) return;
      const common = Info.commonName(ids);          // "Kapteyn's Star" reads better than "HD 33793"
      if (common && !S.target) { S.info.name = common; renderAbout(); if (Sky.isReady()) Sky.mark(S.ra, S.dec, S.size, common); }
      titles.push(...Info.wikiTitles([S.info.mainId, ...ids]));
    }
    if (gen !== S.gen || !titles.length) return;
    S.wiki = await Info.wikipedia(titles);
    if (gen === S.gen && S.wiki) { renderAbout(); localWiki(gen); }
  } catch { S.infoState = 'done'; if (gen === S.gen) renderAbout(); }
}
/** In another language than English: the encyclopedia card from that language's Wikipedia, when it has the article. */
function localWiki(gen) {
  const card = S.wiki;
  if (Lang.locale === 'en' || !card || card.lang) return;
  Info.wikipediaIn(Lang.locale, card).then(c => { if (c && gen === S.gen && S.wiki === card) { S.wiki = c; renderAbout(); } });
}

/** Light-years from a parallax in milliarcseconds, rounded to what the measurement supports. */
function fmtDistance(plx, err) {
  const ly = 3261.5638 / plx, rel = err != null ? err / plx : 0.01;
  const v = Number(ly.toPrecision(rel < 0.003 ? 3 : 2));
  return G`${rel < 0.003 ? '' : G`about `}${NUM2.format(v)} light-years`;
}

function renderAbout() {
  const t = S.target, k = S.track, i = S.info, el = $('about');
  const name = t ? nameOf(t) : i ? i.name : k?.name ? k.name : S.infoState === 'failed' || S.infoState === 'loading' ? G`This spot` : G`Uncatalogued spot`;
  document.title = `${name} · Chronosphere`;          // the tab, the history and a bookmark say which object this is
  const sp = t?.sp || i?.sptype;
  const spHtml = sp ? G` · spectral type <span class="asis">${esc(sp)}</span>` : '';
  const kind = t?.type ? `${esc(G(t.type))}${spHtml}` : i ? `${esc(G(i.type))}${spHtml}`
    : S.infoState === 'loading' ? G`Identifying…` : S.infoState === 'failed' ? G`Not identified` : S.moved ? G`The star that was here has moved on` : G`Nothing catalogued at this spot`;
  // A star that catalogues list here, at its year-2000 place, but that has moved on since.
  const mv = !t && !i ? S.moved : null, mvPm = mv ? Math.hypot(mv.pmra, mv.pmdec) / 1000 : 0;
  const gloss = t ? G(t.blurb) : i ? i.gloss || Info.gloss(i.otype, i.sptype)
    : mv ? G`${mv.name} was at this spot in the year 2000, which is where catalogues still list it. It moves ${mvPm.toFixed(1)}″ a year and is now ${(mv.dist / 60).toFixed(1)}′ away.`
      : S.infoState === 'failed' ? G`The catalogue that names objects could not be reached just now, so this spot is not identified.`
        : S.infoState === 'done' ? G`No catalogue lists an object exactly here. SPHEREx still has images of this patch: what do you see?` : '';
  const facts = [];
  const fact = (label, value, small, title) => facts.push(`<div${title ? ` title="${esc(title)}"` : ''}><dt>${label}</dt><dd>${value}${small ? `<small>${small}</small>` : ''}</dd></div>`);

  // Motion on the sky. Curated values first, then what the look-up returned.
  const pmSrc = t?.pm || (i && i.pmra != null ? i : k && k.pmra != null ? k : null);
  const pm = pmSrc ? Math.hypot(pmSrc.pmra, pmSrc.pmdec) / 1000 : 0;          // arcseconds per year
  const fast = pm > 0.2;
  const body = t?.body || k?.body;
  const led = !!(body?.visits && t?.follow);
  if (led) {
    // A body that is followed: when SPHEREx had it in view, and the two dates of its passage that are asked about most.
    const b = body, on = mjd => C.fmtRange(mjd, mjd);
    fact(G`Seen by SPHEREx`, b.visits.map(v => C.fmtRange(v.t0, v.t1)).join('<br>'), b.visits.map(v => nExp(v.exposures)).join(' + '), G`The days on which SPHEREx had it in view`);
    if (b.peri) fact(G`Closest to the Sun`, on(b.peri.mjd), G`${b.peri.au.toFixed(2)} au; 1 au is the distance from the Earth to the Sun`, G`From ${b.source}`);
    if (b.near) fact(G`Closest to Earth`, on(b.near.mjd), G`${b.near.au.toFixed(2)} au`, G`From ${b.source}`);
  } else if (body) {
    // A body of the solar system has no place of its own in the sky: what is told is when it was here, and where it was then.
    const b = body;
    fact(G`Crossed this field`, span(b.from, b.to), G`${arc(b.moved)} across the sky`, G`The days on which it was inside these images, and how far it moved meanwhile`);
    if (b.mag === b.mag) fact(G`Brightness`, G`magnitude ${b.mag.toFixed(1)}`, G`one SPHEREx exposure reaches about 19`, G`How bright it looked on those days, from ${b.source}`);
    fact(G`Distance`, G`${b.sun.toFixed(1)} au from the Sun`, G`${b.earth.toFixed(1)} au from Earth; 1 au is the distance from the Earth to the Sun`, G`On those days, from ${b.source}`);
  } else {
  const [sra, sdec] = C.fmtSex(S.ra, S.dec).split(' ');
  fact(fast ? G`Position today` : G`Position`, `${sra}<br>${sdec}`,
    fast ? G`${(pm * (yearNow() - 2000)).toFixed(0)}″ from its year-2000 place` : `${S.ra.toFixed(5)}°, ${S.dec >= 0 ? '+' : ''}${S.dec.toFixed(5)}°`,
    fast ? G`Catalogues list where a star was in the year 2000. This one has moved since; the position shown is for today.` : G`Right ascension and declination (ICRS)`);
  if (pmSrc) {
    fact(G`Moves across the sky`, G`${pm.toFixed(pm < 0.1 ? 3 : 2)}″ per year`,
      pm >= 0.3 ? G`${(pm / 6.15).toFixed(2)} SPHEREx pixels a year` : pm > 0.003 ? G`one SPHEREx pixel in ${NUM.format(Math.round(6.15 / pm))} years` : G`too slow to see here`,
      G`Proper motion${pmSrc.src ? `, ${pmSrc.src}` : G`, from SIMBAD`}`);
  }
  // Distance: only from a parallax measured to better than 20%.
  const plx = t?.dist?.plx ?? i?.plx ?? k?.plx, plxErr = t?.dist?.err ?? (i?.plx != null ? i.plxErr : null);
  if (plx > 0 && (plxErr != null ? plx / plxErr >= 5 : plx > 5)) {
    fact(G`Distance`, fmtDistance(plx, plxErr), G(t?.dist?.src || 'from its parallax'),
      G`Parallax ${plx} ${plxErr != null ? `± ${plxErr} ` : ''}milliarcseconds`);
  }
  if (i?.redshift > 0.002) fact(G`Redshift`, i.redshift.toFixed(4), G`its light is stretched by the expanding universe`);
  }
  if (S.head && !led) {
    const eps = S.head.epochs, split = !!S.head.split;
    fact(G`SPHEREx has`, `${S.head.estimated ? G`about ` : ''}${nExp(S.head.total)}`,
      G`${Lang.N(eps.length, split ? 'time slice' : 'visit')}, ${C.fmtMonth(eps[0]?.[0] ?? 0)} to ${C.fmtMonth(eps.at(-1)?.[1] ?? 0)}`);
  }
  const w = S.wiki;
  // The encyclopedia's picture sits in the header only when it is a photograph (see isPhoto).
  const thumb = w?.thumb ? `<a class="thumb" href="${esc(w.url)}" target="_blank" rel="noopener" title="Wikipedia: ${esc(w.title)}"${photos.get(w.thumb) === true ? '' : ' hidden'}><img src="${esc(w.thumb)}" alt="${G`${esc(w.title)}, image from Wikipedia`}"></a>` : '';
  const links = [...(w ? [{ label: 'Wikipedia', title: G`Encyclopedia article: ${w.title}`, url: w.url }] : []), ...(t?.links || []).map(l => ({ ...l, title: G(l.title) })), ...(body ? (body.kind === 'planet' ? [] : Info.bodyLinks(body.number || body.id || t?.label)) : Info.externalLinks(S.ra, S.dec, i))]
    .map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.title)}">${l.label}</a>`).join('');
  // The story first: under the name come what to look for and the pictures. Where it is, how far, how many exposures and
  // the links to other catalogues are one press away, folded under the name.
  const open = factsShown();
  el.innerHTML = `<div class="toprow">
      <div class="idblock"><p class="kind">${kind}</p><h1>${esc(name)}</h1>${gloss ? `<p class="gloss">${esc(gloss)}</p>` : ''}${mv ? G`<p class="gomoved"><button type="button" class="cta" id="gomoved">Go to where it is now</button></p>` : ''}</div>
      ${thumb}<button type="button" class="close" id="closepanel" title="${G`Close and return to the map`}" aria-label="${G`Close`}">×</button>
    </div>
    <div class="factsrow">
      <button type="button" class="factsbtn" id="factsbtn" lang="${Lang.lang}" aria-expanded="${open}" aria-controls="factsbody">${esc(T('panel.facts'))}</button>
      ${S.embed ? '' : `<button type="button" class="howto" id="howto" lang="${Lang.lang}" title="${esc(T('coach.openTitle'))}">${esc(T('coach.open'))}</button>`}
      <div class="factsbody" id="factsbody"${open ? '' : ' hidden'}>
        <dl class="facts">${facts.join('')}</dl>
        <div class="links"><span>${G`Check it in`}</span>${links}</div>
      </div>
    </div>`;
  $('closepanel').onclick = closePanel;
  $('factsbtn').onclick = () => { S.factsOpen = !factsShown(); S.factsCoach = false; showFacts(); };
  if ($('howto')) $('howto').onclick = () => coachGo(0);
  if (mv) $('gomoved').onclick = () => {
    const preset = S.targets.find(x => !x.follow && sepArcsec(mv.ra, mv.dec, x.ra, x.dec) < 20);
    if (preset && fovPick() === preset.size) openTarget(preset);
    else go({ ra: mv.ra, dec: mv.dec, size: fovPick(), track: mv, info: mv });
  };
  if (w?.thumb && !photos.has(w.thumb)) isPhoto(w.thumb).then(() => { if (S.wiki?.thumb === w.thumb) { renderAbout(); } });
  renderLook(); renderWiki(); renderMotion();
}
/** The facts under the name are on show when the visitor opened them, and while the walk through the panel speaks of them. */
const factsShown = () => !!(S.factsOpen || S.factsCoach);
function showFacts() {
  const b = $('factsbtn');
  if (!b) return;
  b.setAttribute('aria-expanded', factsShown()); $('factsbody').hidden = !factsShown();
}
/**
 * Is this picture a photograph, or a chart on a white page? Many star articles lead with a
 * constellation map or a plot; shrunk into the header those read as a blank white square, so the
 * header shows photographs only. The article's card further down shows either kind, uncropped.
 */
const photos = new Map();          // picture address -> true (photograph) | false (chart) | null (it did not load)
function isPhoto(url) {
  return new Promise(done => {
    const im = new Image(), say = v => { photos.set(url, v); done(v); };
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = c.height = 16;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 16, 16);
        const d = g.getImageData(0, 0, 16, 16).data; let paper = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k + 3] < 60 || 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2] > 205) paper++;
        say(paper < 0.4 * 256);
      } catch { say(false); }
    };
    im.onerror = () => say(null);          // not to be had (no connection): no picture at all
    im.src = url;
  });
}
/** Guidance for the showcase objects. The guided tour says the same thing in its own card. */
function renderLook() {
  const t = S.target, b = S.track?.body, on = tourIdx < 0 && !S.embed;
  const look = t?.look ? G(t.look) : b ? G`Each image is one stop of the telescope, in time order. The stars stay where they are; the dot in the ring moves along the dotted line, the path its orbit gives. Under the images, the tool's own search for moving dots reports what it found without being told where to look.` : '';
  // a body opened by name: the other times SPHEREx had it in view are one press away
  const times = b?.visits?.length > 1 ? `<p class="look visits"><b>${G`SPHEREx had it in view at these times`}</b>${b.visits.map(v =>
    `<button type="button" data-at="${v.mjd.toFixed(2)}" aria-pressed="${v.mjd >= b.from - 0.01 && v.mjd <= b.to + 0.01}" title="${esc(G`Stops of the telescope with it in one field: ${v.stops}`)}">${span(v.t0, v.t1).replace(/, .*/, '')}</button>`).join('')}</p>` : '';
  // a showcase star with images of a quarter of a century built for it: one press to watch them
  const Y = t && isPreset() && S.yearsIdx?.[t.slug], years = Y ? Math.round((Y.span[1] - Y.span[0]) / 365.25) : 0;
  const invite = Y ? `<p class="look yearsgo"${S.mode === 'years' ? ' hidden' : ''}><button type="button" data-years>${G`Watch it over ${years} years: 2MASS, WISE, SPHEREx`}</button></p>` : '';
  $('lookbox').innerHTML = on && look ? `<p class="look"><b>${G`What to look for`}</b>${esc(look)}</p>${times}${invite}` : '';
  $('lookbox').querySelectorAll('[data-at]').forEach(x => { x.onclick = () => openBody(b.query, +x.dataset.at); });
  $('lookbox').querySelector('[data-years]')?.addEventListener('click', () => {
    S.mode = 'years'; S.wantPlay = !calmMotion(); renderModes(); rebuild(); syncUrl(); maybeAutoplay();
    $('sky').scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
  });
  leadState();
}
function renderWiki() {
  const w = S.wiki, i = S.info, el = $('wikibox');
  const mags = i ? ['V', 'J', 'K'].filter(b => i.mags?.[b] != null).map(b => `${b} ${(+i.mags[b]).toFixed(1)}`) : [];
  const others = (mags.length > 1 ? G`<p class="others" title="V is visible light; J (1.2 µm) and K (2.2 µm) are near-infrared">Catalogued brightness (SIMBAD): magnitude ${mags.join(', ')}. Lower numbers are brighter.</p>` : '')
    + (i?.others?.length ? G`<p class="others">Also catalogued at this position: ${i.others.map(o => `${esc(o.name)} (${esc(G(o.type))})`).join(', ')}</p>` : '');
  el.hidden = !w && !others;
  el.innerHTML = `${w ? `<h2>${Lang.locale !== 'en' && !w.lang ? G`From Wikipedia (in English)` : G`From Wikipedia`}</h2><div class="wiki">${w.thumb && photos.get(w.thumb) !== null ? `<img src="${esc(w.thumb)}"${photos.get(w.thumb) === false ? ' class="chart"' : ''} alt="" loading="lazy">` : ''}<div><p>${esc(w.extract)}</p><small><a href="${esc(w.url)}" target="_blank" rel="noopener">${G`Read the article: ${esc(w.title)}`}</a></small></div></div>` : ''}${others}`;
}
/**
 * Real motion moves the light: in the first visit it sits at the old spot, in the last visit at
 * the new one. A position that merely "jumps" between two neighbouring stars shows no such
 * change, because both stars are there all along. The test compares the balance of light between
 * the two spots in the two visits, so it does not matter if one visit's image is brighter overall.
 * a and b are the first and last measured positions {x, y}, in the stacks stA and stB.
 */
function lightMoved(stA, stB, a, b) {
  const n = S.grid.n;
  const at = (st, p) => {                                   // brightness at an exact position (bilinear)
    const i = Math.floor(p.x), j = Math.floor(p.y), fx = p.x - i, fy = p.y - j;
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return NaN;
    const v = st.img[j * n + i] * (1 - fx) * (1 - fy) + st.img[j * n + i + 1] * fx * (1 - fy) + st.img[(j + 1) * n + i] * (1 - fx) * fy + st.img[(j + 1) * n + i + 1] * fx * fy;
    return Math.max(v, 0.5 * st.sig);
  };
  const before = at(stA, a) / at(stA, b), after = at(stB, a) / at(stB, b);
  return before / after > 1.3;
}
const COMPASS = [G`north`, G`north-east`, G`east`, G`south-east`, G`south`, G`south-west`, G`west`, G`north-west`];
const compass = (dE, dN) => COMPASS[Math.round((((Math.atan2(dE, dN) * 180 / Math.PI) + 360) % 360) / 45) % 8];

/**
 * Did the circled spot move? Its position is measured in the stacked image of every visit and
 * compared with how well ordinary stars in the same images repeat. For a catalogued fast mover
 * the measurement is also set against the catalogue prediction.
 */
/** One stacked image per visit for any detector (the viewer keeps these only for the selected one). */
function visitStacks(det) {
  const frames = usable(det), key = `${S.gen}:${frames.length}:${[...S.off].join()}`;
  S.stackCache ||= {};
  if (S.stackCache[det]?.key === key) return S.stackCache[det].stacks;
  const npx = S.grid.n * S.grid.n, byEp = new Map();
  for (const f of frames) { const k = gEpoch(f.mjd); if (!byEp.has(k)) byEp.set(k, []); byEp.get(k).push(f); }
  const stacks = [...byEp.keys()].sort((x, y) => x - y).map(k => {
    const fr = byEp.get(k), img = C.medianStack(fr, npx);
    return { img, sig: C.robustStats(img).sig, mjd: (fr[0].mjd + fr[fr.length - 1].mjd) / 2, n: fr.length };
  });
  S.stackCache[det] = { key, stacks };
  return stacks;
}
/** The spot's position in every visit of one detector: predicted place first (catalogued target), or followed from visit to visit. */
function positionsIn(stacks, tracked) {
  const g = S.grid, n = g.n, rows = []; let last = tracked ? null : [S.sel.x, S.sel.y];
  for (const st of stacks) {
    const p = tracked ? trackPos(st.mjd) : last;
    let m = C.locate(st.img, n, p[0], p[1], 3);
    if (m && !(m.peak > 4 * st.sig)) m = null;                                       // not clearly above the noise
    if (m && C.coreMasked(st.img, n, g.scale, m.x, m.y, 6) > 0) m = null;              // a hole in the middle: saturated, no position
    // A catalogued target counts as found only if something sits at its place. At wavelengths where a
    // cold object is invisible, the nearest source is a neighbouring star, which must not be measured instead.
    if (m && tracked && Math.hypot(m.x - p[0], m.y - p[1]) > 1.3) m = null;
    if (m && !tracked) last = [m.x, m.y];
    rows.push({ st, p, m });
  }
  return rows;
}
/**
 * The same motion measured independently in every detector that sees the spot without saturating.
 * Returns the median yearly motion [east, north], how well the detectors agree, and which ones took part.
 */
function motionEverywhere(tracked) {
  const g = S.grid, plx = tracked ? (S.target?.dist?.plx ?? S.track.plx ?? 0) : 0, rates = [];
  for (let det = 1; det <= 6; det++) {
    if (!S.dets[det]?.done || S.dets[det].frames.length < 6) continue;
    const seen = positionsIn(visitStacks(det), tracked).filter(r => r.m && r.m.peak > 8 * r.st.sig);
    if (seen.length < 2) continue;
    const a = seen[0], b = seen[seen.length - 1], years = (b.st.mjd - a.st.mjd) / 365.25;
    if (years < 0.3) continue;
    let dE = -(b.m.x - a.m.x) * g.scale, dN = (b.m.y - a.m.y) * g.scale;
    if (plx > 20) {                             // take out the yearly wobble, which is not motion through space
      const [ra, dec] = C.gridToSky(g, a.m.x, a.m.y), pa = C.parallaxOffset(ra, dec, plx, a.st.mjd), pb = C.parallaxOffset(ra, dec, plx, b.st.mjd);
      dE -= pb[0] - pa[0]; dN -= pb[1] - pa[1];
    }
    rates.push({ det, e: dE / years, n: dN / years });
  }
  if (!rates.length) return null;
  const med = v => { const q = [...v].sort((x, y) => x - y); return q.length % 2 ? q[q.length >> 1] : (q[q.length / 2 - 1] + q[q.length / 2]) / 2; };
  const e = med(rates.map(r => r.e)), n = med(rates.map(r => r.n)), rate = Math.hypot(e, n);
  const spread = Math.max(...rates.map(r => Math.hypot(r.e - e, r.n - n)));
  if (rates.length > 1 && spread > Math.max(1.5, 0.5 * rate)) return null;      // the detectors tell different stories: do not average them
  return { e, n, rate, spread, dets: rates.map(r => r.det) };
}

/**
 * Did the circled spot move? Its position is measured in the stacked image of every visit and
 * compared with how well ordinary stars in the same images repeat. For a catalogued fast mover
 * the measurement is also set against the catalogue prediction (proper motion and parallax).
 */
function renderMotion() {
  const el = $('motion');
  if (!el) return;
  const sum = (cls, html) => { S.find.motion = cls ? { cls, html } : null; renderFindings(); };
  if (S.grid && bodyStops()) return bodyMotion(el, sum);
  if (!S.grid || !S.sel || !S.stacks || S.stacks.length < 2) { el.innerHTML = ''; sum(null); return; }
  const g = S.grid, n = g.n, as = v => (v * g.scale).toFixed(1);
  const tracked = !!(S.sel.follow && S.track && S.track.pmra != null);
  const catPm = tracked ? Math.hypot(S.track.pmra, S.track.pmdec) / 1000 : 0;          // arcseconds per year, from the catalogue
  const rows = positionsIn(S.stacks, tracked);
  const seen = rows.filter(r => r.m);
  const allIn = !!S.head && [1, 2, 3, 4, 5, 6].every(d => !+S.head.avail[d] || S.dets[d]?.done);
  const every = allIn ? motionEverywhere(tracked) : null;                              // all detectors, once they have arrived
  const list = d => d.map(x => 'D' + x).join(', ').replace(/, (D\d)$/, ` ${G`and`} $1`);
  if (seen.length < 2) {
    const holes = rows.filter(r => C.coreMasked(r.st.img, n, g.scale, r.p[0], r.p[1], 6) > 0).length > rows.length / 2;
    const elsewhere = every ? G` In ${list(every.dets)} it can be measured: ${every.rate.toFixed(1)}″ per year towards the ${compass(every.e, every.n)}${tracked && catPm >= 0.1 ? G` (catalogue: ${catPm.toFixed(1)}″ towards the ${compass(S.track.pmra, S.track.pmdec)})` : ''}.` : '';
    el.innerHTML = holes ? G`<p class="hint">The star's core is saturated in D${S.det}, so its position cannot be measured here.${elsewhere}</p>`
      : tracked && catPm >= 0.1 ? G`<p class="hint">The target is too faint in this detector to be located, so its motion cannot be measured here.${elsewhere || G` Try another detector.`}</p>` : '';
    if (every) sum('found', G`<b>Moving ${every.rate.toFixed(1)}″ a year</b> towards the ${compass(every.e, every.n)}, measured in ${list(every.dets)}.${tracked && catPm >= 0.1 ? G` The catalogue says ${catPm.toFixed(1)}″.` : ''}`);
    else sum(null);
    return;
  }
  // How well do positions repeat from visit to visit? Ordinary stars in the same images are the yardstick.
  const comp = [];
  for (const c of findComparisons()) {
    const v = S.stacks.map(st => C.centroid(st.img, n, c.x, c.y, 3));
    if (v.some(x => !x)) continue;
    for (let i = 1; i < v.length; i++) comp.push(Math.hypot(v[i].x - v[0].x, v[i].y - v[0].y) * g.scale);
  }
  comp.sort((x, y) => x - y);
  const align = comp.length >= 3 ? Math.max(0.3, 1.5 * comp[comp.length >> 1]) : 0.8;      // typical repeatability; one odd star does not skew it
  const first = seen[0], end = seen[seen.length - 1];
  const dE = -(end.m.x - first.m.x) * g.scale, dN = (end.m.y - first.m.y) * g.scale, d = Math.hypot(dE, dN);
  const years = Math.max((end.st.mjd - first.st.mjd) / 365.25, 0.05);
  const fuzz = r => 8 / Math.max(4, r.m.peak / r.st.sig);                              // faint spots are located less precisely
  const sigma = Math.hypot(align, fuzz(first), fuzz(end));
  const span = G`${C.fmtMonth(first.st.mjd)} and ${C.fmtMonth(end.st.mjd)}`;
  const yard = comp.length >= 3 ? G`Ordinary stars in the same images stay put to within ${align.toFixed(1)}″.` : '';
  const agree = every && every.dets.length > 1 ? G`, in ${list(every.dets)} independently (they agree to ${Math.max(0.1, every.spread).toFixed(1)}″ per year)` : every ? G`, in ${list(every.dets)}` : G`, in these D${S.det} images`;

  if (tracked && catPm >= 0.1) {
    // Measured minus predicted for every visit. One common offset is taken out (the catalogue position
    // itself may be slightly off); what remains shows how well each visit fits the prediction.
    const res = seen.map(r => [-(r.m.x - r.p[0]) * g.scale, (r.m.y - r.p[1]) * g.scale]);
    const mid = v => { const q = [...v].sort((x, y) => x - y); return q.length % 2 ? q[q.length >> 1] : (q[q.length / 2 - 1] + q[q.length / 2]) / 2; };
    const off = [mid(res.map(v => v[0])), mid(res.map(v => v[1]))];
    const m0 = first.m, p0 = first.p;
    const body = rows.map(({ st, p, m }) => {
      const dot = `<i style="background:${epochColor(st.mjd)}"></i>${C.fmtMonth(st.mjd)}`;
      if (!m) return G`<tr><td>${dot}</td><td colspan="3">not detected</td></tr>`;
      const r = [-(m.x - p[0]) * g.scale - off[0], (m.y - p[1]) * g.scale - off[1]];
      return `<tr><td>${dot}</td><td>${as(Math.hypot(m.x - m0.x, m.y - m0.y))}″</td><td>${as(Math.hypot(p[0] - p0[0], p[1] - p0[1]))}″</td><td>${Math.hypot(r[0], r[1]).toFixed(1)}″</td></tr>`;
    }).join('');
    const rate = every ? every.rate : d / years, dir = every ? compass(every.e, every.n) : compass(dE, dN);
    el.innerHTML = G`<table class="t"><thead><tr><th>${S.head?.split ? G`Month` : G`Visit`}</th><th title="How far it has moved since the first visit, in these images">Moved</th><th title="How far the catalogue says it should have moved: proper motion and parallax">Predicted</th><th title="Distance between the measured and the predicted position, after taking out one offset common to all visits">Off by</th></tr></thead><tbody>${body}</tbody></table>
      <p class="hint verdict"><b>Measured: ${rate.toFixed(1)}″ per year towards the ${dir}</b>${agree}. The catalogue says ${catPm.toFixed(1)}″ per year towards the ${compass(S.track.pmra, S.track.pmdec)}. ${yard} One SPHEREx pixel is 6.15″.</p>`;
    const catDir = compass(S.track.pmra, S.track.pmdec);
    sum('found', G`<b>Moving ${rate.toFixed(1)}″ a year</b> towards the ${dir}. The catalogue says ${catPm.toFixed(1)}″${catDir === dir ? '' : G` towards the ${catDir}`}.`);
    return;
  }
  if (d > Math.max(3 * sigma, 1.5) && !lightMoved(first.st, end.st, first.m, end.m)) {
    el.innerHTML = G`<p class="hint verdict"><b>Probably two stars, not motion.</b> The measured position differs by ${d.toFixed(1)}″ between ${span} in D${S.det}, but the light did not leave the old spot or build up at the new one. That is what a close pair of stars looks like. ${yard}</p>`;
    sum('none', G`<b>Not motion:</b> the position shifts, but in the way a close pair of stars does.`);
    return;
  }
  if (d > Math.max(3 * sigma, 1.5)) {
    const cat = S.info?.pmra != null && !tracked ? G` SIMBAD lists ${(Math.hypot(S.info.pmra, S.info.pmdec) / 1000).toFixed(2)}″ per year for the object catalogued here.` : G` Check the tools above: if no catalogue lists a fast mover here, it deserves a closer look.`;
    const rate = every ? every.rate : d / years, dir = every ? compass(every.e, every.n) : compass(dE, dN);
    el.innerHTML = G`<p class="hint verdict"><b>This spot moved.</b> ${d.toFixed(1)}″ towards the ${compass(dE, dN)} between ${span} in D${S.det}. That is about ${rate.toFixed(1)}″ per year towards the ${dir}${agree}. ${yard}${cat}</p>`;
    sum('found', G`<b>This spot moved</b> ${d.toFixed(1)}″ towards the ${compass(dE, dN)} between ${span}: about ${rate.toFixed(1)}″ a year.`);
    return;
  }
  el.innerHTML = G`<p class="hint verdict"><b>No motion detected.</b> Between ${span} its position in D${S.det} is the same to within ${Math.max(d, 0.1).toFixed(1)}″. ${yard} Anything slower than about ${(Math.max(3 * sigma, 1.5) / years).toFixed(1)}″ per year would not show here (one SPHEREx pixel is 6.15″).</p>`;
  sum('none', G`<b>No motion:</b> the same place to within ${Math.max(d, 0.1).toFixed(1)}″ between ${span}.`);
}
function renderModes() {
  const body = !!(S.grid && bodyStops()), own = followed();
  $('saveades').hidden = !body || own;          // the places of a body can be saved while one is followed through a field; the place of a body the images are centred on was not measured
  for (const b of $('modes').children) {
    const m = b.dataset.mode;
    b.setAttribute('aria-pressed', m === S.mode);
    b.hidden = m === 'trail' ? !body : m === 'years' ? !yearsOk() : own && ['color', 'diff', 'deep'].includes(m);          // views that set one patch of sky against itself: not for a followed body
  }
  $('explain').textContent = (own && FOLLOWED[S.mode]) || (S.mode === 'years' && S.years?.src === 'maps' ? YEARS_MAPS : MODES[S.mode]);
  const inv = $('lookbox').querySelector('.yearsgo'); if (inv) inv.hidden = S.mode === 'years';
  const small = $('overtime');
  if (small) small.textContent = S.mode === 'years' ? G`2MASS, WISE and SPHEREx images of this spot` : G`every SPHEREx exposure of this spot`;
}

// ------------------------------------------------------------ bodies of the solar system passing through
const nap0 = () => new Promise(r => setTimeout(r, 0));
const arc = v => (v >= 90 ? `${(v / 60).toFixed(1)}′` : `${v.toFixed(v < 10 ? 1 : 0)}″`);                        // a length on the sky
const pace = r => (r >= 2 ? G`${r.toFixed(1)}″ an hour` : G`${(r * 24).toFixed(r * 24 < 10 ? 1 : 0)}″ a day`);      // a speed on the sky, given in arcseconds an hour
const clock = mjd => C.fmtDate(mjd, true).slice(11, 16);
const span = (a, b) => (C.fmtDate(a) === C.fmtDate(b) ? `${C.fmtRange(a, a)}, ${clock(a)}–${clock(b)} UTC` : C.fmtRange(a, b));          // when: "6 Oct 2025, 02:04–15:09 UTC", "25 Sep – 12 Oct 2025"
const lasting = hours => (hours >= 48 ? Lang.N(Math.round(hours / 24), 'day') : Lang.N(Math.max(1, Math.round(hours)), 'hour'));
/**
 * Look through every exposure of the field for dots that are at one place for minutes and gone on other days
 * (movers.js), once all detectors have arrived; then ask what each one is.
 */
async function findBodies(gen) {
  if (!S.grid || !S.head) return;
  const dets = {}; let k = 0;
  for (let d = 1; d <= 6; d++) { dets[d] = usable(d); k += dets[d].length; }
  if (k < 12) { S.movers = S.hunt ? { state: 'failed' } : null; renderMovers(); return; }          // too few exposures to tell a visitor from the sky
  S.movers = { state: 'working' }; renderMovers();
  try {
    const signal = S.abort.signal;
    const r = await Movers.findMovers(dets, S.grid, { pause: nap0, flags: navigator.onLine === false ? undefined : f => Archive.readFlags(f, S.grid, signal) });
    if (gen !== S.gen) return;
    S.movers = { state: 'done', ...r };
  } catch (e) {
    if (gen !== S.gen) return;
    console.error(e); S.movers = { state: 'failed' };
  }
  // the body this page is about, when it is one: the track that lies on its path is its own
  if (S.track?.eph) {
    const own = [];
    for (const t of S.movers.tracks || []) {
      const p = trackPos(t.sightings[0].mjd);
      if (Math.hypot(p[0] - t.sightings[0].x, p[1] - t.sightings[0].y) * S.grid.scale < 15) { t.body = { own: true, name: S.target ? nameOf(S.target) : S.track.name }; own.push(t); }
    }
    // A fast body (a near-Earth asteroid) is not joined from stop to stop by the search, which allows 80″ an hour: its known path joins it.
    if (own.length > 1) {
      own[0].sightings = own.flatMap(t => t.sightings).sort((a, b) => a.mjd - b.mjd);
      Movers.describe(own[0], S.grid.scale);
      S.movers.tracks = S.movers.tracks.filter(t => t === own[0] || !own.includes(t));
    }
  }
  // on a hunt: the track that lies where the catalogue's asteroid was is the one the field was picked for
  if (S.hunt) for (const t of S.movers.tracks || []) {
    const q = t.sightings[0], p = S.hunt.at(q.mjd), xy = p && C.skyToGrid(S.grid, p.ra, p.dec);
    if (xy && Math.hypot(xy[0] - q.x, xy[1] - q.y) * S.grid.scale < 30) { t.expected = true; break; }
  }
  renderMovers(); renderMotion(); paint();
  const tracks = S.movers.tracks || [];
  if (S.wantBody && tracks[S.wantBody - 1]) followBody(tracks[S.wantBody - 1]);
  else if (S.hunt && !S.sel && tracks.length) followBody(tracks.find(t => t.expected) || tracks[0]);          // the hunt's find is shown at once
  S.wantBody = 0;
  nameBodies(gen);
}
/** What each track is: SkyBoT knows where every catalogued body of the solar system was at a moment. One question per track, unhurried. */
async function nameBodies(gen) {
  for (const t of [...(S.movers?.tracks || [])]) {
    if (t.body || gen !== S.gen) continue;
    if (navigator.onLine === false) { t.body = { unknown: true }; continue; }
    const q = t.sightings[0], [ra, dec] = C.gridToSky(S.grid, q.x, q.y);
    try {
      const rows = await Info.skybot(ra, dec, q.mjd, 60, S.abort.signal);
      // SPHEREx reaches about magnitude 19; a body listed much fainter than that is not what was seen
      const hit = rows.find(o => o.d <= 25 && !(o.v > 20.5) && !(Info.isMajor(o) && !(o.v <= 20.5)));          // a moonlet whose brightness nobody lists is not what was seen
      t.body = hit ? { ...hit, name: Info.bodyName(hit), kind: Info.bodyKind(hit) } : { none: true };
      // The search joins what moves in a straight line. A moon circling its planet, or a body seen again on a later
      // visit, comes out in pieces: pieces with one name are one body.
      const first = hit && S.movers.tracks.find(x => x !== t && !x.body?.own && x.body?.name === t.body.name);
      if (first && gen === S.gen) {
        const stops = new Set(first.sightings.map(q => q.stop));
        first.sightings = [...first.sightings, ...t.sightings.filter(q => !stops.has(q.stop))].sort((a, b) => a.mjd - b.mjd);
        Movers.describe(first, S.grid.scale);
        first.expected ||= t.expected;
        S.movers.tracks = S.movers.tracks.filter(x => x !== t);
        const followed = S.sel?.trail === t || S.sel?.trail === first;          // the body being followed has grown: its stops are worked out afresh
        if (S.sel?.trail === t) S.sel = { trail: first };
        if (followed) { S.bodyMemo = null; rebuild(); refreshPlots(); }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      t.body = { unknown: true };
    }
    if (gen !== S.gen) return;
    // the hunt's own asteroid lies on its orbit: when SkyBoT cannot be asked, or does not list it there, the orbit names it
    if (t.expected && !t.body.name) t.body = { name: S.hunt.name, num: S.hunt.num, kind: G`Asteroid`, v: S.hunt.v, byOrbit: true };
    renderMovers(); renderMotion(); paint();
    await nap(1500);
  }
}
const bodyLabel = t => (t.body?.name ? t.body.name : t.sightings.length > 1 ? G`Unnamed moving dot` : G`Unnamed dot`);
function renderMovers() {
  const el = $('movers'), m = S.movers;
  if (!el) return;
  renderHunt();
  if (!m || m.state === 'failed') { el.innerHTML = ''; renderBodyBox(); return; }
  if (m.state === 'working') { el.innerHTML = G`<p class="hint">Looking for bodies of the solar system passing through…</p>`; return; }
  const tracks = m.tracks, sub = m.unchecked ? G` Possible sightings left out because the pipeline's flags could not be read: ${m.unchecked}.` : '';
  if (!tracks.length) {
    el.innerHTML = G`<p class="hint verdict"><b>Nothing passed through.</b> In ${nExp(m.frames)} no dot is at one place for a few minutes and gone from there on other days.${sub}</p>`;
    // a field read live had "still looking" in the lead of the panel: the answer takes its place
    S.find.movers = S.target || S.hunt ? null : { cls: 'none', html: G`<b>Nothing passed through</b> this field while SPHEREx was looking.` };
    renderFindings(); renderBodyBox(); return;
  }
  const row = (t, i) => {
    const b = t.body, v = t.sightings, one = v.length === 1, on = S.sel?.trail === t || (b?.own && S.sel?.follow);
    const what = (b?.own ? G`found by this search too` : b?.name ? `${b.kind}${b.v === b.v ? G`, magnitude ${b.v.toFixed(1)}` : ''}`
      : b?.none ? G`no catalogued body is there` : b?.unknown ? G`not looked up: no connection` : G`looking it up…`) + (t.expected ? G` · the one this field was picked for` : '');
    const seen = one ? G`${Lang.N(v[0].hits.length, 'image')} within ${Lang.N(Math.max(1, Math.round((v[0].t1 - v[0].t0) * 1440)), 'minute')}, ${C.fmtDate(v[0].mjd, true)}`
      : G`${Lang.N(v.length, 'stop')}, ${span(t.t0, t.t1)} · ${arc(t.path)} at ${pace(t.rate)}`;
    return `<li><button type="button" data-body="${i}" aria-pressed="${!!on}">${esc(bodyLabel(t))}</button><span>${what} · ${seen}</span></li>`;
  };
  el.innerHTML = G`<p class="hint verdict"><b>Passed through this field: ${Lang.N(tracks.length, 'body of the solar system')}.</b> Each was a dot at one place for a few minutes, in several exposures, and gone from there on other days.${sub}</p>`
    + `<ul class="flags bodies">${tracks.map(row).join('')}</ul>`
    + G`<p class="hint">Press one to follow it from stop to stop. Names come from <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT</a> (Paris Observatory), which knows where every catalogued body was at that moment.</p>`;
  el.querySelectorAll('[data-body]').forEach(b => { b.onclick = () => followBody(tracks[+b.dataset.body]); });
  const others = tracks.filter(t => !t.body?.own), names = others.map(bodyLabel), strange = others.filter(t => t.body?.none).length;
  S.find.movers = others.length ? { cls: strange ? 'unsure' : 'found', html: G`<b>Passed through this field:</b> ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? '…' : ''}.` } : null;
  renderFindings(); renderBodyBox();
}
/** Follow a body found in these images: the ring goes with it, the images show it stop by stop, the plots measure it. */
function followBody(t) {
  stop(); S.wantPlay = false;
  if (t.body?.own && S.track?.eph) S.sel = { follow: true }; else S.sel = { trail: t };
  S.mode = 'trail'; S.seq = []; S.idx = 0; S.view = { ...S.view, z: 1 }; resetView();
  renderModes(); rebuild(); renderMovers(); refreshPlots(); syncUrl();
  if (S.seq.length > 1 && !calmMotion()) play();
  $('sky').scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
}
function unfollow() {
  stop(); S.sel = null; S.mode = 'epochs'; S.seq = []; S.idx = 0;
  renderModes(); rebuild(); renderMovers(); refreshPlots(); syncUrl(); showReportAsk(false);
}
/** Above the measurements: which passing body they are about, while one is followed in the field of another object. */
function renderBodyBox() {
  const el = $('bodybox'), t = S.sel?.trail;
  if (!el) return;
  if (!t) { el.hidden = true; el.innerHTML = ''; leadState(); return; }
  const b = t.body || {};
  const facts = b.name ? [b.kind, b.v === b.v ? G`magnitude ${b.v.toFixed(1)}` : '', b.dh ? G`${b.dh.toFixed(2)} au from the Sun, ${b.dg.toFixed(2)} au from Earth` : ''].filter(Boolean).join(' · ')
    : b.none ? G`SkyBoT lists no body of the solar system within 25″ of this place at that moment. Most often such a dot is a fault in an image that the checks missed; now and then it is a body nobody has catalogued. Three steps tell which:`
    : b.unknown ? G`Not looked up: SkyBoT could not be reached.` : G`Asking SkyBoT what it is…`;
  const link = b.name && !Info.isMajor(b) ? ` ${Info.bodyLinks(b.num || b.name).map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.title)}">${l.label}</a>`).join(' · ')}` : '';
  // What now? A catalogued body is nothing to report: what is new are its measurements. A dot without a name is checked first.
  const q = t.sightings[0], [ra, dec] = C.gridToSky(S.grid, q.x, q.y), guide = `<a href="${esc(pageAddress('hunt'))}" data-act="guide">`;
  const now = b.name ? G`<p class="now"><b>What now?</b> It is in the catalogue, so there is no discovery to report. What is new is what SPHEREx measured of it: its brightness in every colour from 0.75 to 5 microns, and its place among the stars at each of these moments.</p><p class="acts"><button type="button" data-act="csv">Measurements (CSV)</button><button type="button" data-act="ades">Positions (ADES)</button>${guide}What they are good for</a></p>`
    : b.none ? G`<ol class="steps"><li><b>Look at it.</b> Under “Exposures” a real body looks like the stars around it and is in every image of a stop; a fault is a sharp speck in one image.</li><li><b>Ask the Minor Planet Center.</b> Its own check lists every body known near this place at that moment, also the ones found last week: <a href="${esc(Bodies.mpcheckerUrl(ra, dec, q.mjd))}" target="_blank" rel="noopener">MPChecker</a>.</li><li><b>Still unknown?</b> Then its places can be reported: <button type="button" data-act="ades">Report file (ADES)</button> ${guide}How reporting works</a></li></ol>` : '';
  const back = `<button type="button" class="ghost" id="unfollow">${S.hunt ? G`Back to the whole field` : G`Back to ${esc(S.target ? nameOf(S.target) : S.info?.name || G`the spot`)}`}</button>`;
  el.innerHTML = `<p class="kind">${G`Passing through this field`}</p><h2>${esc(bodyLabel(t))}</h2><p>${facts}${link}</p>${now}${back}`;
  el.hidden = false;
  if ($('unfollow')) $('unfollow').onclick = unfollow;
  el.querySelectorAll('[data-act]').forEach(x => { x.onclick = e => {
    if (x.dataset.act === 'csv') $('savecsv').click();
    else if (x.dataset.act === 'ades') askReport();
    else if (!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { e.preventDefault(); openSheet('hunt'); }
  }; });
  leadState();
}

// ------------------------------------------------------------ an asteroid hunt
/** How far the reading of the field's exposures has come: [read, expected]. */
function readSoFar() {
  let done = 0, all = 0;
  for (let d = 1; d <= 6; d++) {
    const D = S.dets[d], avail = Math.min(S.expect ? S.expect[d] || 0 : S.head ? +S.head.avail[d] || 0 : 0, Archive.MAX_PER_DET);
    const want = D?.total && avail ? Math.min(D.total, avail) : D?.total || avail;          // what the index promises, less what turns out not to cover the field
    done += D ? D.frames.length : 0; all += D ? (D.done ? D.frames.length : Math.max(want, D.frames.length)) : avail;
  }
  return [done, all];
}
/**
 * An asteroid hunt: one of the first three thousand numbered asteroids is picked at random, and a patch of sky it
 * crossed while SPHEREx was looking is opened. The search for passing bodies is told neither which one nor where.
 */
async function startHunt(only = 0) {
  if (tourIdx >= 0) tourEnd();
  if (!$('sheetwrap').hidden) closeSheet();
  closeMenu();
  // on a phone's data plan, or where the visitor has asked the browser to save data, a hunt is not started unasked
  const net = navigator.connection;
  if (net && (net.saveData || net.type === 'cellular') && !window.confirm(G`A hunt reads about three hundred exposures from NASA's archive: a few hundred megabytes. Start it on this connection?`)) return;
  const tok = ++S.openTok;
  $('welcome').hidden = true;
  note(G`Asteroid hunt: picking a patch of sky that an asteroid crossed while SPHEREx was looking…`);
  let pick = null, reached = true;
  try { pick = await Bodies.pickHunt(SURVEY0, surveyDays(), undefined, { tries: 10, only: only > 0 ? Math.floor(only) : 0 }); } catch (e) { console.error(e); reached = false; }
  if (tok !== S.openTok) return;
  if (!pick) { note(reached ? G`No field came up this time. Press “Find an asteroid” once more.` : orbitsDown(), 9000); return; }
  note(''); $('q').value = '';
  const { body, visit, rows } = pick;
  go({ ra: visit.ra, dec: visit.dec, size: 10, info: { name: G`Asteroid hunt`, type: 'A patch of sky near the ecliptic', hunt: true },
    hunt: { num: body.num, name: `(${body.num}) ${body.name}`, v: visit.v, from: visit.from, to: visit.to, at: Bodies.pathAt(rows) } });
}
/** The story of a hunt, at the top of the panel: what is being done, and then what was found. */
function renderHunt() {
  const el = $('huntbox'), h = S.hunt;
  if (!el) return;
  let html = '';
  if (h && !S.failed) {
    const m = S.movers, when = span(h.from, h.to), mag = h.v.toFixed(1), tracks = m?.tracks || [];
    const again = `<button type="button" class="ghost" data-hunt="again">${G`Hunt in another field`}</button>`;
    const guide = `<a href="${esc(pageAddress('hunt'))}" data-hunt="guide">${G`What can be done with a find?`}</a>`;
    const names = v => v.map(t => `<button type="button" class="linkish" data-hunt-body="${tracks.indexOf(t)}">${esc(bodyLabel(t))}</button>`).join(', ');
    if (!m) {
      const [done, all] = readSoFar(), pc = all ? Math.round(100 * done / all) : 0;
      html = `<p class="kind">${G`Asteroid hunt`}</p><h2>${G`Reading SPHEREx's exposures of this patch of sky`}</h2>
        <p>${G`The catalogue of orbits says that an asteroid of magnitude ${mag} crossed it (${when}) while SPHEREx was looking. The search is told neither which asteroid nor where it was: every exposure is read, then searched for a dot that is not always there.`}</p>
        <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}"><i style="width:${pc}%"></i></div>
        <p class="hint">${all ? G`Exposures read: ${done} of about ${all}.` : G`Finding the exposures that cover this spot…`} ${G`Each is a strip cut out of a file of 60 megabytes in NASA's archive. A hunt moves a few hundred megabytes and takes two to four minutes.`}</p>`;
    } else if (m.state === 'working') {
      html = `<p class="kind">${G`Asteroid hunt`}</p><h2>${G`Searching the exposures for dots that are not always there`}</h2>
        <p>${G`A body of the solar system is at one place for a few minutes, in several exposures at once, and gone from there on other days. A star is there every time; a cosmic-ray hit is in one exposure only.`}</p><div class="meter busy"><i style="width:100%"></i></div>`;
    } else if (m.state === 'failed') {
      html = `<p class="kind">${G`Asteroid hunt`}</p><h2>${G`The search could not be finished`}</h2><p class="acts">${again}</p>`;
    } else {
      const exp = tracks.find(t => t.expected), rest = tracks.filter(t => t !== exp), on = S.sel?.trail;
      let head, text;
      if (exp) {
        head = exp.body?.name ? G`Found: ${esc(exp.body.name)}` : G`Found: a moving dot where the asteroid should be`;
        text = (exp.body?.name ? G`It is the asteroid the catalogue promised (magnitude ${mag}). The search was told neither its name nor its place. Stops of the telescope at which it found it: ${exp.sightings.length}.` : G`Asking SkyBoT what it is…`)
          + (rest.length ? G` Also passing through: ${names(rest)}.` : '');
      } else if (rest.length) {
        head = G`Found, but not the asteroid expected`;
        text = G`${esc(h.name)} (magnitude ${mag}) should have crossed this field, and the search did not find it: it may have passed in front of stars. What it did find: ${names(rest)}.`;
      } else {
        head = G`Nothing found this time`;
        text = G`${esc(h.name)} (magnitude ${mag}) should have crossed this field (${when}), and the search did not find it. A body that passes in front of a star at every stop is missed, and so is one that was fainter than the catalogue says.`;
      }
      html = `<p class="kind">${G`Asteroid hunt`}</p><h2>${head}</h2><p>${text}</p>
        <p class="acts">${!on && tracks.length ? `<button type="button" class="cta" data-hunt="follow">${G`Follow it`}</button>` : ''}${again}${guide}</p>`;
    }
  }
  if (el.dataset.was !== html) { el.dataset.was = html; el.innerHTML = html; el.hidden = !html; leadState(); }
}
$('huntbox').addEventListener('click', e => {
  const b = e.target.closest('[data-hunt], [data-hunt-body]'), tracks = S.movers?.tracks || [];
  if (!b) return;
  if (b.dataset.huntBody) followBody(tracks[+b.dataset.huntBody]);
  else if (b.dataset.hunt === 'again') startHunt();          // (a click hands the handler its event: startHunt is called without it)
  else if (b.dataset.hunt === 'follow') followBody(tracks.find(t => t.expected) || tracks[0]);
  else if (!(e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)) { e.preventDefault(); openSheet('hunt'); }
});
/** How far and how fast the followed body moved, from stop to stop; for a body whose path is known, how well the path fits. */
/**
 * A followed body: its images are centred on it, so there is no motion to measure in them. What is told instead
 * comes from its path (stored with the object, from JPL Horizons), with one check made here: where its light really
 * lies in the exposures of the detector on show, against the centre they were cut out around.
 */
function followedMotion(el, sum) {
  const b = S.target.body, n = S.grid.n, c = (n - 1) / 2;
  const rows = b.visits.map(v => `<tr><td>${C.fmtRange(v.t0, v.t1)}</td><td>${pace(v.rate)}</td><td>${v.sun.map(x => x.toFixed(2)).join('–')}</td><td>${v.earth.map(x => x.toFixed(2)).join('–')}</td></tr>`).join('');
  // the check: the exposures in which it is bright and nothing else is in the circle
  const off = [];
  for (const f of usable(S.det)) {
    if (f.fault || f.star) continue;
    const m = C.centroid(f.data, n, c, c, 2);
    if (m && m.peak > 12 * f.sig) off.push(Math.hypot(m.x - c, m.y - c) * S.grid.scale);
  }
  off.sort((p, q) => p - q);
  const check = off.length >= 8 ? G` In the ${off.length} exposures of D${S.det} in which it is bright, its light lies typically ${off[off.length >> 1].toFixed(1)}″ from that place, at the worst ${off[off.length - 1].toFixed(1)}″. One SPHEREx pixel is 6.15″.` : '';
  el.innerHTML = G`<table class="t wrap"><thead><tr><th>Visit</th><th title="How fast it moved across the sky">Across the sky</th><th title="1 au is the distance from the Earth to the Sun">From the Sun <span class="asis">(au)</span></th><th title="1 au is the distance from the Earth to the Sun">From Earth <span class="asis">(au)</span></th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint verdict"><b>Followed, not searched for.</b> Every exposure is cut out around the place that NASA's JPL Horizons gives for the comet at the middle of that exposure, seen from where the spacecraft was at that moment.${check}</p>`;
  const last = b.visits[b.visits.length - 1];
  sum('found', G`<b>Moving ${pace(last.rate)}</b> across the sky in ${C.fmtMonth((last.t0 + last.t1) / 2)}: every image is centred on it.`);
}
function bodyMotion(el, sum) {
  if (followed()) return followedMotion(el, sum);
  const v = bodyStops(), t = S.sel?.trail, as = S.grid.scale;
  if (v.length < 2) {
    el.innerHTML = v.length ? G`<p class="hint">Caught at one stop of the telescope only: too little to measure a motion.</p>` : (S.dets[S.det]?.done ? G`<p class="hint">Its path does not cross these images.</p>` : '');
    sum(null); return;
  }
  const a = v[0], z = v[v.length - 1], hours = (z.mjd - a.mjd) * 24, dE = -(z.x - a.x) * as, dN = (z.y - a.y) * as;
  let path = 0; for (let i = 1; i < v.length; i++) path += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y) * as;
  const rate = path / Math.max(hours, 1e-6), b = t?.body;
  // a body whose path is known: how well does the search, which is not told where to look, agree with it?
  let check = '';
  const found = !t && (S.movers?.tracks || []).find(x => x.body?.own);
  if (found) {
    const off = found.sightings.map(q => { const p = trackPos(q.mjd); return Math.hypot(p[0] - q.x, p[1] - q.y) * as; }).filter(d => d === d).sort((p, q) => p - q);
    check = G` The search for moving dots, which is not told where to look, found it at ${found.sightings.length} of them, typically ${off[off.length >> 1].toFixed(1)}″ from where its orbit puts it.`;
  } else if (!t && S.track?.eph && S.movers?.state === 'done') {
    // a body asked for by name that the search did not find: said plainly, since the ring then marks only where its orbit puts it
    check = G` The search for moving dots, which is not told where to look, did not find it at these stops: it is too faint for a single exposure there, or stood in front of a star.`;
  } else if (b?.name && b.rate && hours < 48) check = G` SkyBoT's orbit for ${esc(b.name)} gives ${pace(b.rate)} at that moment, ${b.d.toFixed(0)}″ from this track.`;      // over days a body speeds up or slows down: one moment's speed is no yardstick then
  const rows = v.length <= 8 ? G`<table class="t"><thead><tr><th>Stop</th><th title="How far it has moved since the first stop">Moved</th><th>Detectors</th></tr></thead><tbody>${v.map((q, i) =>
    `<tr><td>${C.fmtDate(q.mjd, true)}</td><td>${i ? arc(Math.hypot(q.x - a.x, q.y - a.y) * as) : G`first`}</td><td>${q.dets.map(d => 'D' + d).join(' + ')}</td></tr>`).join('')}</tbody></table>` : '';
  el.innerHTML = G`${rows}<p class="hint verdict"><b>Moved ${arc(Math.hypot(dE, dN))} towards the ${compass(dE, dN)}</b> (${span(a.mjd, z.mjd)}): ${pace(rate)}. Stops of the telescope that caught it: ${v.length}.${check} One SPHEREx pixel is 6.15″.</p>`;
  sum('found', G`<b>Moving ${pace(rate)}</b> towards the ${compass(dE, dN)}: ${arc(path)} in ${lasting(hours)}.`);
}
const DET_COLORS = ['#fff1d0', '#ffd58a', '#ffb057', '#ff7b39', '#e2472a', '#b3261e'];
function renderDets() {
  const el = $('dets'); el.innerHTML = '';
  for (let d = 1; d <= 6; d++) {
    const b = document.createElement('button'), D = S.dets[d], avail = S.head ? +S.head.avail[d] : null, [a, z] = C.DET_BANDS[d];
    b.type = 'button'; b.textContent = `D${d}`;
    b.style.flex = String(z - a); b.style.setProperty('--c', DET_COLORS[d - 1]);
    b.setAttribute('aria-pressed', d === S.det);
    b.disabled = avail === 0;
    if (D?.loading) b.classList.add('loading');
    b.title = G`Detector ${d}: ${a} to ${z} microns${avail ? `, ${nExp(avail)}` : avail === 0 ? G`, no exposures here` : ''}`;
    b.onclick = () => { S.det = d; S.detPicked = true; S.autoNote = ''; renderDets(); rebuild(); refreshPlots(); syncUrl(); if (!S.dets[d]) setStatus(G`Detector ${d} is still loading…`); };
    el.appendChild(b);
  }
  const D = S.dets[S.det], [a, z] = C.DET_BANDS[S.det];
  const n = D ? (D.loading ? G`loading ${D.frames.length} of ${D.total || '…'} exposures` : nExp(D.frames.length)) : S.head ? nExp(S.head.avail[S.det]) : '';
  $('detnote').textContent = G`${S.autoNote ? S.autoNote + ' ' : ''}Detector ${S.det}: ${a} to ${z} µm${n ? ` · ${n}` : ''}. Pick a wavelength band above.`;
}
function renderReleases() {
  const el = $('releases'); el.innerHTML = '';
  for (const [name, n] of Object.entries(S.head.releases).sort()) {
    const lab = document.createElement('label'), cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !S.off.has(name);
    cb.onchange = () => { cb.checked ? S.off.delete(name) : S.off.add(name); rebuild(); refreshPlots(); };
    lab.append(cb, ` ${name} `, Object.assign(document.createElement('span'), { className: 'hint', textContent: nExp(n) }));
    el.appendChild(lab);
  }
}
// ------------------------------------------------------------ the pipeline's pixel flags of one exposure
/**
 * Every SPHEREx exposure carries a FLAGS layer: for each pixel, what the processing noticed about it. The names
 * and their meaning are read from the file itself, so a flag added by a later release shows up unasked; the plain
 * words below are for the ones known today. NOTES are not defects.
 */
const FLAG_SAYS = {
  TRANSIENT: () => G`a sudden jump in the signal during the exposure, as from a cosmic-ray hit or an overloaded pixel`,
  OVERFLOW: () => G`the pixel filled up during the exposure: too bright`,
  SUR_ERROR: () => G`an error in the processing on board`,
  NONFUNC: () => G`a pixel that never works`,
  DICHROIC: () => G`low sensitivity here, caused by the telescope's beam splitter`,
  MISSING_DATA: () => G`data lost on board`,
  HOT: () => G`a hot pixel: it gives signal by itself`,
  COLD: () => G`an abnormally low signal`,
  FULLSAMPLE: () => G`the pixel's full read-out history was kept`,
  PHANMISS: () => G`a correction for phantom signals was not applied`,
  NONLINEAR: () => G`the detector's response could not be corrected reliably here`,
  PERSIST: () => G`charge left over from an earlier exposure`,
  OUTLIER: () => G`marked as an outlier by the processing`,
  CROSSTALK: () => G`electrical crosstalk from another pixel`,
  SOURCE: () => G`a known star or galaxy lies on this pixel`,
  GHOST: () => G`a reflection of a bright source in this exposure`,
  GHOST_FPA: () => G`a reflection of a bright source on another detector`,
  GHOST_EXT: () => G`a reflection of a bright source outside the field`,
  STREAK: () => G`a streak across the image`,
  BLOOM: () => G`part of the bloom around a very bright source`,
  SNOWBALL: () => G`part of a snowball: a large round flash in the detector`,
  HALO: () => G`part of the halo around a sudden flash`,
};
const FLAG_NOTES = new Set(['SOURCE', 'FULLSAMPLE']);
const flagSays = pl => (FLAG_SAYS[pl.name] ? FLAG_SAYS[pl.name]() : esc(pl.text || pl.name));
const flagStore = new Map();          // one entry per exposure of the view in use: { state: 'reading' | 'done' | 'failed', res, unsupported }
const flagKey = f => `${S.gen}:${f.det}:${f.id}`;
let flagCanvas = null, flagCanvasKey = '', flagTimer = 0;
async function loadFlags(f) {
  const key = flagKey(f);
  if (flagStore.get(key)?.state === 'reading') return;
  if (flagStore.size > 60) flagStore.clear();
  flagStore.set(key, { state: 'reading' }); renderMeta();
  try {
    const res = await Archive.readFlags(f, f.c ? { ...S.grid, ra: f.c[0], dec: f.c[1] } : S.grid);          // an exposure cut out around a followed body has a centre of its own
    const count = new Map();
    for (let p = 0; p < res.bits.length; p++) { const v = res.bits[p]; if (v) for (const pl of res.planes) if (v & (1 << pl.bit)) count.set(pl.bit, (count.get(pl.bit) || 0) + 1); }
    flagStore.set(key, { state: 'done', res, count });
  } catch (e) {
    flagStore.set(key, { state: 'failed', unsupported: !!e.unsupported });
  }
  renderMeta(); paint();
}
/** The flags set inside the ring of the measured spot in this exposure. */
function flagsAtSpot(f, res) {
  const pos = selPos(f.mjd);
  if (!pos) return null;
  const n = res.n, r = 9.2 / S.grid.scale, x0 = Math.round(pos[0]), y0 = Math.round(pos[1]), k = Math.ceil(r);
  let v = 0;
  for (let j = Math.max(0, y0 - k); j <= Math.min(n - 1, y0 + k); j++) for (let i = Math.max(0, x0 - k); i <= Math.min(n - 1, x0 + k); i++) {
    if (Math.hypot(i - pos[0], j - pos[1]) <= r) v |= res.bits[j * n + i];
  }
  return res.planes.filter(pl => v & (1 << pl.bit));
}
function flagsHtml(f) {
  const e = flagStore.get(flagKey(f));
  if (!e) return G`<button type="button" class="pxread" data-flags>Read the flags of this exposure</button> <span class="hint">What the processing marked on each pixel: cosmic-ray hits, overloaded pixels, reflections and more.</span>`;
  if (e.state === 'reading') return G`Reading the flags…`;
  if (e.state === 'failed') return e.unsupported ? G`This file stores its flags in a form this page cannot read.` : G`The flags could not be read now. <button type="button" class="pxread" data-flags>Try again</button>`;
  const { res, count } = e, here = flagsAtSpot(f, res);
  const say = list => list.map(pl => `<b class="asis">${esc(pl.name)}</b> (${flagSays(pl)})`).join('; ');
  const faults = here ? here.filter(pl => !FLAG_NOTES.has(pl.name)) : null, notes = here ? here.filter(pl => FLAG_NOTES.has(pl.name)) : [];
  const spot = !here ? '' : `<p>${faults.length ? G`At the circled spot: ${say(faults)}.` : G`At the circled spot: nothing is marked as a fault.`}${notes.length ? ` ${G`Also noted there: ${say(notes)}.`}` : ''}</p>`;
  const present = res.planes.filter(pl => count.get(pl.bit));
  const share = v => { const d = v < 0.01 ? 2 : 0; return G`${(100 * v).toLocaleString(Lang.locale, { minimumFractionDigits: d, maximumFractionDigits: d })}%`; };          // written the way the language writes a percentage
  const chip = pl => `<button type="button" class="pxflag${S.flagBit === pl.bit ? ' on' : ''}${FLAG_NOTES.has(pl.name) ? ' note' : ''}" data-bit="${pl.bit}" aria-pressed="${S.flagBit === pl.bit}" title="${flagSays(pl).replace(/"/g, '&quot;')}"><span class="asis">${esc(pl.name)}</span> <i>${share(count.get(pl.bit) / res.bits.length)}</i></button>`;
  const shown = present.find(pl => pl.bit === S.flagBit);
  const field = present.length
    ? `<p>${G`In this field, with the share of its pixels. Press one to see where:`}</p><p class="pxflags">${present.map(chip).join('')}</p>${shown ? `<p class="pxsay"><b class="asis">${esc(shown.name)}</b>: ${flagSays(shown)}. ${G`Its pixels are drawn in pink on the image.`}</p>` : ''}`
    : `<p>${G`Nothing is marked in this field.`}</p>`;
  return spot + field;
}
/** The pixels of the pressed flag as a picture to lay over the image; null when there is nothing to draw. */
function flagLayer(it, n) {
  if (S.flagBit == null || !it?.frame) return null;
  const e = flagStore.get(flagKey(it.frame));
  if (e?.state !== 'done' || e.res.n !== n) return null;
  const key = `${flagKey(it.frame)}:${S.flagBit}`;
  if (flagCanvasKey !== key) {
    flagCanvas = flagCanvas || document.createElement('canvas'); flagCanvas.width = flagCanvas.height = n;
    const fx = flagCanvas.getContext('2d'), im = fx.createImageData(n, n), px = im.data, m = 1 << S.flagBit, bits = e.res.bits;
    for (let p = 0; p < bits.length; p++) {
      if (!(bits[p] & m)) continue;
      const o = ((n - 1 - ((p / n) | 0)) * n + (p % n)) * 4;
      px[o] = 255; px[o + 1] = 70; px[o + 2] = 170; px[o + 3] = 150;
    }
    fx.putImageData(im, 0, 0); flagCanvasKey = key;
  }
  return flagCanvas;
}

function renderMeta() {
  const it = S.seq[S.idx], el = $('meta');
  if (!it) { el.innerHTML = ''; return; }
  const rows = [];
  const add = (k, v) => rows.push(`<dt>${k}</dt><dd>${v}</dd>`);
  if (it.frame) {
    const f = it.frame;
    add(G`Date`, `${C.fmtDate(f.mjd, true)} (MJD ${f.mjd.toFixed(4)})`);
    add(G`Wavelength`, G`${lamAt(f).toFixed(4)} µm at the circle, bandwidth ${f.bw.toFixed(3)} µm`);
    add(G`Detector`, `D${f.det} (${C.DET_BANDS[f.det].join('–')} µm)`);
    add(G`Release`, f.coll);
    add(G`Exposure`, `${f.id}${f.exp ? `, ${f.exp.toFixed(0)} s` : ''}`);
    add(G`Detector pixel`, `x ${f.px[0]}, y ${f.px[1]}`);
    add(G`Sky level removed`, `${f.bg.toFixed(3)} MJy/sr`);
    add(G`Noise (1σ)`, `${f.sig.toFixed(3)} MJy/sr`);
    add(G`Coverage`, G`${Math.round(f.cov * 100)}% of the field`);
    add(G`PSF width`, `${f.fwhm}″`);
    add(G`Source file`, G`<a href="${f.url}" target="_blank" rel="noopener">FITS at IRSA</a>`);
    add(G`Pixel flags`, `<div class="pxbox">${flagsHtml(f)}</div>`);
  } else if (it.years) {
    const f = it.years;
    add(G`Image`, it.title);
    add(G`Telescope`, f.survey === 'SPHEREx' ? `SPHEREx D${f.det} (${C.DET_BANDS[f.det].join('–')} µm)` : `${f.survey} ${f.band} (${Years.LAM[f.band].toFixed(2)} µm)`);
    add(G`Taken`, f.survey === 'AllWISE' ? G`in WISE’s passes over this place in 2010 and early 2011, added together` : f.guessed ? G`between 1997 and 2001 (the night could not be looked up)` : f.t1 - f.t0 > 1 ? C.fmtRange(f.t0, f.t1) : C.fmtDate(f.mjd));
    if (f.n) add(G`Built from`, f.survey === '2MASS' ? G`${f.n} Atlas Images of 2MASS, joined` : G`${nExp(f.n)}, the middle value of each pixel`);
    if (!f.pic) add(G`Noise (1σ)`, `${f.sig.toFixed(3)} MJy/sr`);
    add(G`Source`, f.pic ? G`sky map (HiPS) at NASA/IPAC, as its makers stretched it: where the light lies is measured, not how bright it is` : f.survey === 'SPHEREx' ? G`SPHEREx level 2 exposures at NASA/IPAC` : f.survey === '2MASS' ? G`2MASS Atlas Images at NASA/IPAC` : G`WISE and NEOWISE single exposures (level 1b) at NASA/IPAC`);
  } else {
    add(G`Image`, it.title);
    add(G`Built from`, it.sub);
    if (it.det !== 0) { const d = it.det || S.det; add(G`Detector`, `D${d} (${C.DET_BANDS[d].join('–')} µm)`); }
    if (it.sig) add(G`Noise (1σ)`, `${it.sig.toFixed(3)} MJy/sr`);
    if (it.ep) add(G`Releases`, [...new Set(it.ep.frames.map(f => f.coll))].join(', '));
    add(G`Pixel flags`, G`Flags belong to single exposures: choose “Exposures” above, then read them here.`);
  }
  if (S.grid) add(G`Pixel scale`, G`${vg().scale.toFixed(2)}″ (resampled, north up, east left)`);
  el.innerHTML = rows.join('');
  if (it.frame) {
    const f = it.frame;
    el.querySelectorAll('[data-flags]').forEach(b => { b.onclick = () => { stop(); S.flagsOn = true; loadFlags(f); }; });          // flags are one exposure's: the sequence waits on it
    // Once flags have been asked for, stepping to another exposure reads its flags too: after a pause, so that
    // stepping quickly through many exposures does not fetch them all, and never while the sequence plays.
    clearTimeout(flagTimer);
    if (S.flagsOn && !S.playing && !flagStore.has(flagKey(f)) && el.closest('details')?.open) {
      flagTimer = setTimeout(() => { if (S.seq[S.idx]?.frame === f && !S.playing && !flagStore.has(flagKey(f))) loadFlags(f); }, 700);
    }
    el.querySelectorAll('[data-bit]').forEach(b => { b.onclick = () => { S.flagBit = S.flagBit === +b.dataset.bit ? null : +b.dataset.bit; renderMeta(); paint(); }; });
  }
}
function setStatus(text, frac) {
  $('status').innerHTML = text ? `${text}${frac ? `<div class="bar"><i style="width:${Math.round(frac * 100)}%"></i></div>` : ''}` : '';
}

// ------------------------------------------------------------ search
async function resolveName(name) {
  const parse = xml => {
    const num = (s, tag) => { const m = s.match(new RegExp(`<${tag}>\\s*([-+0-9.eE]+)`)); return m ? +m[1] : null; };
    const ra = num(xml, 'jradeg'), dec = num(xml, 'jdedeg');
    if (ra === null || dec === null) return null;
    const pm = xml.match(/<pm>([\s\S]*?)<\/pm>/), plx = xml.match(/<plx>([\s\S]*?)<\/plx>/), on = xml.match(/<oname>(.*?)<\/oname>/);
    const r = { name: on ? on[1].replace(/^(NAME|V\*|\*)\s+/, '') : name, ra2000: ra, dec2000: dec,
      pmra: pm ? num(pm[1], 'pmRA') : null, pmdec: pm ? num(pm[1], 'pmDE') : null, plx: plx ? num(plx[1], 'v') : null };
    const year = C.epochNow();
    [r.ra, r.dec] = C.propagate({ ra, dec, pmra: r.pmra, pmdec: r.pmdec }, 2000, year);
    return r;
  };
  // The CDS name resolver and its mirror at Harvard, both asked at once: the first to answer is believed (they are
  // one service in two places), so that a day on which Strasbourg does not answer costs nothing. Then SIMBAD
  // itself, which knows exact identifiers.
  let answered = false;                       // did any service answer at all?
  const ask = async base => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
    try { const r = await fetch(base + encodeURIComponent(name), { signal: ctl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return parse(await r.text()); }
    finally { clearTimeout(timer); }
  };
  try {
    const v = await Promise.any(['https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?', 'https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oxp/SNV?'].map(ask));
    answered = true;
    if (v) return v;
  } catch { /* neither could be reached */ }
  if (API) {
    try { const r = await fetch(`${API}/api/resolve?q=${encodeURIComponent(name)}`); if (r.ok) return await r.json(); } catch { /* fall through */ }
  }
  try { const v = await Info.byName(name); if (v) return v; answered = true; } catch { /* no answer */ }
  if (!answered) throw new Error('unreachable');
  return null;
}
const sepArcsec = (ra1, dec1, ra2, dec2) => Math.hypot((ra1 - ra2) * Math.cos(dec1 * Math.PI / 180), dec1 - dec2) * 3600;

async function search(text) {
  text = text.trim();
  if (!text) return;
  const size = fovPick();
  const co = C.parseCoords(text);
  if (co) {
    go({ ...co, size });
    // Old coordinates of a fast mover we know? Offer to jump to where it is now.
    for (const t of S.targets) {
      const k = t.resolved;
      if (!k || k.pmra == null || Math.hypot(k.pmra, k.pmdec) < 500) continue;
      const here = sepArcsec(co.ra, co.dec, t.ra, t.dec);
      let near = false;
      for (let y = 2000; y <= 2026; y += 0.5) {
        const [r, d] = C.propagate({ ra: k.ra2000, dec: k.dec2000, pmra: k.pmra, pmdec: k.pmdec }, 2000, y);
        if (sepArcsec(co.ra, co.dec, r, d) < 20) near = true;
      }
      if (near && here > 15) {
        const el = $('notice');
        el.innerHTML = G`These look like older coordinates of <b>${t.label}</b>. It has since moved ${(here / 60).toFixed(1)}′ from here.<br><button type="button">Jump to where it is now</button>`;
        el.hidden = false;
        el.querySelector('button').onclick = () => openTarget(t);
      }
    }
    return;
  }
  const plain = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');          // "Plüton" and "Plutón" are Pluto
  const q = plain(text);
  // a body that is followed has one view, whatever size of field is chosen: its names open it, and only its names
  const led = followedNamed(text);
  if (led) return openTarget(led);
  const preset = q.length > 2 && S.targets.find(t => !t.follow && [t.label, t.slug, t.query, nameOf(t)].some(s => { const v = plain(s); return v.includes(q) || q.includes(v); }));
  if (preset && size === preset.size) return openTarget(preset);
  // "asteroid Iris", "(433) Eros", "2P/Encke": a body of the solar system is asked for outright
  const outright = Bodies.saysBody(text);
  if (outright && await openBody(text)) return;
  note(T('note.lookingUpName', { name: text }));
  // A star, a galaxy? Or an asteroid, a comet, a planet? Both are asked at once. A star of that name wins ("Mira" is
  // the star, not asteroid 3633); a body is opened when no star is known by the name, or when the star catalogues
  // have not answered four seconds after the orbit service has.
  const tok = ++S.openTok, ask = new AbortController();
  const body = outright ? Promise.resolve(null) : Bodies.lookup(text, SURVEY0, surveyDays(), ask.signal).catch(() => null);
  const star = resolveName(text).then(r => ({ r, reached: true }), () => ({ r: null, reached: false }));
  const first = await Promise.race([star, body.then(b => (b ? nap(4000).then(() => ({ slow: true })) : star))]);
  if (first.r) ask.abort();          // a star it is: the orbit service need not be asked any further
  if (tok !== S.openTok) return;
  const known = first.r ? null : await body;
  if (known && await openBody(text, null, {}, known)) return;
  const { r, reached } = first.slow ? await star : first;
  if (tok !== S.openTok) return;
  if (!r) {
    note(reached ? T('note.notFound', { name: text }) : T('note.unreachable'), 8000);
    return;
  }
  note('');
  go({ ra: r.ra, dec: r.dec, size, track: r, target: preset || null });
}

/**
 * A body of the solar system by name: find the days SPHEREx had it in view and open the patch of sky it was crossing
 * then, with its path. `when` (a day) picks the visit that holds it, for a link that reopens a view; otherwise the
 * visit in which the body stayed in one field for the most stops of the telescope. Resolves to false when no body
 * of that name is known, to true when the request has been dealt with (also when it could only be answered in words).
 */
const orbitsDown = () => G`The service that knows the orbits of asteroids and comets (Miriade, Paris Observatory) could not be reached just now.`;
async function openBody(text, when = null, view = {}, known = null) {
  const led = followedNamed(text);          // an address written before the body became a showcase object, or a name written in full
  if (led) { openTarget(led); return true; }
  const tok = ++S.openTok, say = (words, ms) => { if (tok === S.openTok) note(words, ms); };
  say(T('note.lookingUpName', { name: text }));
  let b, visits, fine, v, o, name;
  try {
    b = known || await Bodies.lookup(text, SURVEY0, surveyDays());
    if (!b) return false;
    o = { num: b.kind === 'asteroid' ? b.num : null, name: b.name, cls: b.kind === 'planet' ? 'planet' : b.kind === 'comet' ? 'comet' : b.cls };
    name = Info.bodyName(o);
    say(G`Looking through SPHEREx's exposures for ${name}…`);
    visits = await Bodies.visitsOf(b.rows);
    if (tok !== S.openTok) return true;
    if (!visits.length) { say(G`SPHEREx has not had ${name} in view in the exposures published so far.`, 9000); return true; }
    v = (when && visits.find(x => when >= x.t0 - 1 && when <= x.t1 + 1)) || [...visits].sort((p, q) => q.inField - p.inField || q.t1 - p.t1)[0];
    // its path through that field hour by hour (a fast one: every twenty minutes), with its distance
    const quick = v.rate > 60;
    fine = await Bodies.ephemeris(b.query, v.from - 0.75, Math.ceil((v.to - v.from + 1.5) * (quick ? 72 : 24)) + 1, quick ? '20m' : '1h');
    if (!fine) throw new Error('no path');
  } catch (e) { console.error(e); say(orbitsDown(), 9000); return true; }
  if (tok !== S.openTok) return true;
  const at = Bodies.pathAt(fine.rows), p0 = at(v.from), p1 = at(v.to), dwarf = Info.bodyName(o) === b.name && o.num;
  const body = { number: o.num, id: o.num || b.code || b.name, code: b.code, kind: b.kind, query: text, mag: v.v, sun: v.sun, earth: v.delta, from: v.from, to: v.to,
    moved: p0 && p1 ? sepArcsec(p0.ra, p0.dec, p1.ra, p1.dec) : 0, source: 'Miriade (IMCCE)', visits: visits.map(x => ({ mjd: x.mjd, t0: x.from, t1: x.to, stops: x.inField })) };
  const wiki = b.kind === 'planet' ? [`${b.name} (planet)`, b.name] : b.kind === 'comet' ? [b.name, `Comet ${b.name.replace(/^\S+\//, '')}`] : dwarf ? [`${b.name} (dwarf planet)`, b.name] : o.num ? [`${o.num} ${b.name}`] : [b.name];
  say(''); $('q').value = name;
  go({ ra: v.ra, dec: v.dec, size: view.size || v.size, mode: 'trail', ...(view.det ? { det: view.det } : {}), ...(view.mode ? { mode: view.mode } : {}),
    track: { name, eph: fine.rows.map(r => [+r.mjd.toFixed(5), +r.ra.toFixed(6), +r.dec.toFixed(6), +r.delta.toFixed(6)]), body }, info: { name, type: Info.bodyKindEn(o), body: true, wiki } });          // the kind in English: the header says it in the language in use
  return true;
}

/** A click on the map: work out what is there today and open it. */
async function openAt(ra, dec, mapFov) {
  S.busyUntil = performance.now() + 9000;
  if (mapFov > 12) {                       // too far out to mean one object: dive in first
    note(T('note.zoomIn'), 3500);
    Sky.flyTo(ra, dec, Math.max(mapFov / 6, 2));
    return;
  }
  // How well can a click be aimed? A few pixels of the map, whatever that is on the sky at this zoom.
  const pixel = mapFov * 3600 / Math.max(200, $('map').clientWidth);
  const tok = ++S.openTok, r = clamp(12 * pixel, 8, 90), aim = clamp(5 * pixel, 5, 200), size = fovPick();
  const preset = S.targets.find(t => !t.follow && sepArcsec(ra, dec, t.ra, t.dec) < Math.max(20, Math.min(aim, 60)));          // a followed body is not at the place the list gives for it any more
  if (preset && size === preset.size) return openTarget(preset);
  note(T('note.lookingUp'));
  const info = await Info.identify(ra, dec, r, aim, true).catch(() => null);          // by hand: a click inside a bright star's glare means the star
  if (tok !== S.openTok) return;
  note('');
  if (info) go({ ra: info.ra, dec: info.dec, size, track: info, info, keepZoom: true });
  else go({ ra, dec, size, keepZoom: true });
}

let noteTimer = 0;
function note(text, ms) {
  const el = $('mapnote');
  clearTimeout(noteTimer);
  el.textContent = text; el.hidden = !text;
  if (text && ms) noteTimer = setTimeout(() => { el.hidden = true; }, ms);
}

function syncUrl() {
  const p = new URLSearchParams();
  if (isPreset()) p.set('target', S.target.slug);
  else if (S.track?.body?.query) { p.set('sso', S.track.body.query); p.set('at', S.track.body.from.toFixed(2)); p.set('fov', S.size); }          // a body opened by name: the name, and which of its visits
  else { p.set('ra', S.ra.toFixed(5)); p.set('dec', S.dec.toFixed(5)); p.set('fov', S.size); }
  p.set('det', S.det); p.set('mode', S.mode);
  const followed = S.sel?.trail ? (S.movers?.tracks || []).indexOf(S.sel.trail) + 1 : 0;
  if (followed) p.set('body', followed);
  if (document.body.classList.contains('embed')) p.set('embed', '1');
  history.replaceState(null, '', '?' + p.toString());
}

// ------------------------------------------------------------ events
$('search').onsubmit = e => { e.preventDefault(); search($('q').value); };
$('fov').onchange = () => { if (S.grid || S.ra) go({ ra: S.ra, dec: S.dec, size: +$('fov').value, target: S.target, track: S.track, hunt: S.hunt, info: S.info?.body || S.info?.hunt ? S.info : null }); };
$('play').onclick = () => { S.wantPlay = false; S.playing ? stop() : play(); };
$('prev').onclick = () => { S.wantPlay = false; stop(); step(-1); };
$('next').onclick = () => { S.wantPlay = false; stop(); step(1); };
$('seek').oninput = e => { S.wantPlay = false; stop(); S.idx = +e.target.value; show(); };
$('fps').onchange = e => { S.fps = +e.target.value; if (S.playing) play(); };
for (const b of $('modes').children) b.onclick = () => { stop(); S.mode = b.dataset.mode; S.seq = []; S.idx = 0; renderModes(); rebuild(); syncUrl(); };
$('white').oninput = e => { S.white = +e.target.value; paint(); };
$('invert').onchange = e => { S.invert = e.target.checked; paint(); };
$('smooth').onchange = e => { S.smooth = e.target.checked; paint(); };
$('gaia').onchange = e => { S.showGaia = e.target.checked; paint(); };
$('marks').onchange = e => { S.marks = e.target.checked; paint(); };
$('bandsOn').onchange = e => { S.showBands = e.target.checked; drawPlots(); };

$('wise').onchange = e => { S.showWise = e.target.checked; if (S.showWise) loadCatwise(); paint(); };
$('mask').onchange = e => { S.mask = e.target.checked; paint(); };
$('resetview').onclick = () => { resetView(); paint(); };
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (tourIdx >= 0 && (e.key === 'PageDown' || e.key === 'n')) { e.preventDefault(); return tourGo(tourIdx + 1); }
  if (tourIdx >= 0 && (e.key === 'PageUp' || e.key === 'b')) { e.preventDefault(); return tourGo(tourIdx - 1); }
  if (!$('sheetwrap').hidden && e.key === 'Escape') return closeSheet();
  if (e.key === 'Escape' && $('nav').classList.contains('open')) return closeMenu();
  if (coachAt >= 0 && e.key === 'Escape') return coachEnd();
  if (tourIdx >= 0 && e.key === 'Escape') return tourEnd();
  if (e.key === ' ') { e.preventDefault(); S.wantPlay = false; S.playing ? stop() : play(); }
  else if (e.key === 'ArrowRight') { S.wantPlay = false; stop(); step(1); }
  else if (e.key === 'ArrowLeft') { S.wantPlay = false; stop(); step(-1); }
});
new ResizeObserver(() => paint()).observe(cv);

// pointer: tap = measure, drag = pan, pinch / wheel = zoom
const ptrs = new Map(); let pinch = null;
function clampView() {
  const n = vg().n; S.view.z = clamp(S.view.z, 1, 32);
  const half = n / (2 * S.view.z);                       // the image always fills the frame
  S.view.cx = clamp(S.view.cx, half - 0.5, n - 0.5 - half); S.view.cy = clamp(S.view.cy, half - 0.5, n - 0.5 - half);
  // Not zoomed in: a vertical swipe scrolls the page. Zoomed in: dragging pans the image.
  cv.classList.toggle('zoomed', S.view.z > 1.01);
}
function resetView() {
  if (!S.grid) return;
  const c = (vg().n - 1) / 2; S.view = { z: 1, cx: c, cy: c };
  cv.classList.remove('zoomed');
}
function zoomAt(X, Y, factor) {
  const [gx, gy] = c2g(X, Y);
  S.view.z = clamp(S.view.z * factor, 1, 32);
  const W = cv.clientWidth, H = cv.clientHeight, s = W / vg().n * S.view.z;
  S.view.cx = gx - (X - W / 2) / s; S.view.cy = gy + (Y - H / 2) / s;
  clampView(); paint();
}
cv.addEventListener('pointerdown', e => {
  if (!S.grid) return;
  cv.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY, x0: e.offsetX, y0: e.offsetY, moved: false });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; }
});
cv.addEventListener('pointermove', e => {
  if (!S.grid) return;
  const p = ptrs.get(e.pointerId);
  if (!p) {
    const [gx, gy] = c2g(e.offsetX, e.offsetY), [ra, dec] = C.gridToSky(vg(), gx, gy);
    $('readout').textContent = `${C.fmtSex(ra, dec)}   (${ra.toFixed(5)}°, ${dec.toFixed(5)}°)`;
    return;
  }
  const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
  p.x = e.offsetX; p.y = e.offsetY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) p.moved = true;
  if (ptrs.size === 1 && p.moved) {
    const s = cv.clientWidth / vg().n * S.view.z;
    S.view.cx -= dx / s; S.view.cy += dy / s; clampView(); paint();
  } else if (ptrs.size === 2 && pinch) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    a.moved = b.moved = true;
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.d); pinch.d = d;
  }
});
const endPtr = e => {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinch = null;
  if (p && !p.moved && e.type === 'pointerup' && S.grid) pick(e.offsetX, e.offsetY);
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('wheel', e => { if (!S.grid) return; e.preventDefault(); zoomAt(e.offsetX, e.offsetY, e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
cv.addEventListener('dblclick', e => { if (S.grid) zoomAt(e.offsetX, e.offsetY, 2); });

function pick(X, Y) {
  if (followed()) return;          // the images are centred on the body: no other spot keeps its place in them
  if (S.mode === 'years') return;          // the ring stays on what was chosen in the other views
  const [gx, gy] = c2g(X, Y), it = S.seq[S.idx];
  // Clicking on the tracked target's predicted spot re-attaches the moving aperture.
  if (S.track && it) { const t = trackPos(it.mjd); if (Math.hypot(t[0] - gx, t[1] - gy) < 3) { S.sel = { follow: true }; paint(); renderMotion(); refreshPlots(); return; } }
  const img = it && it.img ? it.img : S.deep;
  const hit = img && C.centroid(img, S.grid.n, gx, gy, 2.5);
  const was = S.sel?.trail;
  S.sel = hit ? { x: hit.x, y: hit.y } : { x: gx, y: gy };
  if (was || S.mode === 'trail') { S.mode = 'frames'; rebuild(); renderMovers(); syncUrl(); }
  paint(); renderMeta(); renderMotion(); refreshPlots();
}

// ------------------------------------------------------------ share and export
const slugOf = () => (S.target?.label || S.info?.name || `${S.ra.toFixed(4)}_${S.dec.toFixed(4)}`).replace(/[^A-Za-z0-9+.-]+/g, '_').replace(/^_|_$/g, '');
let exportTimer = 0;
function exportNote(text) {
  const el = $('exportnote'); el.textContent = text;
  clearTimeout(exportTimer); if (text) exportTimer = setTimeout(() => { el.textContent = ''; }, 5000);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
$('copylink').onclick = async () => {
  try { await navigator.clipboard.writeText(location.href); exportNote(G`Link copied. It reopens exactly this view.`); }
  catch { exportNote(location.href); }
};
$('savepng').onclick = () => {
  if (!S.seq.length) return exportNote(G`Nothing to save yet.`);
  cv.toBlob(b => { if (b) { download(b, `chronosphere_${slugOf()}_D${S.det}_${S.mode}.png`); exportNote(G`Image saved.`); } }, 'image/png');
};
$('savecsv').onclick = () => {
  const pts = S.pts || [];
  if (!pts.length) return exportNote(G`No measurements yet: pick a star in the image.`);
  const relative = S.haloDets?.length > 0 && !S.haloAnchored, q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['date_utc', 'mjd', 'detector', 'wavelength_um', relative ? 'relative_brightness' : 'flux_mJy', relative ? 'relative_error' : 'flux_error_mJy', 'method', 'release', 'exposure', 'source_file'];
  const rows = [...pts].sort((a, b) => a.mjd - b.mjd).map(p => [C.fmtDate(p.mjd, true).replace(' UTC', ''), p.mjd.toFixed(5), p.det, p.lam.toFixed(4),
    p.flux.toPrecision(5), p.err.toPrecision(3), p.halo ? (relative ? 'halo (relative)' : 'halo joined to neighbouring detector (approximate)') : `aperture 9.2 arcsec${p.spoiled === 'star' ? '; a catalogued star behind it adds to this one' : p.spoiled === 'fault' ? '; faulty pixels in the aperture' : ''}`,
    q(p.frame.coll), q(p.frame.id), q(p.frame.url)].join(','));
  // Say which spot was measured: the object itself, or another star the user circled in its field.
  const trail = S.sel?.trail, path = bodyStops();
  const own = !trail && (!!S.sel?.follow || !S.grid || (S.sel && Math.hypot(S.sel.x - (S.grid.n - 1) / 2, S.sel.y - (S.grid.n - 1) / 2) < 3));
  const [sra, sdec] = trail ? C.gridToSky(S.grid, trail.sightings[0].x, trail.sightings[0].y) : own ? [S.ra, S.dec] : C.gridToSky(S.grid, S.sel.x, S.sel.y);
  const what = trail ? `${bodyLabel(trail)}, a body of the solar system passing through the field of ${slugOf()}, followed from stop to stop; the position is where it was first seen`
    : own ? `${slugOf()}${path ? ', followed along its orbit' : S.sel?.follow ? ', following its catalogued motion' : ''}` : `a spot in the field of ${slugOf()}`;
  const pos = `# Chronosphere: ${what}. RA ${sra.toFixed(6)} Dec ${sdec.toFixed(6)} (ICRS). SPHEREx level-2 exposures from NASA/IPAC IRSA.\n# ${location.href}\n`;
  const name = own ? slugOf() : `${sra.toFixed(5)}_${sdec >= 0 ? '+' : ''}${sdec.toFixed(5)}`;
  download(new Blob([pos + head.join(',') + '\n' + rows.join('\n') + '\n'], { type: 'text/csv' }), `chronosphere_${name}_measurements.csv`);
  exportNote(G`${pts.length} measurements saved.`);
};
/**
 * The measured places of the body being followed, as a report in the Minor Planet Center's format (ADES): one line
 * for every moment at which the search found it. The two detectors that looked at once make one observation. Where
 * the spacecraft was at each moment comes from the exposure's header.
 */
const reportTrack = () => S.sel?.trail || (S.sel?.follow && S.track?.eph ? (S.movers?.tracks || []).find(t => t.body?.own) : null) || null;
function showReportAsk(on) {
  $('reportask').hidden = !on;
  if (on) { try { $('reporter').value = localStorage.getItem('chrono-reporter') || ''; } catch { /* private mode */ } $('reporter').focus(); }
}
function askReport() {
  // the Minor Planet Center keeps the positions of minor planets, comets and far-out moons: a planet or one of its large moons is none of them
  const who = reportTrack()?.body;
  if (who && (Info.isMajor(who) || (who.own && S.track?.body?.kind === 'planet'))) return exportNote(G`A planet or one of its moons is not reported to the Minor Planet Center: there is no file to write for this one.`);
  if (!reportTrack()) return exportNote(S.movers?.state !== 'done' ? G`The search for moving dots is still at work: try again in a moment.`
    : S.sel?.follow && S.track?.eph ? G`The search did not find it in these images: there are no measured places to save.` : G`Follow a passing body first: its measured places are what the file holds.`);
  showReportAsk(true);
  $('reportask').scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
}
async function saveReport() {
  const t = reportTrack(), who = $('reporter').value.trim().replace(/[|\n\r]+/g, ' ').slice(0, 60);
  if (!t) return showReportAsk(false);
  try { localStorage.setItem('chrono-reporter', who); } catch { /* private mode */ }
  const by = new Map();
  for (const q of t.sightings) for (const c of q.hits) { const k = `${c.stop}:${c.sub}`; if (!by.has(k)) by.set(k, []); by.get(k).push(c); }
  exportNote(G`Reading where the spacecraft was at each exposure…`);
  const groups = [...by.values()], obs = [];
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < groups.length) {
      const hits = groups[next++], f = hits[0].frame, w = hits.reduce((k, c) => k + c.snr, 0);
      const sc = await Archive.whereWasIt(f, S.abort.signal).catch(() => null);
      if (!sc) continue;
      const [ra, dec] = C.gridToSky(S.grid, hits.reduce((k, c) => k + c.x * c.snr, 0) / w, hits.reduce((k, c) => k + c.y * c.snr, 0) / w), snr = Math.hypot(...hits.map(c => c.snr));
      obs.push({ mjd: f.mjd, ra, dec, rms: Bodies.placeError(snr), sc, snr, exp: f.exp, remark: `${[...hits].sort((p, q) => p.det - q.det).map(c => `D${c.det} ${c.lam.toFixed(2)} um`).join(', ')}; ${f.id}` });
    }
  }));
  if (obs.length < 2) return exportNote(G`Too few places could be measured for a report.`);
  const own = t.body?.own ? S.target?.body || S.track?.body : null, first = [...obs].sort((a, b) => a.mjd - b.mjd)[0];
  const id = Bodies.reportId(own ? { num: own.number, name: S.track?.name, code: own.code } : t.body, first.ra, first.dec, first.mjd);
  const text = Bodies.ades(id, obs, who || 'NAME OF THE PERSON WHO MEASURED (initials and surname)', [
    'Measured with Chronosphere (chronospherex.com) in SPHEREx level-2 exposures from NASA/IPAC IRSA.',
    'Places: centroids in exposures resampled to 3.1 arcsec pixels. Astrometry of each exposure by the SPHEREx pipeline, tied to Gaia DR3.',
    'pos1 to pos3: the spacecraft at mid-exposure, from the keywords X_SC, Y_SC, Z_SC of each exposure.',
    'Archival data: the Minor Planet Center asks to be contacted before such observations are submitted.']);
  download(new Blob([text], { type: 'text/plain' }), `chronosphere_${(id.permID || id.provID || id.trkSub).replace(/[^A-Za-z0-9]+/g, '_')}_positions_ades.psv`);
  showReportAsk(false);
  exportNote(G`${obs.length} positions saved, in the Minor Planet Center's format.`);
}
$('saveades').onclick = askReport;
$('reportsave').onclick = saveReport;
$('reportcancel').onclick = () => showReportAsk(false);
$('reporter').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveReport(); } });
const canRecord = !!(window.MediaRecorder && cv.captureStream);
if (!canRecord) $('savevideo').hidden = true;
$('savevideo').onclick = async () => {
  if (S.seq.length < 2) return exportNote(G`There is only one image here: nothing to animate.`);
  const type = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
  if (!type) return exportNote(G`This browser cannot record video.`);
  S.wantPlay = false; stop();
  const stream = cv.captureStream(30), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise(r => { rec.onstop = r; });
  const hold = Math.max(250, 1000 / S.fps), loops = S.seq.length <= 4 ? 3 : 1;
  exportNote(G`Recording…`);
  S.idx = 0; show(); rec.start();
  for (let k = 0; k < loops * S.seq.length; k++) { S.idx = k % S.seq.length; show(); await nap(hold); }
  rec.stop(); await finished; stream.getTracks().forEach(t => t.stop());
  download(new Blob(chunks, { type }), `chronosphere_${slugOf()}_D${S.det}_${S.mode}.${type.includes('mp4') ? 'mp4' : 'webm'}`);
  exportNote(G`Video saved.`);
};

// ------------------------------------------------------------ map controls
let sweeping = false, sweepTok = 0;
// The colours the guided tour steps through: three per detector, enough to tell the story and few enough to keep offline.
const TOUR_FRAMES = [2, 8, 14, 20, 25, 31, 37, 43, 48, 54, 60, 66, 71, 77, 83, 89, 95, 100];
const nap = ms => new Promise(r => setTimeout(r, ms));
/** Fetch map tiles ahead of time. They land in this device's storage, where the map then finds them. */
const warm = Sky.prefetch;
function showWave(z) {
  $('wave').value = z;
  $('wavelabel').textContent = `${Sky.waves()[z].toFixed(2)} µm`;
}
/** Show one colour of the SPHEREx map. The map dissolves into it once it is complete. */
function setWave(z) {
  const r = Sky.setSlice(z);
  showWave(r.z);
  r.done.then(ok => {
    if (ok !== 'missing') return;
    showWave(Sky.currentSlice());
    note(navigator.onLine === false ? T('note.colourNotSaved') : T('note.colourFailed'), 4000);
  });
  return r.done;
}
/** Step the map through its colours. Each one is loaded out of sight and dissolves in as a whole. */
async function sweep(on, frames = null) {
  sweeping = on; const my = ++sweepTok;
  $('waveplay').textContent = on ? '❚❚' : '▶';
  if (!on) return;
  const list = (frames || Sky.waves().map((_, i) => i)).filter(z => !Sky.isBlank(z));
  let i = list.findIndex(z => z >= Sky.currentSlice()), misses = 0;
  if (i < 0) i = list.length - 1;
  while (sweeping && my === sweepTok) {
    i = (i + 1) % list.length;
    const z = list[i];
    const ok = await Sky.setSlice(z, { fade: frames ? 420 : 280, onShow: () => showWave(z) }).done;
    if (!sweeping || my !== sweepTok) break;
    if (ok === 'missing') {
      if (++misses >= 3) { sweeping = false; $('waveplay').textContent = '▶'; showWave(Sky.currentSlice()); note(T('note.coloursNotSaved'), 4000); break; }
    } else misses = 0;
    if (ok !== true) await nap(250);
  }
}
function setLayer(id) {
  Sky.setLayer(id); $('layer').value = id;
  $('wavebox').style.display = id === 'spherex' ? '' : 'none';
  if (id !== 'spherex') sweep(false);
}

// ------------------------------------------------------------ the tour's worked example
/**
 * Two real SPHEREx pictures of one small patch of sky for the step of the tour that tells how Pluto
 * was found by comparing two photographs: Pluto itself, at two stops of the telescope about six days
 * apart (the gap between Tombaugh's two plates), in one detector, the middle of the stamp, drawn the
 * way the viewer draws them. They are made here, from the file that the Pluto step opens, so nothing
 * is shown that the tool itself did not compute.
 */
let blinkPair = null, blinkTimer = 0, blinkSide = 0;
function blinkFrames() {
  blinkPair ||= (async () => {
    const t = S.targets.find(x => x.slug === 'pluto' && x.eph);
    if (!t) return null;
    const frames = []; let head = null;
    await C.loadStream(dataUrl(t, 'd1.ndjson'), line => {
      if (line.t === 'head') head = line;
      else if (line.t === 'frame') { if (line.b64) { line.data = C.decodeF16(line.b64); delete line.b64; } frames.push(line); }
    });
    if (!head?.grid || frames.length < 4) return null;
    frames.sort((a, b) => a.mjd - b.mjd);
    const n = head.grid.n, npx = n * n, crop = Math.round(n * 0.74), x0 = (n - crop) >> 1, px = 5;      // most of the stamp, 5 screen pixels per image pixel
    // the stops of the telescope that caught the body inside the part shown, with two exposures or more
    const by = new Map();
    for (const f of frames) {
      const p = ephAt(t.eph, f.mjd);
      if (!p || f.cov < 0.95) continue;
      const [x, y] = C.skyToGrid(head.grid, p[0], p[1]);
      if (x < x0 + 6 || y < x0 + 6 || x > x0 + crop - 7 || y > x0 + crop - 7) continue;
      const k = Movers.stopOf(f.id); if (!by.has(k)) by.set(k, []); by.get(k).push(f);
    }
    const stops = [...by.values()].filter(v => v.length >= 2).map(v => ({ frames: v, mid: v.reduce((s, f) => s + f.mjd, 0) / v.length }));
    // of those, the two nearest to six days apart, with three exposures each if that can be had
    let pair = null;
    for (const a of stops) for (const b of stops) {
      if (b.mid <= a.mid) continue;
      const score = Math.abs(b.mid - a.mid - 6) - 0.2 * Math.min(a.frames.length, b.frames.length, 3);
      if (!pair || score < pair.score) pair = { a, b, score };
    }
    if (!pair) return null;
    const all = C.robustStats(C.medianStack(frames.filter((_, i) => i % Math.ceil(frames.length / 60) === 0), npx));
    const top = Math.max(all.p(0.9996), 60 * all.sig);         // one brightness scale for both pictures; high, so that the bright star stays a dot
    const days = pair.b.mid - pair.a.mid;
    return Object.assign([pair.a, pair.b].map(v => {
      // two exposures: the fainter of the two at each pixel, which leaves cosmic-ray hits out; three or more: their median
      const img = v.frames.length >= 3 ? C.medianStack(v.frames, npx) : Float32Array.from(v.frames[0].data, (q, p) => (v.frames[1].data[p] < q ? v.frames[1].data[p] : q));
      const sig = C.robustStats(img).sig;
      const lo = -2 * sig, soft = 3 * sig, norm = Math.asinh((Math.max(top, 10 * sig) - lo) / soft);
      const small = document.createElement('canvas'); small.width = small.height = crop;
      const sx = small.getContext('2d'), im = sx.createImageData(crop, crop);
      for (let j = 0; j < crop; j++) for (let i = 0; i < crop; i++) {
        const val = img[(x0 + crop - 1 - j) * n + x0 + i], o = (j * crop + i) * 4;          // north up: the stamp's rows run from the bottom
        const g = val === val ? 255 * stretch(val, lo, soft, norm) : 255;                   // a hole inside a star is a saturated core
        im.data[o] = im.data[o + 1] = im.data[o + 2] = g; im.data[o + 3] = 255;
      }
      sx.putImageData(im, 0, 0);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = crop * px;
      const cx = canvas.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(small, 0, 0, crop * px, crop * px);
      return { canvas, label: C.fmtRange(v.mid, v.mid) };
    }), { days });
  })().catch(() => null);
  return blinkPair;
}
async function showExample(on) {
  const el = $('blink');
  clearInterval(blinkTimer); blinkTimer = 0;
  if (!on) { el.hidden = true; document.body.classList.remove('example'); return; }
  const pair = await blinkFrames();
  if (!pair || tourSteps[tourIdx]?.demo !== 'blink') return;
  const c = $('blinkcv'), x = c.getContext('2d');
  const draw = () => {
    const f = pair[blinkSide];
    if (c.width !== f.canvas.width) c.width = c.height = f.canvas.width;
    x.drawImage(f.canvas, 0, 0); $('blinkdate').textContent = f.label;
  };
  const flip = () => { blinkSide = 1 - blinkSide; draw(); };
  const byHand = T('blink.flip');
  // six days apart, as Tombaugh's two plates were: said only when these two are
  $('blinkcap').textContent = `${T('blink.caption', { a: pair[0].label, b: pair[1].label })} ${pair.days > 5.5 && pair.days < 6.5 ? T('blink.pluto') : ''} ${calmMotion() ? byHand : ''}`;
  $('blinkstage').onclick = () => { if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = 0; $('blinkcap').textContent += ` ${byHand}`; } flip(); };
  blinkSide = 0; draw(); el.hidden = false; document.body.classList.add('example');
  if (!calmMotion()) blinkTimer = setInterval(flip, 850);          // a blink comparator: a hard flip, not a fade
}

/**
 * The tour's second example: a ladder of brightness, from the brightest star down to Planet X as
 * predicted. Magnitudes: Sirius -1.46 and the naked-eye limit of about 6 are textbook values;
 * Barnard's Star V 9.5 (SIMBAD); Pluto 15.1 at mean opposition (NASA fact sheet); one SPHEREx
 * exposure reaches about AB 19 in one colour at 5 sigma (SPHEREx sky simulator paper, 2025);
 * Planet X 22 to 25 (Brown & Batygin 2016), with searches complete to about 21 (Brown, Holman &
 * Batygin 2024). `times` is how many times fainter a rung is than the one above: 10^(0.4 x the
 * difference in magnitude), rounded.
 */
const RUNGS = [
  { mag: '−1.5', key: 'r1' }, { mag: '6', key: 'r2', times: [1000] }, { mag: '9.5', key: 'r3', times: [25] }, { mag: '15', key: 'r4', times: [160] },
  { mag: '19', key: 'r5', times: [40] }, { mag: '22–25', key: 'r6', times: [16, 250], unseen: true },
];
function showLadder(on) {
  const el = $('ladder');
  el.hidden = !on;
  if (!on) return;
  const nf = new Intl.NumberFormat(Lang.locale), point = nf.format(1.5).charAt(1);          // the decimal mark of the language in use
  $('laddertitle').textContent = T('ladder.title'); $('laddernote').textContent = T('ladder.note');
  $('rungs').innerHTML = RUNGS.map((r, i) => `${r.unseen ? `<li class="limit">${esc(T('ladder.limit'))}</li>` : ''}<li class="rung${r.unseen ? ' unseen' : ''}"><i style="--s:${i}"></i><b>${r.mag.replace('.', point)}</b><span>${esc(T(`ladder.${r.key}`))}${
    r.times ? `<small>${esc(T('ladder.times', { x: r.times.map(v => nf.format(v)).join('–') }))}</small>` : ''}</span></li>`).join('');
  document.body.classList.add('example');
}

// ------------------------------------------------------------ guided tour
let tourSteps = [], tourIdx = -1;
const tourApi = {
  closePanel: () => { if ($('app').dataset.panel === 'open') closePanel(); },
  layer: id => { if (Sky.isReady() && Sky.currentLayer() !== id) setLayer(id); },
  slice: z => { if (Sky.isReady()) setWave(z); },
  sweep: on => { if (Sky.isReady()) sweep(on && !calmMotion(), TOUR_FRAMES); },      // no automatic sweep for people who asked for less motion
  fly: (ra, dec, fov) => { if (Sky.isReady()) { S.busyUntil = performance.now() + 9000; Sky.flyTo(ra, dec, fov); } },
  open: t => openTarget(t),
  viewFov: Sky.objectFov,
  // Getting the next step ready while the current one is being read: its map tiles and its first images.
  warm: (ra, dec, fov, layout = 'open') => {
    if (!Sky.isReady() || !Sky.isSpherex()) return;
    const [w, h] = tourSizes()[layout];                    // the size the map will have at that step, not the size it has now
    warm(Sky.tiles({ ra, dec, fov: Sky.fitFov(typeof fov === 'function' ? fov(w) : fov, w, h), w, h, coarse: true }));
  },
  preload: t => { fetch(dataUrl(t, `d${t.view?.det || 2}.ndjson`), { priority: 'low' }).then(r => r.arrayBuffer()).catch(() => {}); },
  example: () => { blinkFrames(); },
  // the Years view of an object: switched to when the object is the one open, opened in it otherwise
  years: t => {
    if (S.target?.slug === t.slug && isPreset() && S.grid) { S.mode = 'years'; S.wantPlay = !calmMotion(); renderModes(); rebuild(); syncUrl(); maybeAutoplay(); }
    else go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, det: t.view?.det || 2, mode: 'years' });
  },
  preloadYears: t => { const Y = S.yearsIdx?.[t.slug]; if (Y) for (const f of Years.filesFor(t.view?.det || 2)) fetch(`data/${t.slug}/${f}?v=${encodeURIComponent(Y.built)}`, { priority: 'low' }).then(r => r.arrayBuffer()).catch(() => {}); },
};
/** The tour card docks under the map or floats over it, which changes the map's size. */
function relayout() {
  requestAnimationFrame(() => { if (Sky.isReady()) Sky.resize(); paint(); specPlot.draw(); lcPlot.draw(); });
}
/**
 * The map keeps one height through the tour: the one that leaves room for the longest card that docks under it. That
 * card's height is measured here, on a copy of the card that is never shown: every step's words are set into the copy,
 * at the width the docked card has, and the tallest result goes to the style sheet as --tourcard. On a phone every
 * step docks, but the two with a worked example are left out (there the example sits in the card and the page
 * scrolls); on a wide screen only the steps with an object open dock.
 */
let tourMeasured = '';
function measureTour() {
  if (!tourSteps.length) tourSteps = buildTour(tourTargets(), T, nameOf, slug => !!S.yearsIdx?.[slug]);
  const narrow = isNarrow(), W = window.innerWidth, key = `${narrow}|${W}|${tourSteps.length}|${document.fonts?.status || ''}`;
  if (key === tourMeasured) return;
  tourMeasured = key;
  const real = $('tour'), ghost = real.cloneNode(true);
  ghost.querySelectorAll('.blink').forEach(e => e.remove());          // a worked example that sits in the card just now
  ghost.querySelectorAll('[id]').forEach(e => { e.dataset.was = e.id; e.removeAttribute('id'); });
  ghost.removeAttribute('id'); ghost.hidden = false; ghost.className = 'tour tourprobe'; ghost.inert = true; ghost.setAttribute('aria-hidden', 'true'); ghost.removeAttribute('aria-live');
  ghost.style.width = `${Math.round(narrow ? W : W - Math.min(0.62 * W, 1000))}px`;
  document.body.appendChild(ghost);          // outside the map's column: the rules for a card that floats over the map, or is docked and stretched, do not reach it
  const part = id => ghost.querySelector(`[data-was=${id}]`);
  let tall = 0;
  tourSteps.forEach((st, i) => {
    if (narrow ? st.demo : !st.object) return;
    // the words as tourGo and showGuides set them
    part('tourcount').textContent = T('tour.count', { i: i + 1, n: tourSteps.length });
    part('tourtitle').textContent = st.title;
    part('tourtext').innerHTML = esc(st.text).replace(/\*([^*]+)\*/g, '<em>$1</em>');
    const links = part('tourlinks');
    links.hidden = !st.tryNext; links.textContent = st.tryNext ? `${T('tour.try')} ` : '';
    for (const o of [...(st.tryNext || []), ...(st.tryNext ? [{ name: T('hero.hunt') }] : [])]) { const b = document.createElement('button'); b.type = 'button'; b.textContent = o.shown || o.name; links.appendChild(b); }
    const pts = st.points || [], list = part('tourpoints');
    list.hidden = !pts.length; part('tourwalk').hidden = !pts.length;
    list.innerHTML = pts.map((p, k) => `<li><i class="guide">${k + 1}</i><span><b>${esc(p.label)}</b> ${esc(p.text)}</span></li>`).join('');
    tall = Math.max(tall, ghost.getBoundingClientRect().height);
  });
  ghost.remove();
  if (tall) document.documentElement.style.setProperty('--tourcard', `${Math.ceil(tall)}px`);
}
/** On a phone the tour's two worked examples sit in the card, under its title; on a wide screen they float over the map. */
function seatFigures() {
  const card = $('tour'), stage = $('mapstage'), inCard = isNarrow();
  for (const id of ['blink', 'ladder']) {
    const el = $(id);
    if (inCard && el.parentNode !== card) card.insertBefore(el, $('tourtext'));
    else if (!inCard && el.parentNode !== stage) stage.appendChild(el);
  }
}
// A turned phone, a resized window, the fonts arriving: the card is measured again and the examples take their seats.
// Only a real change of size counts: the map is told of a new layout with a resize event of the page's own making
// (Sky.resize), and on a phone the height alone changes whenever the browser's bars slide away, which moves nothing here.
const tourWindow = () => (isNarrow() ? `${window.innerWidth}` : `${window.innerWidth}x${window.innerHeight}`);
let tourResize = 0, tourWas = tourWindow();
const tourFit = force => {
  const now = tourWindow();
  if (force !== true && now === tourWas) return;
  tourWas = now;
  clearTimeout(tourResize); tourResize = setTimeout(() => { if (tourIdx < 0) return; seatFigures(); measureTour(); relayout(); if (Sky.isReady()) Sky.reshape(); }, 140);
};
window.addEventListener('resize', () => tourFit());
document.fonts?.ready.then(() => tourFit(true));
function tourGo(i) {
  coachEnd();
  if (!tourSteps.length) tourSteps = buildTour(tourTargets(), T, nameOf, slug => !!S.yearsIdx?.[slug]);
  seatFigures(); measureTour();
  if (i < 0) return;
  if (i >= tourSteps.length) return tourEnd();
  tourIdx = i;
  const st = tourSteps[i];
  document.body.classList.add('touring');
  $('welcome').hidden = true; $('tour').hidden = false;
  $('tourcount').textContent = T('tour.count', { i: i + 1, n: tourSteps.length });
  $('tourmini').textContent = `${i + 1} / ${tourSteps.length}`;
  $('tourprog').style.width = `${(i + 1) / tourSteps.length * 100}%`;
  $('tourtitle').textContent = st.title;
  $('tourtext').innerHTML = esc(st.text).replace(/\*([^*]+)\*/g, '<em>$1</em>');          // *words between asterisks* in italics
  const links = $('tourlinks');
  links.hidden = !st.tryNext; links.textContent = st.tryNext ? `${T('tour.try')} ` : '';
  for (const o of st.tryNext || []) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = o.shown || o.name;
    b.onclick = () => openKnown(o);
    links.appendChild(b);
  }
  if (st.tryNext && navigator.onLine !== false) {          // and, with a connection, a hunt: a patch of sky nobody has picked by hand
    const b = document.createElement('button');
    b.type = 'button'; b.id = 'tourhunt'; b.textContent = T('hero.hunt');
    b.onclick = () => startHunt();
    links.appendChild(b);
  }
  showGuides(st.points || []);
  $('tourback').disabled = i === 0;
  $('tournext').textContent = i === tourSteps.length - 1 ? T('tour.finish') : T('tour.next');
  st.run(tourApi);
  showExample(st.demo === 'blink'); showLadder(st.demo === 'ladder');
  setTimeout(() => { if (tourIdx === i) tourSteps[i + 1]?.prep?.(tourApi); }, 1500);
  renderLook(); relayout();
  if (Sky.isReady()) Sky.reshape();          // the card may have changed the size of the map
  if (isNarrow()) window.scrollTo({ top: 0, behavior: calmMotion() ? 'auto' : 'smooth' });
}
// ------------------------------------------------------------ a walk through the panel
// For whoever wants to learn the tool: the parts of the panel, one at a time. The part is lit, the
// rest of the panel dimmed, and a card says what the part shows and what can be done with it.
// Parts that are not on screen for this object (nothing to say yet, no motion table) are passed over.
const COACH = [          // the part (a CSS selector) and the key of its words in lang.js
  { at: '#about', key: 'about' },
  { at: '#findings', key: 'findings' },
  { at: '.viewer .stage', key: 'images' },
  { at: '#modes', key: 'modes' },
  { at: '.detwrap', key: 'dets' },
  { at: '.stack > section:nth-child(1)', key: 'spectrum' },
  { at: '.stack > section:nth-child(2)', key: 'lc' },
  { at: '#motion', key: 'motion' },
  { at: '.export', key: 'export' },
];
let coachAt = -1, coachTimer = 0, coachThen = null;          // coachThen: what follows when the walk has reached its end
const onScreen = sel => { const el = document.querySelector(sel); return !!el && el.offsetParent !== null && el.getBoundingClientRect().height > 12; };
const coachParts = () => COACH.map((s, k) => (onScreen(s.at) ? k : -1)).filter(k => k >= 0);
function coachSpot() {
  const st = COACH[coachAt], t = st && document.querySelector(st.at), spot = $('spot'), panel = $('panel');
  if (!t || !onScreen(st.at)) { spot.hidden = true; return; }
  const r = t.getBoundingClientRect(), pr = panel.getBoundingClientRect(), pad = 7;
  Object.assign(spot.style, { left: `${Math.round(r.left - pr.left + panel.scrollLeft - pad)}px`, top: `${Math.round(r.top - pr.top + panel.scrollTop - pad)}px`,
    width: `${Math.round(r.width + 2 * pad)}px`, height: `${Math.round(r.height + 2 * pad)}px` });
  spot.hidden = false;
}
/** Show the part before (-1), after (+1) or, to begin, the first part (0). */
function coachGo(dir) {
  const parts = coachParts();
  if (!parts.length || $('app').dataset.panel !== 'open') return;
  let k;
  if (dir === 0 || coachAt < 0) k = parts[0];
  else if (dir > 0) k = parts.find(x => x > coachAt);
  else k = [...parts].reverse().find(x => x < coachAt) ?? coachAt;
  if (k === undefined) { const then = coachThen; coachEnd(); then?.(); return; }
  if (coachAt < 0) showGuides([]);                    // the tour's own numbered pointers step aside meanwhile
  coachAt = k;
  S.factsCoach = COACH[k].key === 'about'; showFacts();
  const st = COACH[k], pos = Math.max(0, parts.indexOf(k)), last = pos === parts.length - 1;
  $('coachcount').textContent = T('coach.count', { i: pos + 1, n: parts.length });
  $('coachtitle').textContent = T(`coach.${st.key}.title`); $('coachtext').textContent = T(`coach.${st.key}.text`);
  $('coachnote').textContent = pos === 0 ? T('coach.note') : ''; $('coachnote').hidden = !$('coachnote').textContent;
  $('coachback').disabled = pos === 0; $('coachnext').textContent = last ? T('coach.done') : T('tour.next');
  $('coach').hidden = false; document.body.classList.add('coaching');
  // Bring the part into view: the panel scrolls by itself on a wide screen, the page does on a phone.
  const t = document.querySelector(st.at), r = t.getBoundingClientRect(), panel = $('panel'), behavior = calmMotion() ? 'auto' : 'smooth';
  if (isNarrow()) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 14), behavior });
  else panel.scrollTo({ top: Math.max(0, panel.scrollTop + r.top - panel.getBoundingClientRect().top - 18), behavior });
  clearInterval(coachTimer); coachSpot(); coachTimer = setInterval(coachSpot, 200);
}
function coachEnd() {
  coachThen = null;
  if (coachAt < 0) return;
  coachAt = -1; clearInterval(coachTimer);
  S.factsCoach = false; showFacts();
  $('coach').hidden = true; $('spot').hidden = true; document.body.classList.remove('coaching');
  if (tourIdx >= 0) showGuides(tourSteps[tourIdx]?.points || []);
  if (!isNarrow()) $('panel').scrollTo({ top: 0, behavior: calmMotion() ? 'auto' : 'smooth' });
}
$('coachnext').onclick = () => coachGo(1);
$('coachback').onclick = () => coachGo(-1);
$('coachclose').onclick = coachEnd;
$('tourwalk').onclick = () => coachGo(0);
/**
 * Numbered pointers from the tour's card to parts of the panel: the card lists what each number is,
 * and the same number sits on the part itself. The parts are redrawn and move as data arrives, so the
 * pointers are not put inside them: they lie on a layer of their own and are placed again a few times a second.
 */
let guideTimer = 0;
function showGuides(points) {
  clearInterval(guideTimer);
  const list = $('tourpoints'), layer = $('guides'), panel = $('panel');
  list.hidden = layer.hidden = !points.length;
  $('tourwalk').hidden = !points.length;
  list.innerHTML = points.map((p, i) => `<li><i class="guide">${i + 1}</i><span><b>${esc(p.label)}</b> ${esc(p.text)}</span></li>`).join('');
  layer.innerHTML = points.map((p, i) => `<i class="guide" data-at="${esc(p.at)}" data-dx="${+p.dx || 0}" data-dy="${+p.dy || 0}" hidden>${i + 1}</i>`).join('');
  if (!points.length) return;
  const place = () => {
    const pr = panel.getBoundingClientRect(), nudge = isNarrow() ? 0 : 1;      // on a phone the pointers sit above their part, not beside it
    for (const g of layer.children) {
      const t = document.querySelector(g.dataset.at), r = t && t.offsetParent !== null ? t.getBoundingClientRect() : null;
      g.hidden = !r || !r.width;
      if (!g.hidden) { g.style.left = `${Math.round(r.left - pr.left + panel.scrollLeft + nudge * g.dataset.dx)}px`; g.style.top = `${Math.round(r.top - pr.top + panel.scrollTop + nudge * g.dataset.dy)}px`; }
    }
  };
  place(); guideTimer = setInterval(place, 300);
}
/** Where a catalogued object is this month: its year-2000 place, moved along by its yearly motion. */
function placeNow(o) {
  const [ra, dec] = C.propagate({ ra: o.ra2000, dec: o.dec2000, pmra: o.pmra, pmdec: o.pmdec }, 2000, C.epochNow());
  return { ...o, ra, dec };
}
const TRY_SIZE = 5;          // the field, in arcminutes, at which the tour's last objects are opened and kept
/** Open one of the objects the tour's last step offers. Without a connection that works for the ones kept on this device. */
async function openKnown(o) {
  const r = placeNow(o);
  if (navigator.onLine === false && !(await Store.has(liveKey(r.ra, r.dec, TRY_SIZE, S.det))) && !(await Store.has(liveKey(r.ra, r.dec, TRY_SIZE, 'kept')))) {
    note(T('note.needsConnection', { name: o.name }), 9000);
    return;
  }
  tourEnd(); $('q').value = o.name;
  go({ ra: r.ra, dec: r.dec, size: TRY_SIZE, track: r });
}
function tourEnd() {
  coachEnd();
  tourIdx = -1; $('tour').hidden = true; document.body.classList.remove('touring'); showExample(false); showLadder(false); showGuides([]);
  sweep(false); renderLook(); relayout();
  if (Sky.isReady()) Sky.reshape();
}
$('tourbtn').onclick = $('tourbtn2').onclick = () => tourGo(0);
$('huntbtn').onclick = () => startHunt();
$('tournext').onclick = () => {
  // At the first object the audience meets the panel: Next walks through its parts once, then goes on.
  // The walk can be left at any moment with its ×; the next press of Next then goes on with the tour.
  const st = tourSteps[tourIdx], at = tourIdx;
  if (st?.points?.length && !st.walked && $('app').dataset.panel === 'open' && coachParts().length) {
    st.walked = true;
    coachGo(0);
    coachThen = () => { if (tourIdx === at) tourGo(at + 1); };
    return;
  }
  tourGo(tourIdx + 1);
};
$('tourback').onclick = () => tourGo(tourIdx - 1);
$('tourclose').onclick = tourEnd;
$('hidewelcome').onclick = () => { $('welcome').hidden = true; };

// ------------------------------------------------------------ article sheets
let sheetOpener = null, sheetTok = 0;
function openSheet(id) {
  if (!SHEETS[id] && !PAGE_FILES[id]) return;
  sheetOpener = document.activeElement;
  const wrap = $('sheetwrap'), sh = $('sheet'), tok = ++sheetTok;
  const fill = html => {
    sh.innerHTML = `<button type="button" class="close" aria-label="${NAV ? G('Close') : 'Close'}">×</button>${html}`;
    sh.querySelector('.close').onclick = closeSheet;
    // the page's invitation to the tour, or to a hunt, starts it here, over the same map
    sh.querySelectorAll('.docgo a').forEach(a => { a.onclick = e => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); closeSheet(); if (a.dataset.do === 'hunt') startHunt(); else tourGo(0); }; });
  };
  fill(SHEETS[id] ? SHEETS[id]() : '');
  wrap.hidden = false; wrap.scrollTop = 0; sh.focus();
  if (!SHEETS[id]) pageWords(id).then(html => { if (tok === sheetTok && !wrap.hidden) fill(html); })
    .catch(() => { if (tok === sheetTok) location.href = pageAddress(id); });          // not to be had as a sheet: the page itself
}
/** The address of a page that exists as a plain page only (scripts/build_pages.mjs), in the language in use. */
const pageAddress = id => new URL((Lang.locale === 'en' ? '' : `${Lang.locale}/`) + PAGE_FILES[id], location.href).href;
const pageCache = new Map();
/** The words of such a page, for showing over the map: its article, without the links that lead around the plain pages. */
function pageWords(id) {
  if (!pageCache.has(id)) {
    const url = pageAddress(id);
    pageCache.set(id, fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); }).then(text => {
      const art = new DOMParser().parseFromString(text, 'text/html').querySelector('article');
      art.querySelector('.docmore')?.remove();
      for (const el of art.querySelectorAll('[src]')) el.setAttribute('src', new URL(el.getAttribute('src'), url).href);          // addresses in the page are relative to the page
      for (const el of art.querySelectorAll('a[href]')) el.setAttribute('href', new URL(el.getAttribute('href'), url).href);
      return art.innerHTML;
    }));
    pageCache.get(id).catch(() => pageCache.delete(id));
  }
  return pageCache.get(id);
}
function closeSheet() {
  $('sheetwrap').hidden = true;
  if (sheetOpener?.isConnected) sheetOpener.focus();          // back to where the reader was
  sheetOpener = null;
}
$('sheetwrap').addEventListener('click', e => { if (e.target === $('sheetwrap')) closeSheet(); });
// While an article is open, Tab stays inside it.
$('sheet').addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  const items = [...$('sheet').querySelectorAll('button, a[href]')];
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === $('sheet'))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
// The pages also exist as plain pages with addresses of their own (scripts/build_pages.mjs): a plain click opens
// the words over the map, a click meant for a new tab or window follows the link. The three whose words are in
// pages.js are shown from there; "Planet X", written by that script from the tour's words, is read from its plain page.
document.querySelectorAll('[data-sheet]').forEach(b => {
  b.href = SHEETS[b.dataset.sheet] ? (NAV ? `${Lang.lang}/` : '') + PAGE_FILES[b.dataset.sheet] : pageAddress(b.dataset.sheet);
  b.onclick = e => { if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); closeMenu(); openSheet(b.dataset.sheet); };
});
if (NAV) {          // the three pages are in the language in use: so are their names in the top bar
  document.querySelectorAll('[data-sheet]').forEach(b => { b.textContent = NAV[b.dataset.sheet] || b.textContent; });
  $('navlinks').removeAttribute('lang'); $('sheetwrap').removeAttribute('lang');
}
function closeMenu() { $('nav').classList.remove('open'); $('menubtn').setAttribute('aria-expanded', 'false'); }
$('menubtn').onclick = () => { const open = $('nav').classList.toggle('open'); $('menubtn').setAttribute('aria-expanded', String(open)); };
document.addEventListener('click', e => { if (!e.target.closest('#nav')) closeMenu(); });
$('zoomin').onclick = () => { S.busyUntil = performance.now() + 6000; Sky.zoomBy(0.5); };
$('zoomout').onclick = () => { S.busyUntil = performance.now() + 6000; Sky.zoomBy(2); };
// Dragging or zooming the map by hand also asks for tiles: let those go first.
for (const ev of ['pointerdown', 'wheel']) $('map').addEventListener(ev, () => { S.busyUntil = performance.now() + 6000; }, { passive: true, capture: true });
// Phones: the map fills what is left under the header, whatever its height.
const setTopH = () => document.documentElement.style.setProperty('--toph', `${$('top').offsetHeight}px`);
new ResizeObserver(setTopH).observe($('top')); setTopH();
// A library request that fails while offline must not surface as an error.
window.addEventListener('unhandledrejection', e => { if (/Failed to fetch|NetworkError|Load failed/i.test(String(e.reason?.message || e.reason))) e.preventDefault(); });
$('wave').oninput = e => { sweep(false); setWave(+e.target.value); };
$('waveplay').onclick = () => sweep(!sweeping);
$('layer').onchange = e => setLayer(e.target.value);

// ------------------------------------------------------------ offline
/** Sky-map tiles the guided tour shows: the wide views, the colour sweep and each of the five stops. */
/** Size of the map, in pixels, during the tour: with no object open (wide) and with one open (open). */
function tourSizes() {
  const W = window.innerWidth, H = window.innerHeight - $('top').offsetHeight, narrow = isNarrow();
  if (S.targets.length) measureTour();                    // the map's height in the tour follows from the tour's longest card
  const card = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tourcard')) || 400;
  // on a phone the map has one height at every step (the style sheet's --tourmap, worked out here the same way); on a
  // wide screen it fills the window, and with an object open it leaves the docked card its room
  const phone = document.body.classList.contains('touring') && narrow ? $('mapstage').offsetHeight : Math.max(170, Math.min(H - 62 - card, 0.45 * window.innerHeight));
  return {
    full: [W, H],
    wide: narrow ? [W, phone] : [W, H],
    open: narrow ? [W, phone] : [W - Math.min(0.62 * W, 1000), Math.max(150, H - Math.min(card, H - 150))],
  };
}
function tourTiles() {
  if (!Sky.isReady()) return [];
  const { full, wide, open } = tourSizes();
  const urls = new Set();
  const add = (ra, dec, fov, [w, h], z = 25) => Sky.tiles({ ra, dec, fov: Sky.fitFov(fov, w, h), z, w, h, coarse: z === 25 }).forEach(u => urls.add(u));      // with the coarse tiles the map asks for first when it arrives somewhere
  for (const size of [wide, full]) {
    for (const z of TOUR_FRAMES) add(266.4, -29.0, 110, size, z);
    add(83.82, -5.39, 60, size);
  }
  for (const t of tourTargets()) { add(t.ra, t.dec, Sky.objectFov(t.size, open[0]), open); add(t.ra, t.dec, Sky.objectFov(t.size, wide[0]), wide); }
  return [...urls];
}
/**
 * Keep the guided tour on this device so that it runs without a connection.
 * lite: what each stop shows first. full: every detector of every stop, and the tour's sky maps.
 */
async function saveTourOffline(full) {
  if (!('caches' in window)) return;
  const el = $('offline'), say = html => { if (el) el.innerHTML = html; };
  const files = [];
  for (const t of tourTargets()) {
    const d = t.view?.det || 2;
    files.push(dataUrl(t, `d${d}.ndjson`), dataUrl(t, 'gaia.json'));       // what each tour step shows first
    if (t.eph && !full) for (let k = 1; k <= 6; k++) if (k !== d) files.push(dataUrl(t, `d${k}.ndjson`));      // a body is shown stop by stop, across the detectors
    if (t.wikiCard?.thumb) files.push(t.wikiCard.thumb);
    const Y = S.yearsIdx?.[t.slug];
    if (Y && t.slug === 'barnard') for (const f of Years.filesFor(d)) files.push(`data/${t.slug}/${f}?v=${encodeURIComponent(Y.built)}`);          // the tour's step of its 26 years
    if (t.wikiCard && Lang.locale !== 'en') Info.wikipediaIn(Lang.locale, t.wikiCard);          // asked once here, the encyclopedia card in the page's language is kept for offline use too
  }
  if (full) {
    for (const t of tourTargets()) for (let d = 1; d <= 6; d++) if (d !== (t.view?.det || 2)) files.push(dataUrl(t, `d${d}.ndjson`));
    for (const t of tourTargets()) files.push(dataUrl(t, 'catwise.json'));
    files.push(...tourTiles());
  }
  let done = 0, failed = 0, next = 0;
  // Saving happens behind the scenes and must never slow down what the visitor is looking at:
  // it waits whenever something is being loaded or the map is on the move.
  const busy = savingMustWait;
  const worker = async () => {
    while (next < files.length) {
      while (busy()) await nap(600);
      const f = files[next++];
      try { const r = await Sky.quietFetch(f, { mode: 'cors', priority: 'low' }); if (r.ok) await r.arrayBuffer(); else failed++; } catch { failed++; }
      done++;
      if (done % 3 === 0 || done === files.length) say(esc(T('off.saving', { p: Math.round(done / files.length * 100) })));
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const ok = failed <= files.length * 0.02;
  try { localStorage.setItem('chrono-offline', ok ? (full ? 'full' : 'lite') : ''); } catch { /* private mode */ }
  if (full && ok) { say(TOUR_SAVED); offerLastObjects(say); }
  else if (full) say(`${esc(T('off.some', { failed, n: files.length }))} <button type="button" id="savetour">${esc(T('off.retry'))}</button>`);
  else say(`${esc(T('off.lite'))} <button type="button" id="savetour">${esc(T('off.full'))}</button>`);
  const btn = $('savetour'); if (btn) btn.onclick = () => saveTourOffline(true);
}
const savingMustWait = () => performance.now() < S.busyUntil || sweeping || Object.values(S.dets).some(d => d.loading);
const TOUR_SAVED = esc(T('off.saved'));
/**
 * The objects offered at the end of the tour are read live from NASA's archive: some 400 exposures
 * each, about a megabyte apiece. That is too much to fetch unasked, so it is offered: once read, they
 * are kept on this device like any position already opened, and open without a connection too.
 */
async function offerLastObjects(say) {
  if (!tourSteps.length) tourSteps = buildTour(tourTargets(), T, nameOf, slug => !!S.yearsIdx?.[slug]);          // the tour may not have been started yet
  const list = (tourSteps.at(-1)?.tryNext || []).map(placeNow);
  if (!list.length || !('caches' in window)) return;
  const kept = await Promise.all(list.map(o => Store.has(liveKey(o.ra, o.dec, TRY_SIZE, 'kept'))));
  if (kept.every(Boolean)) return say(esc(T('off.savedWith', { n: list.length })));
  say(`${TOUR_SAVED} <button type="button" id="savelast">${esc(T('off.keep', { n: list.length }))}</button> ${esc(T('off.keepNote'))}`);
  $('savelast').onclick = () => keepLastObjects(list, say);
}
async function keepLastObjects(list, say) {
  let failed = 0;
  for (const [i, o] of list.entries()) {
    const tell = what => say(`${TOUR_SAVED} ${esc(T('off.keeping', { name: o.name, i: i + 1, n: list.length }))}${what ? `, ${esc(what)}` : ''}…`);
    if (await Store.has(liveKey(o.ra, o.dec, TRY_SIZE, 'kept'))) continue;
    tell('');
    try {
      // What the catalogue says, the encyclopedia card, the stars of the field: the very requests the
      // page makes when the object is opened. The service worker keeps their answers.
      const found = await Info.identifyFull(o.ra, o.dec, 10, 6).catch(() => null);
      if (found?.best) {
        const ids = await Info.aliases(found.best.oid);
        const card = await Info.wikipedia(Info.wikiTitles([found.best.mainId, ...ids])).catch(() => null);
        if (card?.thumb) await isPhoto(card.thumb);          // loads the encyclopedia's picture, which keeps it
      }
      await Info.gaiaStars(o.ra, o.dec, TRY_SIZE * 0.75 + 0.5).catch(() => null);
      // The images, detector by detector, exactly as opening the object reads them.
      const frames = await Archive.findFrames(o.ra, o.dec);
      let whole = true;
      for (let det = 1; det <= 6; det++) {
        if (!frames.some(f => f.det === det)) continue;
        const key = liveKey(o.ra, o.dec, TRY_SIZE, det);
        if (await Store.has(key)) continue;
        while (savingMustWait()) await nap(600);
        tell(T('off.det', { d: det }));
        const lines = [];
        await Archive.stream(o.ra, o.dec, TRY_SIZE, det, line => lines.push(line), undefined, frames);
        const end = lines.find(l => l.t === 'done');
        if (end && end.failed <= 0.1 * (end.n + end.failed + 1)) await Store.put(key, lines); else whole = false;
      }
      if (whole) await Store.put(liveKey(o.ra, o.dec, TRY_SIZE, 'kept'), [{ t: 'kept', name: o.name, at: Date.now() }]); else failed++;
    } catch { failed++; }
  }
  if (!failed) say(esc(T('off.savedWith', { n: list.length })));
  else {
    say(`${TOUR_SAVED} ${esc(T('off.failed', { failed, n: list.length }))} <button type="button" id="savelast">${esc(T('off.retry'))}</button>`);
    $('savelast').onclick = () => keepLastObjects(list, say);
  }
}
function startOfflineSave() {
  const c = navigator.connection;
  if (c?.saveData) return;
  // Laptops and desktops take everything; phones take the light part and offer the rest, and so does any
  // device on a very slow connection. (The browser's estimate drops to "3g" on a fast line too, because
  // the archive itself answers slowly: that alone must not hold the save back.)
  const roomy = !isNarrow() && !(c && (c.effectiveType === '2g' || c.effectiveType === 'slow-2g'));
  saveTourOffline(roomy);
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  // A newer version of the site that turns up in the first seconds, before anything has been touched,
  // is applied by reloading once. Later it simply waits for the next visit: never in the middle of a demonstration.
  const hadWorker = !!navigator.serviceWorker.controller, opened = performance.now();
  let touched = false;
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadWorker && !touched && performance.now() - opened < 8000 && tourIdx < 0) location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => { reg.update().catch(() => {}); return navigator.serviceWorker.ready; })      // look for a newer version straight away
    .then(() => setTimeout(startOfflineSave, 3000)).catch(() => {});
}

// ------------------------------------------------------------ start
(async function init() {
  const q = new URLSearchParams(location.search);
  S.embed = q.has('embed');
  if (q.has('debug')) window.__app = { S, C, findComparisons, usable, gEpoch, scan: () => scanResult };      // for inspection from the console
  if (S.embed) document.body.classList.add('embed');
  Lang.applyStatic();
  document.title = HOME_TITLE;
  const pick = $('lang');
  pick.innerHTML = Object.entries(Lang.LANGS).map(([code, name]) => `<option value="${code}"${code === Lang.lang ? ' selected' : ''}>${name}</option>`).join('');
  pick.onchange = () => Lang.choose(pick.value);
  renderModes(); renderDets();
  try { S.targets = await (await fetch('data/targets.json')).json(); } catch { S.targets = []; }
  try { S.yearsIdx = await (await fetch('data/years.json')).json(); } catch { S.yearsIdx = {}; }
  renderChips();
  $('layer').innerHTML = Sky.LAYERS.map(l => `<option value="${l.id}">${G(l.label)}</option>`).join('');
  if (!S.embed) {
    try {
      await Sky.init('#map', { still: !(q.has('target') || (q.has('ra') && q.has('dec'))), onClick: openAt, onFov: f => { $('fovlabel').textContent = f >= 10 ? `${Math.round(f)}°` : f >= 1 ? `${f.toFixed(1)}°` : `${Math.round(f * 60)}′`; } });
      setWave(25);
      document.querySelector('#map .aladin-input-text')?.setAttribute('aria-label', T('search.label'));          // the map library's own position box has no name of its own
      // On a slow connection the first picture takes a few seconds: say so, instead of an empty map.
      const loading = T('note.loadingMap'), slow = setTimeout(() => { if ($('mapnote').hidden) note(loading); }, 1800);
      Sky.firstPicture().then(() => { clearTimeout(slow); if ($('mapnote').textContent === loading) note(''); });
    } catch (e) {
      console.error(e);
      $('welcome').innerHTML = G`<h1>The sky map could not start here.</h1><p class="lede">It needs WebGL 2. Search still works, and so does the guided tour.</p>`;
      $('wavebox').style.display = 'none'; $('layer').style.display = 'none';
    }
  }
  const det = +q.get('det') || undefined, mode = q.get('mode') || undefined;
  S.wantBody = +q.get('body') || 0;          // a passing body that the link was following: taken up again once the search has found it
  const t = S.targets.find(x => x.slug === q.get('target'));
  if (t) return go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, ...(t.view || {}), ...(det ? { det } : {}), ...(mode ? { mode } : {}) });
  if (q.has('ra') && q.has('dec')) return go({ ra: +q.get('ra'), dec: +q.get('dec'), size: +(q.get('fov') || q.get('size') || 5), det, mode });
  if (q.get('sso')) return openBody(q.get('sso'), +q.get('at') || null, { det, mode, size: +q.get('fov') || 0 }).then(known => { if (!known) note(T('note.notFound', { name: q.get('sso') }), 8000); });
  if (q.has('hunt')) return startHunt(+q.get('hunt') || 0);          // ?hunt=1292 repeats the hunt for that asteroid: for testing, and for showing one to somebody
  if (q.has('tour')) tourGo(0);
  if (PAGE_FILES[location.hash.slice(1)]) openSheet(location.hash.slice(1));
})();
