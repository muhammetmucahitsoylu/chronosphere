import * as C from './core.js';
import { Plot, dateTicks } from './plot.js';
import * as Sky from './sky.js';
import * as Info from './info.js';
import { buildTour } from './tour.js';
import { SHEETS } from './pages.js';
import * as Archive from './archive.js';

const API = (window.CHRONO_API || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isNarrow = () => window.matchMedia('(max-width: 900px)').matches;
const calmMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const yearNow = () => 1970 + Date.now() / 31557600000;

const MODES = {
  epochs: 'One stacked image per SPHEREx visit to this spot, played in a loop. Anything that moved between visits jumps.',
  frames: 'Every single exposure in time order. Each one sees the sky at a slightly different wavelength, so stars flicker naturally.',
  color: 'Time shown as colour: first visit in red, last in blue. Stars that stayed put look white; anything that moved or changed splits into colours.',
  diff: 'A later visit minus an earlier one. Steady stars cancel; a moving object leaves a dark-and-bright pair.',
  deep: 'All exposures of this detector added together: the deepest, cleanest image.',
  bands: 'The same patch of sky in each of the six detectors, from 0.75 to 5 microns, then all six as one colour picture (short wavelengths blue, long red). Cold objects only appear at the long end.',
};

const S = {
  targets: [], target: null, track: null, ra: 0, dec: 0, size: 5,
  head: null, grid: null, det: 2, dets: {}, mode: 'epochs',
  seq: [], idx: 0, playing: false, fps: 2, timer: null,
  sel: null, view: { z: 1, cx: 0, cy: 0 }, white: 0, invert: false, smooth: false, mask: false,
  showGaia: true, gaia: null, off: new Set(), abort: null, deep: null, hi: 1, gen: 0,
  info: null, infoState: 'idle', wiki: null, openTok: 0, showBands: true, embed: false,
};

const cv = $('sky'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'), octx = off.getContext('2d');
const specPlot = new Plot($('spec'), $('spec').nextElementSibling);
const lcPlot = new Plot($('lc'), $('lc').nextElementSibling);

// ------------------------------------------------------------ loading
const isPreset = () => !!(S.target && S.size === S.target.size);

// Finished live queries are kept on this device, so a repeat visit is instant and works offline.
const Store = {
  name: 'chrono-live-v1', max: 48,
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

async function go({ ra, dec, size, target = null, track = null, det, mode, info = null, fly = true }) {
  S.abort?.abort(); S.abort = new AbortController();
  const gen = ++S.gen;
  stop();
  Object.assign(S, { ra, dec, size: size || 5, target, track: track || (target && target.resolved) || null,
    head: null, grid: null, dets: {}, seq: [], idx: 0, sel: null, gaia: null, catwise: null, deep: null, off: new Set(), stacks: null, epochs: null, pts: [], bandCache: {}, haloDets: [] });
  S.info = info; S.infoState = info ? 'done' : 'loading'; S.wiki = null; S.found = null;
  S.wantPlay = !calmMotion();          // the sequence starts playing by itself once it has loaded
  if (det) S.det = det;
  if (mode && MODES[mode]) S.mode = mode;
  openPanel();
  if (Sky.isReady()) { Sky.mark(ra, dec, S.size, target ? target.label : info ? info.name : track?.name || ''); if (fly) Sky.flyTo(ra, dec, Math.max(3, S.size / 5)); }
  loadInfo(gen);
  $('fov').value = String(S.size);
  $('notice').hidden = true;
  syncUrl(); renderChips(); renderAbout(); renderModes(); renderDets(); paint(); refreshPlots();
  setStatus('Finding the exposures that cover this spot…');
  loadCatalog(gen);
  try {
    if (S.showWise) setTimeout(loadCatwise, 1500);
    await loadDet(S.det, gen);
    if (gen !== S.gen) return;
    if (!S.head || !S.head.total) return;
    for (let d = 1; d <= 6; d++) {
      if (gen !== S.gen) return;
      if (!S.dets[d] && +S.head.avail[d] > 0) await loadDet(d, gen);
    }
    if (gen === S.gen) { setStatus(''); maybeAutoplay(); }
  } catch (e) {
    if (e.name === 'AbortError' || gen !== S.gen) return;
    console.error(e);
    setStatus(S.target ? `Could not load data: ${e.message}` :
      'NASA\'s archive could not be reached just now. Check the connection and try again; objects you have already opened still work offline.');
  }
}

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
          if (!other) setStatus('SPHEREx has no public exposures at this position yet.');
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
    await C.loadStream(`data/${S.target.slug}/d${det}.ndjson`, handle, S.abort.signal);
  } else {
    const key = `${S.ra.toFixed(5)}_${S.dec.toFixed(5)}_${S.size}_${det}`;
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
    setStatus(D.done ? '' : `Loading detector ${det}: ${D.frames.length} of ${D.total} exposures`, D.done ? 0 : D.frames.length / Math.max(1, D.total));
    rebuild();
  } else if (S.mode === 'bands' && D.done) { rebuild();
  } else if (!S.dets[S.det]?.loading) {
    setStatus(D.done ? '' : `Loading detector ${det} for the spectrum: ${D.frames.length} of ${D.total}`, D.done ? 0 : D.frames.length / Math.max(1, D.total));
  }
  renderDets();
  refreshPlots();
  if (D.done) maybeAutoplay();
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
    if (isPreset()) js = await (await fetch(`data/${S.target.slug}/gaia.json`, { signal: S.abort.signal })).json();
    else if (API) js = await (await fetch(`${API}/api/catalog?ra=${S.ra.toFixed(5)}&dec=${S.dec.toFixed(5)}&size=${S.size}&cat=gaia`, { signal: S.abort.signal })).json();
    else js = await Info.fieldStars(S.ra, S.dec, S.size * 0.75 + 0.5);      // catalogued stars with known motion, from SIMBAD
    if (gen === S.gen && js) { S.gaia = js; paint(); }
  } catch { /* overlay is optional */ }
}
async function loadCatwise() {
  if (S.catwise || !S.grid) return;
  const gen = S.gen;
  try {
    if (!isPreset() && !API) { setStatus('The WISE overlay is available for the tour objects.'); return; }
    const url = isPreset() ? `data/${S.target.slug}/catwise.json`
      : `${API}/api/catalog?ra=${S.ra.toFixed(5)}&dec=${S.dec.toFixed(5)}&size=${S.size}&cat=catwise`;
    setStatus('Loading CatWISE sources…');
    const js = await (await fetch(url, { signal: S.abort.signal })).json();
    if (gen === S.gen) { S.catwise = js; setStatus(''); paint(); }
  } catch { setStatus('CatWISE overlay is not available right now.'); }
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
      title: `${S.head?.split ? '' : `Visit ${gEpoch(e.mid) + 1} · `}${C.fmtMonth(e.mid)}`, sub: `${e.frames.length} exposures · ${C.fmtRange(e.t0, e.t1)}` };
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
      title: 'Deep sum', sub: `${frames.length} exposures, all visits` }];
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
          n: fr.length, title: `${C.DET_BANDS[d][0]} to ${C.DET_BANDS[d][1]} µm`, sub: `${fr.length} exposures, all visits` };
      }
      per[d] = S.bandCache[d]; seq.push(per[d]);
    }
    const R = per[6] || per[5], G = per[4] || per[3], B = per[2] || per[1];
    if (R && G && B && R !== G && G !== B) seq.push({ kind: 'rgb', rgb: [R, G, B], mjd: G.mjd, det: 0, title: 'Infrared colour',
      sub: `blue D${B.det} · green D${G.det} · red D${R.det}` });
  } else if (S.mode === 'color') {
    if (stacks.length >= 2) {
      const a = stacks[0], b = stacks[stacks.length - 1], m = stacks.length > 2 ? stacks[stacks.length >> 1] : null;
      seq = [{ kind: 'rgb', rgb: [a, m, b], mjd: b.mjd, title: 'Time as colour',
        sub: m ? `red ${C.fmtMonth(a.mjd)} · green ${C.fmtMonth(m.mjd)} · blue ${C.fmtMonth(b.mjd)}` : `red ${C.fmtMonth(a.mjd)} · cyan ${C.fmtMonth(b.mjd)}` }];
    }
  } else if (S.mode === 'diff') {
    const pair = (a, b) => {
      const img = C.subtract(b.img, a.img);
      return { kind: 'diff', img, sig: C.robustStats(img).sig, mjd: b.mjd, title: `${C.fmtMonth(b.mjd)} minus ${C.fmtMonth(a.mjd)}`, sub: 'white = brighter later, black = brighter earlier' };
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
  renderMotion();
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
function trackPos(mjd) {
  const [ra, dec] = C.propagate({ ra: S.track.ra2000, dec: S.track.dec2000, pmra: S.track.pmra, pmdec: S.track.pmdec }, 2000, C.mjdToYear(mjd));
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
  // Gaia: circle at each star's catalogue position for this date; arrows for fast movers.
  if (S.showGaia && S.gaia) {
    for (const src of S.gaia.sources) {
      if (src.g > (S.view.z < 2 ? 16.5 : S.view.z < 4 ? 18.5 : 99)) continue;
      const [ra, dec] = C.propagate(src, S.gaia.epoch, year), [x, y] = C.skyToGrid(g, ra, dec);
      const [X, Y] = g2c(x, y, W, H, s);
      if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
      const pm = Math.hypot(src.pmra || 0, src.pmdec || 0);
      ctx.strokeStyle = pm > 150 ? '#ffd166' : '#4cc9f066';
      ctx.beginPath(); ctx.arc(X, Y, Math.max(3.5, 4 / g.scale * s), 0, 7); ctx.stroke();
      if (pm > 150) {   // arrow: motion over the next 5 years
        const [ra2, dec2] = C.propagate(src, S.gaia.epoch, year + 5), [x2, y2] = C.skyToGrid(g, ra2, dec2), [X2, Y2] = g2c(x2, y2, W, H, s);
        arrow(X, Y, X2, Y2, '#ffd166');
        ctx.fillStyle = '#ffd166'; ctx.fillText(`${(pm / 1000).toFixed(1)}″/yr`, X2 + 6, Y2 - 6);
      }
    }
  }
  // CatWISE: squares, so they read differently from Gaia circles.
  if (S.showWise && S.catwise) {
    ctx.strokeStyle = '#ff9f1c99';
    for (const src of S.catwise.sources) {
      if (src.w2 > (S.view.z < 2 ? 15.5 : 99)) continue;
      const [ra, dec] = C.propagate(src, S.catwise.epoch, year), [x, y] = C.skyToGrid(g, ra, dec), [X, Y] = g2c(x, y, W, H, s);
      if (X < -20 || Y < -20 || X > W + 20 || Y > H + 20) continue;
      const r = Math.max(4, 4.5 / g.scale * s);
      ctx.strokeRect(X - r, Y - r, 2 * r, 2 * r);
    }
  }
  // Predicted path of the tracked target across the SPHEREx seasons.
  if (S.track && S.head?.epochs?.length) {
    const eps = S.head.epochs;
    ctx.strokeStyle = '#ffffff66'; ctx.setLineDash([3, 3]); ctx.beginPath();
    const a = trackPos(eps[0][0] - 200), b = trackPos(eps[eps.length - 1][1] + 200);
    ctx.moveTo(...g2c(a[0], a[1], W, H, s)); ctx.lineTo(...g2c(b[0], b[1], W, H, s)); ctx.stroke(); ctx.setLineDash([]);
    eps.forEach((e, i) => {
      const p = trackPos((e[0] + e[1]) / 2), [X, Y] = g2c(p[0], p[1], W, H, s);
      ctx.fillStyle = C.EPOCH_COLORS[i % C.EPOCH_COLORS.length];
      ctx.beginPath(); ctx.arc(X, Y, 3, 0, 7); ctx.fill();
    });
  }
  // Measurement aperture.
  const p = selPos(it.mjd);
  if (p) {
    const [X, Y] = g2c(p[0], p[1], W, H, s), r = 9.2 / g.scale * s;
    ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#06d6a055'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(X, Y, 18 / g.scale * s, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(X, Y, 30 / g.scale * s, 0, 7); ctx.stroke();
  }
  // Compass and scale bar.
  const bar = niceBar(W * 0.25 * g.scale / s), bl = bar / g.scale * s, by = H - 34;
  ctx.strokeStyle = ctx.fillStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W - 14 - bl, by); ctx.lineTo(W - 14, by); ctx.stroke();
  ctx.textAlign = 'right'; ctx.fillText(bar >= 60 ? `${bar / 60}′` : `${bar}″`, W - 14, by - 6);
  ctx.lineWidth = 1.2; ctx.textAlign = 'center';
  const ox = W - 16, oy = 44;
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
      ? '<b>Needs two visits</b><span>SPHEREx has visited this spot only once with this detector so far.</span>'
      : `<b>No exposures</b><span>Detector ${S.det} has no data at this position.</span>`;
  }
  paint(); renderMeta(); markCurrent();
}
function step(d) { if (S.seq.length) { S.idx = (S.idx + d + S.seq.length) % S.seq.length; show(); } }
function play() {
  if (S.seq.length < 2) return;
  S.playing = true; $('play').textContent = '❚❚ Pause';
  clearInterval(S.timer); S.timer = setInterval(() => step(1), 1000 / S.fps);
}
function stop() { S.playing = false; $('play').textContent = '▶ Play'; clearInterval(S.timer); }

