import * as C from './core.js';
import { Plot, dateTicks } from './plot.js';
import * as Sky from './sky.js';
import * as Info from './info.js';
import { buildTour } from './tour.js';
import { SHEETS, NAV } from './pages.js';
import * as Archive from './archive.js';
import * as Lang from './lang.js';

const T = Lang.t, G = Lang.G;          // the words of the front page, the tour and the walk through the panel, in the language in use

const API = (window.CHRONO_API || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const yearNow = C.epochNow;
const NUM = new Intl.NumberFormat('en'), NUM2 = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });      // made once: making one per number is slow
const nExp = n => Lang.N(n, 'exposure');

const MODES = {
  epochs: G`One stacked image per SPHEREx visit to this spot, played in a loop. Anything that moved between visits jumps.`,
  frames: G`Every single exposure in time order. Each one sees the sky at a slightly different wavelength, so stars flicker naturally.`,
  color: G`Time shown as colour: first visit in red, last in blue. Stars that stayed put look white; anything that moved or changed splits into colours.`,
  diff: G`A later visit minus an earlier one. Steady stars mostly cancel, leaving at most a faint smudge; a moving object leaves a strong dark-and-bright pair.`,
  deep: G`All exposures of this detector added together: the deepest, cleanest image.`,
  bands: G`The same patch of sky in each of the six detectors, from 0.75 to 5 microns, then all six as one colour picture (short wavelengths blue, long red). Cold objects only appear at the long end.`,
};

const S = {
  targets: [], target: null, track: null, ra: 0, dec: 0, size: 5,
  head: null, grid: null, det: 2, dets: {}, mode: 'epochs',
  seq: [], idx: 0, playing: false, fps: 2, timer: null,
  sel: null, view: { z: 1, cx: 0, cy: 0 }, white: 0, invert: false, smooth: false, mask: false,
  showGaia: true, marks: true, busyUntil: 0, gaia: null, off: new Set(), abort: null, deep: null, hi: 1, gen: 0,
  info: null, infoState: 'idle', wiki: null, openTok: 0, showBands: true, embed: false, find: {},
};