// ------------------------------------------------------------ photometry & plots
let plotTimer = 0;
function refreshPlots() { clearTimeout(plotTimer); plotTimer = setTimeout(drawPlots, 120); }
function measureAll() {
  if (!S.grid || !S.sel) return [];
  const n = S.grid.n, c = (n - 1) / 2, sc = S.grid.scale, pts = [];
  S.haloDets = [];
  for (let det = 1; det <= 6; det++) {
    const fr = usable(det); if (!fr.length) continue;
    const pos = fr.map(f => selPos(f.mjd));
    // Saturated star? Then the core is masked in most exposures: measure the halo instead, for all of them.
    const nSat = fr.reduce((k, f, i) => k + (C.coreMasked(f.data, n, sc, pos[i][0], pos[i][1]) > 0 ? 1 : 0), 0);
    const useHalo = nSat > 0.3 * fr.length;
    let ring = 21;
    if (useHalo) {
      S.haloDets.push(det);
      // Smallest ring that clears the saturated core in nearly every exposure of this detector.
      const sample = fr.filter((_, i) => i % Math.ceil(fr.length / 30) === 0);
      for (const r of [15, 21, 30, 42, 54]) {
        ring = r;
        const ok = sample.filter(f => { const p = selPos(f.mjd); return C.halo(f.data, n, sc, p[0], p[1], f.sig, r).valid >= 0.9; }).length;
        if (ok >= 0.8 * sample.length) break;
      }
    }
    fr.forEach((f, i) => {
      const p = pos[i];
      let a = useHalo ? C.halo(f.data, n, sc, p[0], p[1], f.sig, ring) : C.aperture(f.data, n, sc, p[0], p[1], f.sig);
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
    xlabel: 'wavelength (µm)', ylabel: relative ? 'relative brightness' : `flux (${unit})`, ylim: [ymin - (ymax - ymin) * 0.04, ymax > ymin ? ymax : ymin + 1],
    xlim: [0.7, 5.1], empty: S.sel ? 'Measuring…' : 'Click a star in the image',
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
    xTicks: dateTicks, empty: pts.length ? `Too faint (or saturated) in D${S.det} to measure changes` : 'Click a star in the image',
    tipText: p => `${C.fmtDate(p.x)} · ×${p.y.toFixed(2)} · ${p.src.lam.toFixed(2)} µm`,
    onPick: p => jumpTo(p.src),
  });
  renderMolecules(steadied(pts));
  $('lctitle').textContent = `Brightness over time · D${S.det} (${C.DET_BANDS[S.det].join('–')} µm)`;
  $('speclegend').innerHTML = (S.head?.epochs || []).map((e, i) => `<span><i style="background:${C.EPOCH_COLORS[i % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((e[0] + e[1]) / 2)}</span>`).join('');
  const loadingMore = !!S.head && [1, 2, 3, 4, 5, 6].some(d => +S.head.avail[d] > 0 && !S.dets[d]?.done);
  const haloNote = !S.haloDets?.length ? ''
    : relative ? `<b>Too bright for the camera in ${loadingMore ? 'the detectors loaded so far' : 'every detector'}.</b> The star's core is saturated, so it is measured from its faint outer glow instead (hollow points). The scale is relative${loadingMore ? ' until the other detectors arrive' : ''}; the changes over time are real. `
      : `<b>Too bright for the camera in ${S.haloDets.map(d => 'D' + d).join(', ')}.</b> There the star's core is saturated, so it is measured from its faint outer glow and each detector is scaled to join its neighbour (hollow points). The overall shape is right; the level and the fine detail are approximate. `;
  $('specnote').innerHTML = `${haloNote}Every exposure sees the spot at a different wavelength, so stepping through time builds a spectrum (${pts.length} measurements so far). Click a point to jump to that exposure. Measured in a circle of 9″ radius, which reads roughly 10 to 15% low because some starlight falls outside it.`;
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
  if (!S.showBands || pts.length < 30) { el.innerHTML = ''; return; }
  const rowsData = C.bandDepths(pts);
  const rows = rowsData.map(m => {
    let cls = 'none', txt = m.why || 'not enough data';
    if (m.depth !== null) {
      const pc = Math.round(Math.abs(m.depth) * 100), sure = Math.abs(m.depth) > 4 * m.err;
      if (m.depth > 0.12 && sure) { cls = 'dip'; txt = `${pc}% dip`; }
      else if (m.depth < -0.12 && sure) { cls = 'peak'; txt = `${pc}% bump`; }
      else txt = 'flat';
    }
    return `<tr><td>${m.name} <span class="none">${m.f}</span></td><td>${m.band[0].toFixed(2)}–${m.band[1].toFixed(2)}</td><td class="${cls}">${txt}</td></tr>`;
  }).join('');
  if (rowsData.every(m => m.depth === null)) {
    el.innerHTML = `<p class="hint">Molecule bands cannot be measured here: ${rowsData.some(m => m.why === 'star too bright to tell') ? 'the star is too bright for the camera' : rowsData.some(m => m.why === 'too faint to tell') ? 'the spot is too faint' : rowsData.some(m => m.why === 'too uneven to tell') ? 'the measurements scatter too much' : 'there are not enough measurements yet'}.</p>`;
    return;
  }
  el.innerHTML = `<table class="t mol"><thead><tr><th>Molecule</th><th>Band, µm</th><th>Measured</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">How much fainter the spot is inside each band than just outside it. A dip is a hint that the molecule is there, not proof.</p>`;
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
    // Bright enough to be measured to better than about 8% in a single exposure.
    const a = C.aperture(img, n, g.scale, i, j, noise);
    if (a && a.flux > 12 * a.err) peaks.push({ x: i, y: j, v: a.flux });
  }
  peaks.sort((a, b) => b.v - a.v);
  const eps = S.head?.epochs || [];
  const mine = S.sel?.follow && S.track ? eps.map(e => trackPos((e[0] + e[1]) / 2)) : S.sel ? [[S.sel.x, S.sel.y]] : [];
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
  if (!S.grid || visits.length < 2) { el.innerHTML = ''; return null; }
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
  const pc = v => `${Math.round(v * 100)}%`;
  const stars = `${comps.length} ordinary star${comps.length === 1 ? '' : 's'}`;
  let verdict, word = 'none';
  if (sn < 5) verdict = `The spot is too faint in D${S.det} to check for changes: one exposure measures it only to about ${pc(Math.min(1, 1 / Math.max(sn, 1)))}. Try a detector where it is brighter.`;
  else if (steady == null) verdict = relative
    ? `A change of ${pc(change)} between visits. It cannot be checked against other stars here: next to a star this bright, every faint neighbour sits in its glow.`
    : `A change of ${pc(change)} between visits. There are not enough ordinary stars in this small field to check it against.`;
  else if (change >= Math.max(3 * steady, 0.08) && sig >= 5) { word = 'real'; verdict = `<b>The change is real.</b> The spot ${biggest.rel > 1 ? 'brightened' : 'faded'} by ${pc(change)} between visits in D${S.det}, while ${stars} in the same images stayed constant to within ${pc(steady)}.`; }
  else if (change >= Math.max(2 * steady, 0.04) && sig >= 3) { word = 'maybe'; verdict = `Possibly changing: ${pc(change)} between visits in D${S.det}, against ${pc(steady)} for ${stars} in the same images. Worth a closer look.`; }
  else { word = 'steady'; verdict = `<b>No significant change.</b> Between visits the spot differs by ${pc(change)} in D${S.det}; ${stars} in the same images differ by up to ${pc(steady)}.`; }
  const rows = visits.length <= 6 ? `<table class="t"><thead><tr><th>${S.head.split ? 'Month' : 'Visit'}</th><th>This spot</th><th>Ordinary stars</th></tr></thead><tbody>${target.map((t, i) =>
    `<tr><td><i style="background:${C.EPOCH_COLORS[t.k % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((eps[t.k][0] + eps[t.k][1]) / 2)}</td><td>${i ? `×${t.rel.toFixed(2)}` : 'reference'}</td><td>${i ? (steadyAt(i) == null ? '–' : `within ${pc(steadyAt(i))}`) : ''}</td></tr>`).join('')}</tbody></table>` : '';
  el.innerHTML = `${sn >= 5 ? rows : ''}<p class="hint verdict">${verdict}${steady != null && sn >= 5 ? ' The grey band in the plot is that steadiness.' : ''}</p>`;
  return { steady: sn >= 5 ? steady : null, comps: comps.length, word };
}

// ------------------------------------------------------------ side panels
function renderChips() {
  const el = $('examples'); el.innerHTML = '';
  for (const t of S.targets) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t.label; b.onclick = () => openTarget(t);
    el.appendChild(b);
  }
  $('suggest').innerHTML = [...S.targets.map(t => t.label), 'Proxima Centauri', 'Betelgeuse', 'Vega', 'Sirius', 'Andromeda Galaxy', 'Orion Nebula', 'Pleiades']
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
  S.abort?.abort(); S.gen++; stop();
  $('app').dataset.panel = 'closed';
  if (Sky.isReady()) { Sky.clearMark(); Sky.resize(); }
  history.replaceState(null, '', location.pathname);
}

/** Find out what the selected spot is, then look for an encyclopedia card. */
async function loadInfo(gen) {
  try {
    if (!S.info) {
      S.info = await Info.identify(S.ra, S.dec, 10).catch(() => null);
      if (gen !== S.gen) return;
      if (S.info && !S.target && Sky.isReady()) Sky.mark(S.ra, S.dec, S.size, S.info.name);      // now the marker can carry its name
    }
    S.infoState = 'done'; renderAbout();
    if (S.target && 'info' in S.target) { S.wiki = S.target.wikiCard || null; renderAbout(); return; }      // baked in: no look-up needed
    const titles = [];
    if (S.target?.wiki) titles.push(S.target.wiki);
    if (S.info) titles.push(...Info.wikiTitles([S.info.mainId, ...(await Info.aliases(S.info.oid))]));
    if (gen !== S.gen || !titles.length) return;
    S.wiki = await Info.wikipedia(titles);
    if (gen === S.gen && S.wiki) renderAbout();
  } catch { S.infoState = 'done'; if (gen === S.gen) renderAbout(); }
}