const cv = $('sky'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'), octx = off.getContext('2d');
const specPlot = new Plot($('spec'), $('spec').nextElementSibling);
const lcPlot = new Plot($('lc'), $('lc').nextElementSibling);

// ------------------------------------------------------------ loading
const isPreset = () => !!(S.target && S.size === S.target.size);
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

async function go({ ra, dec, size, target = null, track = null, det, mode, info = null, fly = true, keepZoom = false }) {
  coachEnd();
  S.abort?.abort(); S.abort = new AbortController();
  const gen = ++S.gen;
  stop();
  Object.assign(S, { ra, dec, size: size || 5, target, track: track || (target && target.resolved) || null,
    head: null, grid: null, dets: {}, seq: [], idx: 0, sel: null, gaia: null, catwise: null, deep: null, off: new Set(), stacks: null, epochs: null, pts: [], bandCache: {}, stackCache: {}, haloDets: [] });
  S.info = info; S.infoState = info ? 'done' : 'loading'; S.wiki = null; S.found = null; S.moved = null; S.find = {};
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
    Sky.mark(ra, dec, S.size, target ? target.label : info ? info.name : track?.name || '');
  }
  openPanel();
  const mapFirst = Sky.isReady() ? Promise.race([Sky.onItsWay(), nap(450)]) : null;
  loadInfo(gen);
  $('fov').value = String(S.size);
  $('notice').hidden = true; S.failed = null;
  syncUrl(); renderChips(); renderAbout(); renderModes(); renderDets(); show(); refreshPlots();
  setStatus(G`Finding the exposures that cover this spot…`);
  loadCatalog(gen);
  try {
    if (S.showWise) setTimeout(loadCatwise, 1500);
    // The map and the images want the same processor: the map goes first (it needs a fraction of a second).
    if (mapFirst) { await mapFirst; if (gen !== S.gen) return; }
    await loadDet(S.det, gen);
    if (gen !== S.gen) return;
    if (!S.head || !S.head.total) return;
    for (let d = 1; d <= 6; d++) {
      if (gen !== S.gen) return;
      if (!S.dets[d] && +S.head.avail[d] > 0) await loadDet(d, gen);
    }
    if (gen === S.gen) { setStatus(''); autoDetector(); renderMotion(); maybeAutoplay(); }
  } catch (e) {
    if (e.name === 'AbortError' || gen !== S.gen) return;
    console.error(e);
    // Say what happened and offer to try again; a returning connection retries by itself.
    const retry = () => go({ ra, dec, size: S.size, target, track, det: S.det, mode: S.mode, info, fly: false });
    S.failed = retry;
    setStatus('');
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
  } else if (S.mode === 'bands' && D.done) { rebuild();
  } else if (!S.dets[S.det]?.loading) {
    setStatus(D.done ? '' : G`Loading detector ${det} for the spectrum: ${D.frames.length} of ${D.total}`, D.done ? 0 : D.frames.length / Math.max(1, D.total));
  }
  renderDets();
  refreshPlots();
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
  const ready = S.mode === 'bands'
    ? [1, 2, 3, 4, 5, 6].every(d => !+S.head.avail[d] || S.dets[d]?.done)
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
  if (S.catwise || !S.grid) return;
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
  const n = S.grid.n, npx = n * n, frames = usable(S.det);
  const keepMjd = S.seq[S.idx]?.mjd, keepDet = S.seq[S.idx]?.det;
  // Group by the archive-wide observing seasons so every detector agrees on what "season 2" is.
  const byEp = new Map();
  for (const f of frames) { const k = gEpoch(f.mjd); if (!byEp.has(k)) byEp.set(k, []); byEp.get(k).push(f); }
  S.epochs = [...byEp.keys()].sort((a, b) => a - b).map(k => {
    const fr = byEp.get(k); return { i: k, frames: fr, t0: fr[0].mjd, t1: fr[fr.length - 1].mjd, mid: (fr[0].mjd + fr[fr.length - 1].mjd) / 2 };
  });
  const stacks = S.epochs.map(e => {
    const img = C.medianStack(e.frames, npx);
    return { kind: 'stack', img, sig: C.robustStats(img).sig, mjd: e.mid, n: e.frames.length, ep: e,
      title: `${S.head?.split ? '' : G`Visit ${gEpoch(e.mid) + 1} · `}${C.fmtMonth(e.mid)}`, sub: `${nExp(e.frames.length)} · ${C.fmtRange(e.t0, e.t1)}` };
  });
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
      title: C.fmtDate(f.mjd, true), sub: `${lamAt(f).toFixed(3)} µm · ${f.id}` }));
  } else if (S.mode === 'epochs') seq = stacks;
  else if (S.mode === 'deep') {
    if (S.deep) seq = [{ kind: 'stack', img: S.deep, sig: S.deepSig, mjd: frames[frames.length >> 1].mjd, n: frames.length,
      title: G`Deep sum`, sub: G`${nExp(frames.length)}, all visits` }];
  } else if (S.mode === 'bands') {
    S.bandCache = S.bandCache || {};
    const per = {};
    for (let d = 1; d <= 6; d++) {
      const fr = usable(d); if (!fr.length) continue;
      const key = `${S.gen}:${fr.length}:${S.off.size}`;
      if (S.bandCache[d]?.key !== key) {
        const sub = fr.length > 80 ? fr.filter((_, i) => i % Math.ceil(fr.length / 80) === 0) : fr;
        const img = C.medianStack(sub, npx), st = C.robustStats(img);
        S.bandCache[d] = { key, kind: 'stack', det: d, img, sig: st.sig, hi: Math.max(st.p(0.997), 25 * st.sig), mjd: fr[fr.length >> 1].mjd,
          n: fr.length, title: G`${C.DET_BANDS[d][0]} to ${C.DET_BANDS[d][1]} µm`, sub: G`${nExp(fr.length)}, all visits` };
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
  } else if (S.mode === 'diff') {
    const pair = (a, b) => {
      const img = C.subtract(b.img, a.img);
      return { kind: 'diff', img, sig: C.robustStats(img).sig, mjd: b.mjd, title: G`${C.fmtMonth(b.mjd)} minus ${C.fmtMonth(a.mjd)}`, sub: G`white = brighter later, black = brighter earlier` };
    };
    for (let i = 1; i < stacks.length; i++) seq.push(pair(stacks[i - 1], stacks[i]));
    if (stacks.length > 2) seq.push(pair(stacks[0], stacks[stacks.length - 1]));
  }
  S.seq = seq;
  let idx = 0;
  if (keepMjd !== undefined && seq.length) {
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
  if (!S.sel) defaultSelection();
  $('seek').max = Math.max(0, seq.length - 1);
  renderMotion(); renderScan();
  show();
}

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
function trackPos(mjd) {
  let [ra, dec] = C.propagate({ ra: S.track.ra2000, dec: S.track.dec2000, pmra: S.track.pmra, pmdec: S.track.pmdec }, 2000, C.mjdToYear(mjd));
  const plx = S.target?.dist?.plx ?? S.track.plx;
  if (plx > 20) {
    const [dE, dN] = C.parallaxOffset(ra, dec, plx, mjd);
    ra += dE / 3600 / Math.max(Math.cos(dec * Math.PI / 180), 1e-6); dec += dN / 3600;
  }
  return C.skyToGrid(S.grid, ra, dec);
}
function selPos(mjd) {
  if (!S.sel) return null;
  if (S.sel.follow && S.track) return trackPos(mjd);
  return [S.sel.x, S.sel.y];
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
  const n = S.grid.n, npx = n * n;
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
  const W = cv.clientWidth, H = cv.clientHeight, s = W / S.grid.n * S.view.z;
  return [S.view.cx + (X - W / 2) / s, S.view.cy - (Y - H / 2) / s];
}

function overlays(it, W, H, s) {
  const g = S.grid, year = C.mjdToYear(it.mjd);
  ctx.lineWidth = 1.2; ctx.font = '12px system-ui, sans-serif';
  // The circled spot. Everything else is drawn so that the inside of this ring stays clear:
  // a faint object must never be hidden by the marks that point at it.
  const sel = S.marks ? selPos(it.mjd) : null;
  const [PX, PY] = sel ? g2c(sel[0], sel[1], W, H, s) : [-1e6, -1e6], rAp = 9.2 / g.scale * s, clear = rAp + 3;
  if (S.marks) {
    // Gaia: circle at each star's catalogue position for this date; arrows for fast movers.
    if (S.showGaia && S.gaia) {
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
    if (S.showWise && S.catwise) {
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
    if (S.track && S.head?.epochs?.length) {
      const eps = S.head.epochs;
      const a = trackPos(eps[0][0] - 200), b = trackPos(eps[eps.length - 1][1] + 200);
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
        eps.forEach((e, i) => {
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
    // Stars that the field check flagged: a diamond, wide enough to leave the star in view.
    if (scanResult?.flags?.length && scanKey.startsWith(`${S.gen}:${S.det}:`)) {
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
      ctx.beginPath(); ctx.arc(PX, PY, 18 / g.scale * s, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(PX, PY, 30 / g.scale * s, 0, 7); ctx.stroke();
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
  $('caption').innerHTML = it ? `<b><i style="background:${epochColor(it.mjd)}"></i>${it.title}</b><span>${it.det === 0 ? '' : `D${it.det || S.det} · `}${it.sub}</span>` : '';
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
  const n = S.grid.n, c = (n - 1) / 2, sc = S.grid.scale, pts = [];
  S.haloDets = [];
  for (let det = 1; det <= 6; det++) {
    const fr = usable(det); if (!fr.length) continue;
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
      let a = useHalo ? memo(f, `halo${ring}:${at(p)}`, () => C.halo(f.data, n, sc, p[0], p[1], f.sig, ring)) : memo(f, `ap:${at(p)}`, () => C.aperture(f.data, n, sc, p[0], p[1], f.sig));
      if (a && a.halo && !(a.valid >= 0.7 && a.flux === a.flux)) a = null;
      if (!a) return;
      pts.push({ lam: f.lam + f.lgx * (p[0] - c) + f.lgy * (p[1] - c), flux: a.flux, err: a.err, mjd: f.mjd, det, frame: f, halo: useHalo });
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
  const pts = S.pts = measureAll(), cur = S.seq[S.idx]?.frame;
  const fl = pts.map(p => p.flux);
  const relative = S.haloDets?.length > 0 && !S.haloAnchored;
  const inJy = !relative && fl.length > 0 && pct(fl, 0.9) >= 2000, u = inJy ? 0.001 : 1, unit = inJy ? 'Jy' : 'mJy';
  const sp = pts.map(p => ({ x: p.lam, y: p.flux * u, err: p.err * u, color: epochColor(p.mjd), src: p, big: p.frame === cur, hollow: p.halo }));
  const ymax = fl.length ? pct(fl, 0.98) * 1.25 * u : 1, ymin = fl.length ? Math.min(0, pct(fl, 0.02)) * u : 0;
  specPlot.set(sp, {
    xlabel: G`wavelength (µm)`, ylabel: relative ? G`relative brightness` : G`brightness (${unit})`, ylim: [ymin - (ymax - ymin) * 0.04, ymax > ymin ? ymax : ymin + 1],
    xlim: [0.7, 5.1], empty: S.failed ? G`No images to measure` : !S.grid ? G`Waiting for the images…` : S.sel ? G`Measuring…` : G`Click or tap a star in the image`,
    shade: [...(S.grid ? [{ x0: C.DET_BANDS[S.det][0], x1: C.DET_BANDS[S.det][1], color: '#ff7b3916' }] : []),
      ...(S.showBands ? C.MOLECULES.map((m, i) => ({ x0: m.band[0], x1: m.band[1], color: '#ffffff12', label: m.f, row: i % 2 })) : [])],
    tipText: p => `${p.x.toFixed(3)} µm · ${relative ? `×${p.y.toFixed(2)}` : `${p.src.halo ? '≈ ' : ''}${p.y.toFixed(p.y >= 100 ? 0 : 2)}${p.src.halo ? '' : ` ± ${p.err.toFixed(2)}`} ${unit}`} · ${C.fmtDate(p.src.mjd)} · D${p.src.det}`,
    onPick: p => jumpTo(p.src),
  });
  // Variability: each point relative to the spot's own median spectrum.
  const medErr = pts.length ? pct(pts.map(p => p.err), 0.5) : 0;
  const ref = C.referenceSpectrum(pts);
  const lc = [];
  for (const p of pts) {
    if (p.det !== S.det) continue;
    const r = ref(p.lam);
    if (!(r > 5 * medErr)) continue;
    lc.push({ x: p.mjd, y: p.flux / r, err: p.err / r, color: epochColor(p.mjd), src: p, big: p.frame === cur });
  }
  const ly = lc.map(p => p.y), lo = ly.length ? Math.min(0.5, pct(ly, 0.02)) : 0, hi = ly.length ? Math.max(1.5, pct(ly, 0.98)) : 2;
  const check = realityCheck(lc);
  lcPlot.set(lc, {
    xlabel: 'date', ylabel: 'relative brightness', ylim: [lo - 0.1, hi + 0.1], hline: 1, errors: lc.length < 400,
    band: check?.steady != null ? { y0: 1 - check.steady, y1: 1 + check.steady } : null,
    xTicks: dateTicks, empty: pts.length ? G`Too faint (or saturated) in D${S.det} to measure changes` : S.failed ? G`No images to measure` : !S.grid ? G`Waiting for the images…` : G`Click or tap a star in the image`,
    tipText: p => `${C.fmtDate(p.x)} · ×${p.y.toFixed(2)} · ${p.src.lam.toFixed(2)} µm`,
    onPick: p => jumpTo(p.src),
  });
  renderMolecules(steadied(pts));
  $('lctitle').textContent = G`Brightness over time · D${S.det} (${C.DET_BANDS[S.det].join('–')} µm)`;
  $('speclegend').innerHTML = (S.head?.epochs || []).map((e, i) => `<span><i style="background:${C.EPOCH_COLORS[i % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((e[0] + e[1]) / 2)}</span>`).join('');
  const loadingMore = !!S.head && [1, 2, 3, 4, 5, 6].some(d => +S.head.avail[d] > 0 && !S.dets[d]?.done);
  const haloNote = !S.haloDets?.length ? ''
    : relative ? G`<b>Too bright for the camera in ${loadingMore ? G`the detectors loaded so far` : G`every detector`}.</b> The star's core is saturated, so it is measured from its faint outer glow instead (hollow points). The scale is relative${loadingMore ? G` until the other detectors arrive` : ''}; the changes over time are real. `
      : G`<b>Too bright for the camera in ${S.haloDets.map(d => 'D' + d).join(', ')}.</b> There the star's core is saturated, so it is measured from its faint outer glow and each detector is scaled to join its neighbour (hollow points). The overall shape is right; the level and the fine detail are approximate. `;
  const hollow = !S.haloDets?.length ? '' : relative ? G` The star is too bright for the camera, so the scale is relative (hollow points).` : G` Hollow points (${S.haloDets.map(d => 'D' + d).join(', ')}): the star is too bright for the camera there, so they are approximate.`;
  $('specnote').innerHTML = !pts.length ? '' : G`<p class="hint">Each point is one exposure, coloured by visit: ${pts.length} so far. Click a point to see that exposure.${hollow}</p>
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
function renderMolecules(pts) {
  const el = $('molecules');
  if (!S.showBands || pts.length < 30) { el.innerHTML = ''; S.find.bands = null; renderFindings(); return; }
  const rowsData = C.bandDepths(pts);
  {
    // The table below, said in one line. Only what is beyond doubt makes the headline: a band has to
    // stand out by six times its uncertainty here, against four in the table. What passes the table's
    // test but not this one is called possible.
    const seen = m => m.depth !== null && Math.abs(m.depth) > 0.12 && Math.abs(m.depth) > 4 * m.err;
    const sure = m => seen(m) && Math.abs(m.depth) > 0.15 && Math.abs(m.depth) > 6 * m.err;
    const short = { 'Water vapour': G`water`, 'Carbon monoxide, methane': G`carbon monoxide or methane`, 'Methane, or water ice': G`methane or water ice`, 'Carbon dioxide, gas or ice': G`carbon dioxide`, 'Carbon monoxide': G`carbon monoxide` };
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
  const rows = rowsData.map(m => {
    let cls = 'none', txt = G(m.why || 'not enough data');
    if (m.depth !== null) {
      const pc = Math.round(Math.abs(m.depth) * 100), sure = Math.abs(m.depth) > 4 * m.err;
      if (m.depth > 0.12 && sure) { cls = 'dip'; txt = G`${pc}% dip`; }
      else if (m.depth < -0.12 && sure) { cls = 'peak'; txt = G`${pc}% brighter`; glow = true; }
      else txt = G`flat`;
    }
    // Brighter inside the band than beside it: nothing absorbs there, something glows.
    const label = cls === 'peak' ? `${G(m.glow || 'Something glowing')} <span class="none">${G`emission`}</span>` : `${G(m.name)} <span class="none">${m.f}</span>`;
    return `<tr><td>${label}</td><td>${m.band[0].toFixed(2)}–${m.band[1].toFixed(2)}</td><td class="${cls}">${txt}</td></tr>`;
  }).join('');
  if (rowsData.every(m => m.depth === null)) {
    el.innerHTML = G`<p class="hint">Molecule bands cannot be measured here: ${rowsData.some(m => m.why === 'star too bright to tell') ? G`the star is too bright for the camera` : rowsData.some(m => m.why === 'too faint to tell') ? G`the spot is too faint` : rowsData.some(m => m.why === 'too uneven to tell') ? G`the measurements scatter too much` : G`there are not enough measurements yet`}.</p>`;
    return;
  }
  el.innerHTML = G`<table class="t mol"><thead><tr><th>Molecule</th><th>Band <span class="asis">(µm)</span></th><th>Measured</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">How much fainter the spot is inside each band than just outside it. A dip is a hint that the molecule is there, not proof.${glow ? G` Where a band is brighter instead, hot gas or dust is glowing at that wavelength.` : ''}</p>`;
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
  const f = S.find || {}, ready = !!S.dets[S.det]?.done;
  const rows = ready ? [['motion', f.motion], ['lccheck', f.change], ['molecules', f.bands]].filter(r => r[1]) : [];
  const html = rows.length ? G`<h2>What the measurements say</h2><ul>${rows.map(([to, r]) => G`<li class="${r.cls}"><button type="button" data-to="${to}" title="Show how this was measured">${r.html}</button></li>`).join('')}</ul>` : '';
  if (el.dataset.was !== html) { el.dataset.was = html; el.innerHTML = html; }
  el.hidden = !rows.length;
  leadState();
}
/** The lead of the panel (what to look for, what the measurements say) takes no room while it has nothing to say. */
function leadState() { document.querySelector('.cols').classList.toggle('nolook', !$('lookbox').innerHTML && $('findings').hidden); }
$('findings').addEventListener('click', e => {
  const to = e.target.closest('button')?.dataset.to;
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
  const mine = [...(S.track ? eps.map(e => trackPos((e[0] + e[1]) / 2)) : []), ...(S.sel && !S.sel.follow ? [[S.sel.x, S.sel.y]] : [])];
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
  if (!S.grid || !D?.done || !S.stacks || S.stacks.length < 2) { el.innerHTML = ''; scanResult = null; scanKey = ''; return; }
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
    paint(); renderMeta(); renderMotion(); refreshPlots();
    $('sky').scrollIntoView({ block: 'nearest', behavior: calmMotion() ? 'auto' : 'smooth' });
  }; });
}

// ------------------------------------------------------------ side panels
function renderChips() {
  const el = $('examples'); el.innerHTML = '';
  for (const t of S.targets) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t.label; b.onclick = () => openTarget(t);
    el.appendChild(b);
  }
  // Suggestions on which the tool has been tried: nearby fast movers, brown dwarfs, a nebula, a galaxy.
  $('suggest').innerHTML = [...S.targets.map(t => t.label), 'Proxima Centauri', 'Luhman 16', 'Wolf 359', "Teegarden's Star", "Kapteyn's Star", 'NGC 7027', 'Andromeda Galaxy']
    .map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('');
}
const openTarget = t => go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, ...(t.view || { mode: 'epochs' }) });

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
    if (S.info) {
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
  const name = t ? t.label : i ? i.name : k?.name ? k.name : S.infoState === 'failed' || S.infoState === 'loading' ? G`This spot` : G`Uncatalogued spot`;
  document.title = `${name} · Chronosphere`;          // the tab, the history and a bookmark say which object this is
  const sp = t?.sp || i?.sptype;
  const spHtml = sp ? G` · spectral type <span class="asis">${esc(sp)}</span>` : '';
  const kind = t?.type ? `${esc(G(t.type))}${spHtml}` : i ? `${esc(G(i.type))}${spHtml}`
    : S.infoState === 'loading' ? G`Identifying…` : S.infoState === 'failed' ? G`Not identified` : S.moved ? G`The star that was here has moved on` : G`Nothing catalogued at this spot`;
  // A star that catalogues list here, at its year-2000 place, but that has moved on since.
  const mv = !t && !i ? S.moved : null, mvPm = mv ? Math.hypot(mv.pmra, mv.pmdec) / 1000 : 0;
  const gloss = t ? G(t.blurb) : i ? Info.gloss(i.otype, i.sptype)
    : mv ? G`${mv.name} was at this spot in the year 2000, which is where catalogues still list it. It moves ${mvPm.toFixed(1)}″ a year and is now ${(mv.dist / 60).toFixed(1)}′ away.`
      : S.infoState === 'failed' ? G`The catalogue that names objects could not be reached just now, so this spot is not identified.`
        : S.infoState === 'done' ? G`No catalogue lists an object exactly here. SPHEREx still has images of this patch: what do you see?` : '';
  const facts = [];
  const fact = (label, value, small, title) => facts.push(`<div${title ? ` title="${esc(title)}"` : ''}><dt>${label}</dt><dd>${value}${small ? `<small>${small}</small>` : ''}</dd></div>`);

  // Motion on the sky. Curated values first, then what the look-up returned.
  const pmSrc = t?.pm || (i && i.pmra != null ? i : k && k.pmra != null ? k : null);
  const pm = pmSrc ? Math.hypot(pmSrc.pmra, pmSrc.pmdec) / 1000 : 0;          // arcseconds per year
  const fast = pm > 0.2;
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
  if (S.head) {
    const eps = S.head.epochs, split = !!S.head.split;
    fact(G`SPHEREx has`, `${S.head.estimated ? G`about ` : ''}${nExp(S.head.total)}`,
      G`${Lang.N(eps.length, split ? 'time slice' : 'visit')}, ${C.fmtMonth(eps[0]?.[0] ?? 0)} to ${C.fmtMonth(eps.at(-1)?.[1] ?? 0)}`);
  }
  const w = S.wiki;
  // The encyclopedia's picture sits in the header only when it is a photograph (see isPhoto).
  const thumb = w?.thumb ? `<a class="thumb" href="${esc(w.url)}" target="_blank" rel="noopener" title="Wikipedia: ${esc(w.title)}"${photos.get(w.thumb) === true ? '' : ' hidden'}><img src="${esc(w.thumb)}" alt="${esc(w.title)}, image from Wikipedia"></a>` : '';
  const links = [...(w ? [{ label: 'Wikipedia', title: G`Encyclopedia article: ${w.title}`, url: w.url }] : []), ...Info.externalLinks(S.ra, S.dec, i)]
    .map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.title)}">${l.label}</a>`).join('');
  el.innerHTML = `<div class="toprow">
      <div class="idblock"><p class="kind">${kind}</p><h1>${esc(name)}</h1>${gloss ? `<p class="gloss">${esc(gloss)}</p>` : ''}${mv ? G`<p class="gomoved"><button type="button" class="cta" id="gomoved">Go to where it is now</button></p>` : ''}</div>
      ${thumb}<button type="button" class="close" id="closepanel" title="${G`Close and return to the map`}" aria-label="${G`Close`}">×</button>
    </div>
    <dl class="facts">${facts.join('')}</dl>
    <div class="links"><span>${G`Check it in`}</span>${links}${S.embed ? '' : `<button type="button" class="howto" id="howto" lang="${Lang.lang}" title="${esc(T('coach.openTitle'))}">${esc(T('coach.open'))}</button>`}</div>`;
  $('closepanel').onclick = closePanel;
  if ($('howto')) $('howto').onclick = () => coachGo(0);
  if (mv) $('gomoved').onclick = () => {
    const preset = S.targets.find(x => sepArcsec(mv.ra, mv.dec, x.ra, x.dec) < 20);
    if (preset && +$('fov').value === preset.size) openTarget(preset);
    else go({ ra: mv.ra, dec: mv.dec, size: +$('fov').value, track: mv, info: mv });
  };
  if (w?.thumb && !photos.has(w.thumb)) isPhoto(w.thumb).then(() => { if (S.wiki?.thumb === w.thumb) { renderAbout(); } });
  renderLook(); renderWiki(); renderMotion();
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
  const t = S.target, show = !!t?.look && tourIdx < 0 && !S.embed;
  $('lookbox').innerHTML = show ? `<p class="look"><b>${G`What to look for`}</b>${esc(G(t.look))}</p>` : '';
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
  for (const b of $('modes').children) b.setAttribute('aria-pressed', b.dataset.mode === S.mode);
  $('explain').textContent = MODES[S.mode];
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
    const res = await Archive.readFlags(f, S.grid);
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
  } else {
    add(G`Image`, it.title);
    add(G`Built from`, it.sub);
    if (it.det !== 0) { const d = it.det || S.det; add(G`Detector`, `D${d} (${C.DET_BANDS[d].join('–')} µm)`); }
    if (it.sig) add(G`Noise (1σ)`, `${it.sig.toFixed(3)} MJy/sr`);
    if (it.ep) add(G`Releases`, [...new Set(it.ep.frames.map(f => f.coll))].join(', '));
    add(G`Pixel flags`, G`Flags belong to single exposures: choose “Exposures” above, then read them here.`);
  }
  if (S.grid) add(G`Pixel scale`, G`${S.grid.scale.toFixed(2)}″ (resampled, north up, east left)`);
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
  // The CDS name resolver and its mirror at Harvard; then SIMBAD itself, which knows exact identifiers.
  let answered = false;                       // did any service answer at all?
  for (const base of ['https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?', 'https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oxp/SNV?']) {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(base + encodeURIComponent(name), { signal: ctl.signal });
      clearTimeout(timer);
      if (r.ok) { answered = true; const v = parse(await r.text()); if (v) return v; }
    } catch { /* try the next one */ }
  }
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
  const size = +$('fov').value;
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
  const q = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const preset = S.targets.find(t => [t.label, t.slug, t.query].some(s => { const v = s.toLowerCase().replace(/[^a-z0-9]/g, ''); return v.includes(q) || q.includes(v); }));
  if (preset && size === preset.size) return openTarget(preset);
  note(T('note.lookingUpName', { name: text }));
  let r = null, reached = true;
  try { r = await resolveName(text); } catch { reached = false; }
  if (!r) {
    note(reached ? T('note.notFound', { name: text }) : T('note.unreachable'), 8000);
    return;
  }
  note('');
  go({ ra: r.ra, dec: r.dec, size, track: r, target: preset || null });
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
  const tok = ++S.openTok, r = clamp(12 * pixel, 8, 90), aim = clamp(5 * pixel, 5, 200), size = +$('fov').value;
  const preset = S.targets.find(t => sepArcsec(ra, dec, t.ra, t.dec) < Math.max(20, Math.min(aim, 60)));
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
  else { p.set('ra', S.ra.toFixed(5)); p.set('dec', S.dec.toFixed(5)); p.set('fov', S.size); }
  p.set('det', S.det); p.set('mode', S.mode);
  if (document.body.classList.contains('embed')) p.set('embed', '1');
  history.replaceState(null, '', '?' + p.toString());
}

// ------------------------------------------------------------ events
$('search').onsubmit = e => { e.preventDefault(); search($('q').value); };
$('fov').onchange = () => { if (S.grid || S.ra) go({ ra: S.ra, dec: S.dec, size: +$('fov').value, target: S.target, track: S.track }); };
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
  const n = S.grid.n; S.view.z = clamp(S.view.z, 1, 32);
  const half = n / (2 * S.view.z);                       // the image always fills the frame
  S.view.cx = clamp(S.view.cx, half - 0.5, n - 0.5 - half); S.view.cy = clamp(S.view.cy, half - 0.5, n - 0.5 - half);
  // Not zoomed in: a vertical swipe scrolls the page. Zoomed in: dragging pans the image.
  cv.classList.toggle('zoomed', S.view.z > 1.01);
}
function resetView() {
  if (!S.grid) return;
  const c = (S.grid.n - 1) / 2; S.view = { z: 1, cx: c, cy: c };
  cv.classList.remove('zoomed');
}
function zoomAt(X, Y, factor) {
  const [gx, gy] = c2g(X, Y);
  S.view.z = clamp(S.view.z * factor, 1, 32);
  const W = cv.clientWidth, H = cv.clientHeight, s = W / S.grid.n * S.view.z;
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
    const [gx, gy] = c2g(e.offsetX, e.offsetY), [ra, dec] = C.gridToSky(S.grid, gx, gy);
    $('readout').textContent = `${C.fmtSex(ra, dec)}   (${ra.toFixed(5)}°, ${dec.toFixed(5)}°)`;
    return;
  }
  const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
  p.x = e.offsetX; p.y = e.offsetY;
  if (Math.hypot(p.x - p.x0, p.y - p.y0) > 6) p.moved = true;
  if (ptrs.size === 1 && p.moved) {
    const s = cv.clientWidth / S.grid.n * S.view.z;
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
  const [gx, gy] = c2g(X, Y), it = S.seq[S.idx];
  // Clicking on the tracked target's predicted spot re-attaches the moving aperture.
  if (S.track && it) { const t = trackPos(it.mjd); if (Math.hypot(t[0] - gx, t[1] - gy) < 3) { S.sel = { follow: true }; paint(); renderMotion(); refreshPlots(); return; } }
  const img = it && it.img ? it.img : S.deep;
  const hit = img && C.centroid(img, S.grid.n, gx, gy, 2.5);
  S.sel = hit ? { x: hit.x, y: hit.y } : { x: gx, y: gy };
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
    p.flux.toPrecision(5), p.err.toPrecision(3), p.halo ? (relative ? 'halo (relative)' : 'halo joined to neighbouring detector (approximate)') : 'aperture 9.2 arcsec',
    q(p.frame.coll), q(p.frame.id), q(p.frame.url)].join(','));
  // Say which spot was measured: the object itself, or another star the user circled in its field.
  const own = !!S.sel?.follow || !S.grid || (S.sel && Math.hypot(S.sel.x - (S.grid.n - 1) / 2, S.sel.y - (S.grid.n - 1) / 2) < 3);
  const [sra, sdec] = own ? [S.ra, S.dec] : C.gridToSky(S.grid, S.sel.x, S.sel.y);
  const what = own ? `${slugOf()}${S.sel?.follow ? ', following its catalogued motion' : ''}` : `a spot in the field of ${slugOf()}`;
  const pos = `# Chronosphere: ${what}. RA ${sra.toFixed(6)} Dec ${sdec.toFixed(6)} (ICRS). SPHEREx level-2 exposures from NASA/IPAC IRSA.\n# ${location.href}\n`;
  const name = own ? slugOf() : `${sra.toFixed(5)}_${sdec >= 0 ? '+' : ''}${sdec.toFixed(5)}`;
  download(new Blob([pos + head.join(',') + '\n' + rows.join('\n') + '\n'], { type: 'text/csv' }), `chronosphere_${name}_measurements.csv`);
  exportNote(G`${pts.length} measurements saved.`);
};
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
 * Two real SPHEREx pictures of one small patch of sky, about a year apart, for the step of the tour
 * that explains why the same place is looked at twice: the first and the last visit to Barnard's
 * Star, the middle of the stamp, drawn the way the viewer draws them. They are made here, from the
 * same file that the Barnard step opens, so nothing is shown that the tool itself did not compute.
 */