/** Light-years from a parallax in milliarcseconds, rounded to what the measurement supports. */
function fmtDistance(plx, err) {
  const ly = 3261.5638 / plx, rel = err != null ? err / plx : 0.01;
  const v = Number(ly.toPrecision(rel < 0.003 ? 3 : 2));
  return `${rel < 0.003 ? '' : 'about '}${v.toLocaleString('en', { maximumFractionDigits: 2 })} light-years`;
}

function renderAbout() {
  const t = S.target, k = S.track, i = S.info, el = $('about');
  const name = t ? t.label : i ? i.name : k?.name ? k.name : 'Uncatalogued spot';
  const sp = t?.sp || i?.sptype;
  const spHtml = sp ? ` · spectral type <span class="asis">${esc(sp)}</span>` : '';
  const kind = t?.type ? `${esc(t.type)}${spHtml}` : i ? `${esc(i.type)}${spHtml}`
    : S.infoState === 'loading' ? 'Identifying…' : 'Nothing catalogued at this spot';
  const gloss = t ? t.blurb : i ? Info.gloss(i.otype) : S.infoState === 'done' ? 'No catalogue lists an object exactly here. SPHEREx still has images of this patch: what do you see?' : '';
  const facts = [];
  const fact = (label, value, small, title) => facts.push(`<div${title ? ` title="${esc(title)}"` : ''}><dt>${label}</dt><dd>${value}${small ? `<small>${small}</small>` : ''}</dd></div>`);

  // Motion on the sky. Curated values first, then what the look-up returned.
  const pmSrc = t?.pm || (i && i.pmra != null ? i : k && k.pmra != null ? k : null);
  const pm = pmSrc ? Math.hypot(pmSrc.pmra, pmSrc.pmdec) / 1000 : 0;          // arcseconds per year
  const fast = pm > 0.2;
  const [sra, sdec] = C.fmtSex(S.ra, S.dec).split(' ');
  fact(fast ? 'Position today' : 'Position', `${sra}<br>${sdec}`,
    fast ? `${(pm * (yearNow() - 2000)).toFixed(0)}″ from its year-2000 place` : `${S.ra.toFixed(5)}°, ${S.dec >= 0 ? '+' : ''}${S.dec.toFixed(5)}°`,
    fast ? 'Catalogues list where a star was in the year 2000. This one has moved since; the position shown is for today.' : 'Right ascension and declination (ICRS)');
  if (pmSrc) {
    fact('Moves across the sky', `${pm.toFixed(pm < 0.1 ? 3 : 2)}″ per year`,
      pm >= 0.3 ? `${(pm / 6.15).toFixed(2)} SPHEREx pixels a year` : pm > 0.003 ? `one SPHEREx pixel in ${Math.round(6.15 / pm).toLocaleString('en')} years` : 'too slow to see here',
      `Proper motion${pmSrc.src ? `, ${pmSrc.src}` : ', from SIMBAD'}`);
  }
  // Distance: only from a parallax measured to better than 20%.
  const plx = t?.dist?.plx ?? i?.plx ?? k?.plx, plxErr = t?.dist?.err ?? (i?.plx != null ? i.plxErr : null);
  if (plx > 0 && (plxErr != null ? plx / plxErr >= 5 : plx > 5)) {
    fact('Distance', fmtDistance(plx, plxErr), t?.dist?.src || 'from its parallax',
      `Parallax ${plx} ${plxErr != null ? `± ${plxErr} ` : ''}milliarcseconds`);
  }
  if (i?.redshift > 0.002) fact('Redshift', i.redshift.toFixed(4), 'its light is stretched by the expanding universe');
  if (S.head) {
    const eps = S.head.epochs, split = !!S.head.split;
    fact('SPHEREx has', `${S.head.estimated ? 'about ' : ''}${S.head.total.toLocaleString('en')} exposures`,
      `${eps.length} ${split ? 'time slice' : 'visit'}${eps.length === 1 ? '' : 's'}, ${C.fmtMonth(eps[0]?.[0] ?? 0)} to ${C.fmtMonth(eps.at(-1)?.[1] ?? 0)}`);
  }
  const w = S.wiki;
  const thumb = w?.thumb ? `<a class="thumb" href="${esc(w.url)}" target="_blank" rel="noopener" title="Wikipedia: ${esc(w.title)}"><img src="${esc(w.thumb)}" alt="${esc(w.title)}, image from Wikipedia" loading="lazy"></a>` : '';
  const links = [...(w ? [{ label: 'Wikipedia', title: `Encyclopedia article: ${w.title}`, url: w.url }] : []), ...Info.externalLinks(S.ra, S.dec, i)]
    .map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.title)}">${l.label}</a>`).join('');
  el.innerHTML = `<div class="toprow">
      <div class="idblock"><p class="kind">${kind}</p><h1>${esc(name)}</h1>${gloss ? `<p class="gloss">${esc(gloss)}</p>` : ''}</div>
      ${thumb}<button type="button" class="close" id="closepanel" title="Close and return to the map" aria-label="Close">×</button>
    </div>
    <dl class="facts">${facts.join('')}</dl>
    <div class="links"><span>Check it in</span>${links}</div>`;
  $('closepanel').onclick = closePanel;
  renderLook(); renderWiki(); renderMotion();
}
/** Guidance for the showcase objects. The guided tour says the same thing in its own card. */
function renderLook() {
  const t = S.target, show = !!t?.look && tourIdx < 0 && !S.embed;
  $('lookbox').innerHTML = show ? `<p class="look"><b>What to look for</b>${esc(t.look)}</p>` : '';
  document.querySelector('.cols').classList.toggle('nolook', !show);
}
function renderWiki() {
  const w = S.wiki, i = S.info, el = $('wikibox');
  const mags = i ? ['V', 'J', 'K'].filter(b => i.mags?.[b] != null).map(b => `${b} ${(+i.mags[b]).toFixed(1)}`) : [];
  const others = (mags.length > 1 ? `<p class="others" title="V is visible light; J (1.2 µm) and K (2.2 µm) are near-infrared">Catalogued brightness (SIMBAD): magnitude ${mags.join(', ')}. Lower numbers are brighter.</p>` : '')
    + (i?.others?.length ? `<p class="others">Also catalogued at this position: ${i.others.map(o => `${esc(o.name)} (${esc(o.type)})`).join(', ')}</p>` : '');
  el.hidden = !w && !others;
  el.innerHTML = `${w ? `<h2>From Wikipedia</h2><div class="wiki">${w.thumb ? `<img src="${esc(w.thumb)}" alt="" loading="lazy">` : ''}<div><p>${esc(w.extract)}</p><small><a href="${esc(w.url)}" target="_blank" rel="noopener">Read the article: ${esc(w.title)}</a></small></div></div>` : ''}${others}`;
}
/** Measured position per season versus the catalogue prediction. */
function renderMotion() {
  const el = $('motion');
  if (!el) return;
  if (!S.grid || !S.track || S.track.pmra == null || !S.stacks || S.stacks.length < 2) { el.innerHTML = ''; return; }
  const g = S.grid, rows = [];
  let m0 = null, p0 = null;
  for (const st of S.stacks) {
    const p = trackPos(st.mjd);
    let m = C.centroid(st.img, g.n, p[0], p[1], 3);
    if (m && !(m.peak > 4 * st.sig)) m = null;          // not significantly above the noise
    if (!m0 && m) { m0 = m; p0 = p; }
    rows.push({ st, p, m });
  }
  const as = v => (v * g.scale).toFixed(1);
  if (Math.hypot(S.track.pmra, S.track.pmdec) < 100 && (!m0 || rows.filter(r => r.m).length < 2)) { el.innerHTML = ''; return; }
  if (!m0) { el.innerHTML = '<p class="hint">The target is not detected in this detector, so its motion cannot be measured here. Try another detector.</p>'; return; }
  if (Math.hypot(S.track.pmra, S.track.pmdec) < 100) {
    const worst = Math.max(...rows.filter(r => r.m).map(r => Math.hypot(r.m.x - m0.x, r.m.y - m0.y)));
    el.innerHTML = `<p class="hint">This star does not move measurably on the sky. Its measured position changes by at most ${as(worst)}″ between visits in D${S.det}: that is how well the images are aligned (1 SPHEREx pixel = 6.15″).</p>`;
    return;
  }
  const body = rows.map(({ st, p, m }) => {
    const pe = -(p[0] - p0[0]), pn = p[1] - p0[1];
    if (!m) return `<tr><td>${C.fmtMonth(st.mjd)}</td><td colspan="3">not detected</td></tr>`;
    const me = -(m.x - m0.x), mn = m.y - m0.y, d = Math.hypot(me - pe, mn - pn);
    return `<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${epochColor(st.mjd)};margin-right:5px"></i>${C.fmtMonth(st.mjd)}</td><td>${as(Math.hypot(me, mn))}″</td><td>${as(Math.hypot(pe, pn))}″</td><td>${as(d)}″</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="t"><thead><tr><th>Visit</th><th>Measured</th><th>Predicted</th><th>Off by</th></tr></thead><tbody>${body}</tbody></table>
  <p class="hint">How far it has moved since the first visit: measured in these D${S.det} images, and predicted from its catalogued motion. One SPHEREx pixel is 6.15″.</p>`;
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
    b.title = `Detector ${d}: ${a} to ${z} microns${avail ? `, ${avail} exposures` : avail === 0 ? ', no exposures here' : ''}`;
    b.onclick = () => { S.det = d; renderDets(); rebuild(); refreshPlots(); syncUrl(); if (!S.dets[d]) setStatus(`Detector ${d} is still loading…`); };
    el.appendChild(b);
  }
  const D = S.dets[S.det], [a, z] = C.DET_BANDS[S.det];
  const n = D ? (D.loading ? `loading ${D.frames.length} of ${D.total || '…'} exposures` : `${D.frames.length} exposures`) : S.head ? `${S.head.avail[S.det]} exposures` : '';
  $('detnote').textContent = `Detector ${S.det}: ${a} to ${z} µm${n ? ` · ${n}` : ''}. Pick a wavelength band above.`;
}
function renderReleases() {
  const el = $('releases'); el.innerHTML = '';
  for (const [name, n] of Object.entries(S.head.releases).sort()) {
    const lab = document.createElement('label'), cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !S.off.has(name);
    cb.onchange = () => { cb.checked ? S.off.delete(name) : S.off.add(name); rebuild(); refreshPlots(); };
    lab.append(cb, ` ${name} `, Object.assign(document.createElement('span'), { className: 'hint', textContent: `${n} exposures` }));
    el.appendChild(lab);
  }
}
function renderMeta() {
  const it = S.seq[S.idx], el = $('meta');
  if (!it) { el.innerHTML = ''; return; }
  const rows = [];
  const add = (k, v) => rows.push(`<dt>${k}</dt><dd>${v}</dd>`);
  if (it.frame) {
    const f = it.frame;
    add('Date', `${C.fmtDate(f.mjd, true)} (MJD ${f.mjd.toFixed(4)})`);
    add('Wavelength', `${lamAt(f).toFixed(4)} µm at the circle, bandwidth ${f.bw.toFixed(3)} µm`);
    add('Detector', `D${f.det} (${C.DET_BANDS[f.det].join('–')} µm)`);
    add('Release', f.coll);
    add('Exposure', `${f.id}${f.exp ? `, ${f.exp.toFixed(0)} s` : ''}`);
    add('Detector pixel', `x ${f.px[0]}, y ${f.px[1]}`);
    add('Sky level removed', `${f.bg.toFixed(3)} MJy/sr`);
    add('Noise (1σ)', `${f.sig.toFixed(3)} MJy/sr`);
    add('Coverage', `${Math.round(f.cov * 100)}% of the field`);
    add('PSF width', `${f.fwhm}″`);
    add('Source file', `<a href="${f.url}" target="_blank" rel="noopener">FITS at IRSA</a>`);
  } else {
    add('Image', it.title);
    add('Built from', it.sub);
    if (it.det !== 0) { const d = it.det || S.det; add('Detector', `D${d} (${C.DET_BANDS[d].join('–')} µm)`); }
    if (it.sig) add('Noise (1σ)', `${it.sig.toFixed(3)} MJy/sr`);
    if (it.ep) add('Releases', [...new Set(it.ep.frames.map(f => f.coll))].join(', '));
  }
  if (S.grid) add('Pixel scale', `${S.grid.scale.toFixed(2)}″ (resampled, north up, east left)`);
  el.innerHTML = rows.join('');
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
    const year = 1970 + Date.now() / 31557600000;
    [r.ra, r.dec] = C.propagate({ ra, dec, pmra: r.pmra, pmdec: r.pmdec }, 2000, year);
    return r;
  };
  // The CDS name resolver and its mirror at Harvard; then SIMBAD itself, which knows exact identifiers.
  for (const base of ['https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?', 'https://vizier.cfa.harvard.edu/viz-bin/nph-sesame/-oxp/SNV?']) {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(base + encodeURIComponent(name), { signal: ctl.signal });
      clearTimeout(timer);
      if (r.ok) { const v = parse(await r.text()); if (v) return v; }
    } catch { /* try the next one */ }
  }
  if (API) {
    try { const r = await fetch(`${API}/api/resolve?q=${encodeURIComponent(name)}`); if (r.ok) return await r.json(); } catch { /* fall through */ }
  }
  return Info.byName(name).catch(() => null);
}
const sepArcsec = (ra1, dec1, ra2, dec2) => Math.hypot((ra1 - ra2) * Math.cos(dec1 * Math.PI / 180), dec1 - dec2) * 3600;

async function search(text) {
  text = text.trim();
  if (!text) return;
  const size = +$('fov').value;
  const co = C.parseCoords(text);
  if (co) {
    await go({ ...co, size });
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
        el.innerHTML = `These look like older coordinates of <b>${t.label}</b>. It has since moved ${(here / 60).toFixed(1)}′ from here.<br><button type="button">Jump to where it is now</button>`;
        el.hidden = false;
        el.querySelector('button').onclick = () => openTarget(t);
      }
    }
    return;
  }
  const q = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const preset = S.targets.find(t => [t.label, t.slug, t.query].some(s => { const v = s.toLowerCase().replace(/[^a-z0-9]/g, ''); return v.includes(q) || q.includes(v); }));
  if (preset && size === preset.size) return openTarget(preset);
  note(`Looking up “${text}”…`);
  const r = await resolveName(text).catch(() => null);
  if (!r) { note(`Could not find “${text}”. Try coordinates, for example 269.446 4.771`, 6000); return; }
  note('');
  go({ ra: r.ra, dec: r.dec, size, track: r, target: preset || null });
}

/** A click on the map: work out what is there today and open it. */
async function openAt(ra, dec, mapFov) {
  if (mapFov > 12) {                       // too far out to mean one object: dive in first
    note('Zooming in. Pick an object when you are closer.', 3500);
    Sky.flyTo(ra, dec, Math.max(mapFov / 6, 2));
    return;
  }
  const tok = ++S.openTok, r = clamp(mapFov * 3600 * 0.006, 8, 60), size = +$('fov').value;
  const preset = S.targets.find(t => sepArcsec(ra, dec, t.ra, t.dec) < Math.max(20, r));
  if (preset && size === preset.size) return openTarget(preset);
  note('Looking up what is here…');
  const info = await Info.identify(ra, dec, r).catch(() => null);
  if (tok !== S.openTok) return;
  note('');
  if (info) go({ ra: info.ra, dec: info.dec, size, track: info, info });
  else go({ ra, dec, size });
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
$('bandsOn').onchange = e => { S.showBands = e.target.checked; drawPlots(); };

$('wise').onchange = e => { S.showWise = e.target.checked; if (S.showWise) loadCatwise(); paint(); };
$('mask').onchange = e => { S.mask = e.target.checked; paint(); };
$('resetview').onclick = () => { resetView(); paint(); };
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (tourIdx >= 0 && (e.key === 'PageDown' || e.key === 'n')) { e.preventDefault(); return tourGo(tourIdx + 1); }
  if (tourIdx >= 0 && (e.key === 'PageUp' || e.key === 'b')) { e.preventDefault(); return tourGo(tourIdx - 1); }
  if (!$('sheetwrap').hidden && e.key === 'Escape') return closeSheet();
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
  if (S.track && it) { const t = trackPos(it.mjd); if (Math.hypot(t[0] - gx, t[1] - gy) < 3) { S.sel = { follow: true }; paint(); refreshPlots(); return; } }
  const img = it && it.img ? it.img : S.deep;
  const hit = img && C.centroid(img, S.grid.n, gx, gy, 2.5);
  S.sel = hit ? { x: hit.x, y: hit.y } : { x: gx, y: gy };
  paint(); renderMeta(); refreshPlots();
}