let blinkPair = null, blinkTimer = 0, blinkSide = 0;
function blinkFrames() {
  blinkPair ||= (async () => {
    const t = S.targets.find(x => x.slug === 'barnard');
    if (!t) return null;
    const frames = []; let head = null;
    await C.loadStream(dataUrl(t, `d${t.view?.det || 5}.ndjson`), line => {
      if (line.t === 'head') head = line;
      else if (line.t === 'frame') { if (line.b64) { line.data = C.decodeF16(line.b64); delete line.b64; } frames.push(line); }
    });
    if (!head?.grid || frames.length < 4) return null;
    frames.sort((a, b) => a.mjd - b.mjd);
    const visits = C.splitEpochs(frames, 60);
    if (visits.length < 2) return null;
    const n = head.grid.n, npx = n * n, crop = Math.round(n * 0.74), x0 = (n - crop) >> 1, px = 5;      // most of the stamp, 5 screen pixels per image pixel
    const all = C.robustStats(C.medianStack(frames.filter((_, i) => i % Math.ceil(frames.length / 60) === 0), npx));
    const top = Math.max(all.p(0.9996), 60 * all.sig);         // one brightness scale for both pictures; high, so that the bright star stays a dot
    return [visits[0], visits[visits.length - 1]].map(v => {
      const img = C.medianStack(v.frames, npx), sig = C.robustStats(img).sig;
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
      return { canvas, label: C.fmtMonth(v.mid) };
    });
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
  $('blinkcap').textContent = `${T('blink.caption', { a: pair[0].label, b: pair[1].label })} ${calmMotion() ? byHand : ''}`;
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
};
/** The tour card docks under the map or floats over it, which changes the map's size. */
function relayout() {
  requestAnimationFrame(() => { if (Sky.isReady()) Sky.resize(); paint(); specPlot.draw(); lcPlot.draw(); });
}
function tourGo(i) {
  coachEnd();
  if (!tourSteps.length) tourSteps = buildTour(S.targets, T);
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
    b.type = 'button'; b.textContent = o.name;
    b.onclick = () => openKnown(o);
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
let sheetOpener = null;
function openSheet(id) {
  if (!SHEETS[id]) return;
  sheetOpener = document.activeElement;
  const wrap = $('sheetwrap'), sh = $('sheet');
  sh.innerHTML = `<button type="button" class="close" aria-label="${NAV ? G('Close') : 'Close'}">×</button>${SHEETS[id]()}`;
  sh.querySelector('.close').onclick = closeSheet;
  wrap.hidden = false; wrap.scrollTop = 0; sh.focus();
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
document.querySelectorAll('[data-sheet]').forEach(b => { b.onclick = () => { closeMenu(); openSheet(b.dataset.sheet); }; });
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
  return {
    full: [W, H],
    wide: narrow ? [W, Math.max(200, H - 300)] : [W, H],
    open: narrow ? [W, Math.max(170, Math.round(window.innerHeight * 0.26))] : [W - Math.min(0.62 * W, 1000), Math.max(240, H - 290)],
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
  for (const t of S.targets) { add(t.ra, t.dec, Sky.objectFov(t.size, open[0]), open); add(t.ra, t.dec, Sky.objectFov(t.size, wide[0]), wide); }
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
  for (const t of S.targets) {
    const d = t.view?.det || 2;
    files.push(dataUrl(t, `d${d}.ndjson`), dataUrl(t, 'gaia.json'));       // what each tour step shows first
    if (t.wikiCard?.thumb) files.push(t.wikiCard.thumb);
    if (t.wikiCard && Lang.locale !== 'en') Info.wikipediaIn(Lang.locale, t.wikiCard);          // asked once here, the encyclopedia card in the page's language is kept for offline use too
  }
  if (full) {
    for (const t of S.targets) for (let d = 1; d <= 6; d++) if (d !== (t.view?.det || 2)) files.push(dataUrl(t, `d${d}.ndjson`));
    for (const t of S.targets) files.push(dataUrl(t, 'catwise.json'));
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
  if (!tourSteps.length) tourSteps = buildTour(S.targets, T);          // the tour may not have been started yet
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
  const t = S.targets.find(x => x.slug === q.get('target'));
  if (t) return go({ ra: t.ra, dec: t.dec, size: t.size, target: t, info: t.info || null, ...(t.view || {}), ...(det ? { det } : {}), ...(mode ? { mode } : {}) });
  if (q.has('ra') && q.has('dec')) return go({ ra: +q.get('ra'), dec: +q.get('dec'), size: +(q.get('fov') || q.get('size') || 5), det, mode });
  if (q.has('tour')) tourGo(0);
  if (SHEETS[location.hash.slice(1)]) openSheet(location.hash.slice(1));
})();