// ------------------------------------------------------------ map controls
let sweepTimer = 0;
function setWave(z) {
  z = Sky.setSlice(z);
  $('wave').value = z;
  $('wavelabel').textContent = `${Sky.waves()[z].toFixed(2)} µm`;
}
function sweep(on) {
  clearInterval(sweepTimer); sweepTimer = 0;
  $('waveplay').textContent = on ? '❚❚' : '▶';
  if (on) sweepTimer = setInterval(() => setWave((Sky.currentSlice() + 1) % Sky.waves().length), 450);
}
function setLayer(id) {
  Sky.setLayer(id); $('layer').value = id;
  $('wavebox').style.display = id === 'spherex' ? '' : 'none';
  if (id !== 'spherex') sweep(false);
}

// ------------------------------------------------------------ guided tour
let tourSteps = [], tourIdx = -1;
const tourApi = {
  closePanel: () => { if ($('app').dataset.panel === 'open') closePanel(); },
  layer: id => { if (Sky.isReady() && Sky.currentLayer() !== id) setLayer(id); },
  slice: z => { if (Sky.isReady()) setWave(z); },
  sweep: on => { if (Sky.isReady()) sweep(on); },
  fly: (ra, dec, fov) => { if (Sky.isReady()) Sky.flyTo(ra, dec, Sky.fitFov(fov)); },
  open: t => openTarget(t),
};
/** The tour card docks under the map or floats over it, which changes the map's size. */
function relayout() {
  requestAnimationFrame(() => { if (Sky.isReady()) Sky.resize(); paint(); specPlot.draw(); lcPlot.draw(); });
}
function tourGo(i) {
  if (!tourSteps.length) tourSteps = buildTour(S.targets);
  if (i < 0) return;
  if (i >= tourSteps.length) return tourEnd();
  tourIdx = i;
  const st = tourSteps[i];
  document.body.classList.add('touring');
  $('welcome').hidden = true; $('tour').hidden = false;
  $('tourcount').textContent = `Guided tour · ${i + 1} of ${tourSteps.length}`;
  $('tourmini').textContent = `${i + 1} / ${tourSteps.length}`;
  $('tourprog').style.width = `${(i + 1) / tourSteps.length * 100}%`;
  $('tourtitle').textContent = st.title; $('tourtext').textContent = st.text;
  $('tourback').disabled = i === 0;
  $('tournext').textContent = i === tourSteps.length - 1 ? 'Finish' : 'Next';
  st.run(tourApi);
  renderLook(); relayout();
  if (isNarrow()) window.scrollTo({ top: 0, behavior: calmMotion() ? 'auto' : 'smooth' });
}
function tourEnd() {
  tourIdx = -1; $('tour').hidden = true; document.body.classList.remove('touring');
  sweep(false); renderLook(); relayout();
}
$('tourbtn').onclick = $('tourbtn2').onclick = () => tourGo(0);
$('tournext').onclick = () => tourGo(tourIdx + 1);
$('tourback').onclick = () => tourGo(tourIdx - 1);
$('tourclose').onclick = tourEnd;
$('hidewelcome').onclick = () => { $('welcome').hidden = true; };

// ------------------------------------------------------------ article sheets
function openSheet(id) {
  if (!SHEETS[id]) return;
  const wrap = $('sheetwrap'), sh = $('sheet');
  sh.innerHTML = `<button type="button" class="close" aria-label="Close">×</button>${SHEETS[id]()}`;
  sh.querySelector('.close').onclick = closeSheet;
  wrap.hidden = false; wrap.scrollTop = 0; sh.focus();
}
function closeSheet() { $('sheetwrap').hidden = true; }
$('sheetwrap').addEventListener('click', e => { if (e.target === $('sheetwrap')) closeSheet(); });
document.querySelectorAll('[data-sheet]').forEach(b => { b.onclick = () => { closeMenu(); openSheet(b.dataset.sheet); }; });
function closeMenu() { $('nav').classList.remove('open'); $('menubtn').setAttribute('aria-expanded', 'false'); }
$('menubtn').onclick = () => { const open = $('nav').classList.toggle('open'); $('menubtn').setAttribute('aria-expanded', String(open)); };
document.addEventListener('click', e => { if (!e.target.closest('#nav')) closeMenu(); });
$('zoomin').onclick = () => Sky.zoomBy(0.5);
$('zoomout').onclick = () => Sky.zoomBy(2);
// Phones: the map fills what is left under the header, whatever its height.
const setTopH = () => document.documentElement.style.setProperty('--toph', `${$('top').offsetHeight}px`);
new ResizeObserver(setTopH).observe($('top')); setTopH();
// A library request that fails while offline must not surface as an error.
window.addEventListener('unhandledrejection', e => { if (/Failed to fetch|NetworkError|Load failed/i.test(String(e.reason?.message || e.reason))) e.preventDefault(); });
$('wave').oninput = e => { sweep(false); setWave(+e.target.value); };
$('waveplay').onclick = () => sweep(!sweepTimer);
$('layer').onchange = e => setLayer(e.target.value);

// ------------------------------------------------------------ offline
/** Save everything the guided tour needs on this device, quietly, one file at a time. */
async function saveTourOffline() {
  if (!('caches' in window) || navigator.connection?.saveData) return;
  const files = [];
  for (const t of S.targets) {
    const d = t.view?.det || 2;
    files.push(`data/${t.slug}/d${d}.ndjson`, `data/${t.slug}/gaia.json`);       // what each tour step shows first
    if (t.wikiCard?.thumb) files.push(t.wikiCard.thumb);
  }
  for (const t of S.targets) for (let d = 1; d <= 6; d++) if (d !== (t.view?.det || 2)) files.push(`data/${t.slug}/d${d}.ndjson`);
  let done = 0;
  const el = $('offline');
  for (const f of files) {
    try { const r = await fetch(f, { priority: 'low' }); if (r.ok) await r.arrayBuffer(); } catch { /* try again next visit */ }
    done++;
    if (el) el.textContent = done < files.length ? `Saving the tour for offline use: ${Math.round(done / files.length * 100)}%` : 'The guided tour is saved on this device and works offline.';
  }
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => setTimeout(saveTourOffline, 2500)).catch(() => {});
}

// ------------------------------------------------------------ start
(async function init() {
  const q = new URLSearchParams(location.search);
  S.embed = q.has('embed');
  if (q.has('debug')) window.__app = { S, C, findComparisons, usable, gEpoch };      // for inspection from the console
  if (S.embed) document.body.classList.add('embed');
  renderModes(); renderDets();
  try { S.targets = await (await fetch('data/targets.json')).json(); } catch { S.targets = []; }
  renderChips();
  $('layer').innerHTML = Sky.LAYERS.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  if (!S.embed) {
    try {
      await Sky.init('#map', { onClick: openAt, onFov: f => { $('fovlabel').textContent = f >= 10 ? `${Math.round(f)}°` : f >= 1 ? `${f.toFixed(1)}°` : `${Math.round(f * 60)}′`; } });
      setWave(25);
    } catch (e) {
      console.error(e);
      $('welcome').innerHTML = '<h1>The sky map could not start here.</h1><p class="lede">It needs WebGL 2. Search still works, and so does the guided tour.</p>';
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
