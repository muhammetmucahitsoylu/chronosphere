// The explorable sky: Aladin Lite showing the SPHEREx all-sky cube served by NASA/IPAC (IRSA).

import A from '../vendor/aladin.js';
import { tileUrl, tilesInView, orderFor } from './healpix.js';

const IRSA_HIPS = 'https://irsa.ipac.caltech.edu/data/hips';
export const LAYERS = [
  { id: 'spherex', label: 'SPHEREx all-sky, 102 bands', url: `${IRSA_HIPS}/SPHEREx/spherex_allsky_cube`, cube: true },
  { id: '2mass', label: '2MASS colour (1.2 to 2.2 µm)', url: `${IRSA_HIPS}/CDS/2MASS/Color` },
  { id: 'wise', label: 'WISE colour (3.4 to 22 µm)', url: `${IRSA_HIPS}/CDS/AllWISE/RGB-W4-W2-W1` },
  { id: 'dss', label: 'Visible light (DSS)', url: `${IRSA_HIPS}/CDS/DSS2/color` },
];

// Central wavelength (µm) of each frame of the SPHEREx cube; refreshed from the archive at start-up.
let WAVES = [0.753, 0.771, 0.790, 0.809, 0.828, 0.848, 0.868, 0.889, 0.910, 0.932, 0.955, 0.978, 1.001, 1.025, 1.050, 1.075, 1.102, 1.113, 1.139, 1.167, 1.195, 1.224, 1.254, 1.284, 1.315, 1.346, 1.378, 1.412, 1.446, 1.481, 1.517, 1.554, 1.592, 1.631, 1.656, 1.695, 1.735, 1.775, 1.818, 1.861, 1.905, 1.949, 1.995, 2.041, 2.089, 2.139, 2.189, 2.240, 2.292, 2.345, 2.399, 2.445, 2.506, 2.575, 2.646, 2.719, 2.794, 2.871, 2.951, 3.033, 3.118, 3.204, 3.293, 3.383, 3.476, 3.570, 3.667, 3.768, 3.833, 3.867, 3.901, 3.935, 3.970, 4.005, 4.040, 4.076, 4.112, 4.148, 4.184, 4.220, 4.257, 4.294, 4.331, 4.368, 4.405, 4.435, 4.467, 4.500, 4.533, 4.566, 4.600, 4.635, 4.669, 4.704, 4.739, 4.773, 4.808, 4.843, 4.879, 4.915, 4.951, 4.988];
let BLANK = new Set([50, 51]);       // dichroic channels, empty in the cube

let al = null, overlay = null, tag = null, host = null, fovCb = null, layerId = 'spherex', slice = 25, shown = 25, ready = false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const nap = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(r));
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sepDeg = (ra1, dec1, ra2, dec2) => {
  const r = Math.PI / 180, s = Math.sin(dec1 * r) * Math.sin(dec2 * r) + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(clamp(s, -1, 1)) / r;
};

export const waves = () => WAVES;
export const isReady = () => ready;
export const currentSlice = () => slice;
export const currentLayer = () => layerId;
export const isSpherex = () => layerId === 'spherex';
export const isBlank = z => BLANK.has(z);

/** On a tall, narrow screen a very wide view would show the edge of the celestial sphere: narrow it. */
export function fitFov(fov, w = host?.clientWidth, h = host?.clientHeight) {
  if (!w || !h || fov < 30) return fov;
  // The sky is drawn as a globe seen from far away; keep the corners of the view inside its disc.
  return Math.min(fov, 2 * Math.asin(0.8 / Math.hypot(1, h / w)) * 180 / Math.PI);
}
/**
 * Addresses of the SPHEREx map tiles that a view needs: centre and width in degrees, frame of the
 * cube, size of the map in pixels. With no arguments: what is on screen now.
 */
export function tiles({ ra, dec, fov, z = slice, w, h, coarse = false } = {}) {
  if (!host || BLANK.has(z)) return [];
  if (ra === undefined) { if (!al) return []; [ra, dec] = al.getRaDec(); fov = al.getFov()[0]; }
  const W = w || host.clientWidth, H = h || host.clientHeight, cells = tilesInView(ra, dec, fov, W, H, MAX_ORDER);
  // Arriving somewhere new, the map library first asks for tiles three levels coarser (the 12 base
  // tiles at most), and only then for the ones it will show: `coarse` adds those.
  if (coarse) cells.push(...tilesInView(ra, dec, fov, W, H, Math.max(0, orderFor(fov, W, MAX_ORDER) - 3)));
  return [...new Set(cells.map(([o, p]) => tileUrl(LAYERS[0].url, o, p, z)))];
}
const MAX_ORDER = 5;                 // the finest level of the SPHEREx map
/** How a tile of the level shown for a view can be recognised in its address. */
const levelTag = (fov, w) => `/Norder${orderFor(fov, w, MAX_ORDER)}/`;
// The map library asks for its tiles with fetch. Noting each request, and watching the browser's
// record of finished downloads, tells exactly when the map has everything it asked for.
// Requests made by this site itself use the untouched fetch below and are kept apart.
const plainFetch = window.fetch.bind(window);
const isTile = url => url.includes('/hips/') && /\.(png|jpe?g|webp|fits)(\?|$)/i.test(url);
const asked = new Map();             // tile address -> the moments the map library asked for it and has had no answer yet
const ours = new Map();              // tile address -> how many of this site's own requests for it are on their way
const answered = new Map();          // tiles the map library asked for since the current change began, and received -> when it asked
let since = 0;                       // when the current change of the map began
function arrived(u) {
  const mine = ours.get(u);
  if (mine) { if (mine > 1) ours.set(u, mine - 1); else ours.delete(u); return; }      // which of two equal downloads ended first does not matter
  const t = asked.get(u);
  if (!t) return;
  const at = t.shift(); if (!t.length) asked.delete(u);
  if (at >= since) answered.set(u, at);
}
try {
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (isTile(e.name)) arrived(e.name); }).observe({ type: 'resource', buffered: false });
} catch { /* without it, the time limits below end every wait */ }
/**
 * Tiles of the current change that the map library is still waiting for. The library asks for the
 * same tiles again some time after any change of size; a repeat of a tile already here does not count.
 */
function outstanding() {
  let n = mendWait;
  for (const [u, t] of asked) if (!answered.has(u)) for (const at of t) if (at >= since) n++;
  return n;
}
// A tile the archive fails to deliver would stay a hole in the map: the map library does not ask
// again. (The archive drops requests that have queued for some ten seconds, which happens on a
// first visit to a large screen.) Such a tile is fetched once more here, twice at most. If the map
// is behind its still copy at that moment, the layer is then started afresh: the library asks for
// all its tiles again and finds them in the browser's store. If the map is in view, the tile waits
// in that store until the view next changes, which is when the library asks for what it lacks.
const mending = new Map();           // tile address -> tries so far, since the map library last received it whole
const repairs = [];                  // what was repaired and why, for inspection (window.__chrono.repairs with ?debug)
const noteRepair = (what, why) => { if (repairs.length < 300) repairs.push({ at: Math.round(performance.now()), what, why }); };
let mendWait = 0, mendBusy = 0, mended = 0, nudgeTimer = 0;      // repairs under way count as tiles the map is waiting for
let reloading = null;                // the layer is being started afresh (a promise while it is)
function mend(u) {
  const tries = mending.get(u) || 0;
  if (tries >= 2 || navigator.onLine === false || mending.size > 120) return;
  mending.set(u, tries + 1); mendWait++; mendBusy++;
  const settle = () => { mendBusy--; if (!mendBusy && mended) { clearTimeout(nudgeTimer); nudgeTimer = setTimeout(nudge, 120); } };
  nap(350 * (tries + 1)).then(() => quietFetch(u, { mode: 'cors' })).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('no tile'))))
    .then(() => { mended++; settle(); }, () => { mendWait = Math.max(0, mendWait - 1); settle(); mend(u); });
}
function nudge() {
  if (mendBusy) return;              // more repairs are on their way: one fresh start for all of them
  const n = mended; mended = 0;
  const done = () => { mendWait = Math.max(0, mendWait - n); };
  if (!al || !veilUp || lifting) return done();
  // A fresh start is only worth it if the tiles the map already has come back at once, out of the
  // browser's store. If they had to be downloaded again, the map would be emptier for it, not fuller.
  // And never while the library still has requests of its own under way: their answers would land in the fresh layer.
  reloading = idle().then(stored).then(yes => { noteRepair('layer', yes && veilUp && !lifting ? 'started afresh' : 'left as it is'); return yes && veilUp && !lifting ? reloadLayer() : null; })
    .then(done, done).finally(() => { reloading = null; });
}
/** Resolves when the map library has had no tile request of its own under way for a third of a second (or after 15 s). */
function idle() {
  return new Promise(resolve => {
    const t0 = performance.now(); let quietAt = t0;
    const tick = () => {
      const now = performance.now();
      if (outstanding() - mendWait > 0) quietAt = now;
      if (now - quietAt >= 330 || now - t0 > 15000) resolve(); else setTimeout(tick, 60);
    };
    tick();
  });
}
/** Does a tile the map has already received come back at once? */
async function stored() {
  let u = null;
  for (const x of answered.keys()) if (!mending.has(x)) { u = x; break; }
  if (!u) return false;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 250);
  try { const r = await quietFetch(u, { mode: 'cors', signal: ctl.signal }); await r.arrayBuffer(); return r.ok; } catch { return false; } finally { clearTimeout(timer); }
}
/** Start the sky layer on show afresh. Resolves when the library has added it and has had three frames to ask for its tiles. */
function reloadLayer() {
  return new Promise(resolve => {
    setTimeout(resolve, 6000);
    try { al.setBaseImageLayer(layerFor(LAYERS.find(l => l.id === layerId) || LAYERS[0], () => frame().then(frame).then(frame).then(resolve))); } catch { resolve(); }
  });
}
window.fetch = function (input, init) {
  let lost = null;
  try {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (isTile(url)) {
      const u = new URL(url, location.href).href, at = performance.now();
      if (!asked.has(u)) asked.set(u, []);
      asked.get(u).push(at);
      lost = () => { const t = asked.get(u), i = t ? t.indexOf(at) : -1; if (i >= 0) { t.splice(i, 1); if (!t.length) asked.delete(u); } };
      setTimeout(lost, 30000);                    // never wait for ever on a download that leaves no trace
    }
  } catch { /* keeping count must never break a request */ }
  const answer = plainFetch(input, init);
  if (lost) {
    // The archive mostly fails in the middle of a tile: the answer begins well and then breaks off.
    // So the whole tile is read here as well (from a copy of the answer), to know how it ended.
    const u = new URL(typeof input === 'string' ? input : input.url, location.href).href;
    answer.then(r => { if (r.ok) return r.clone().arrayBuffer().then(() => { mending.delete(u); }); if (r.status !== 404) throw new Error('refused'); return null; })
      .catch(e => { lost(); if (e?.name !== 'AbortError') { noteRepair(u.slice(-28), `${e?.name}: ${e?.message}`); answered.delete(u); mend(u); } });      // nothing more will come of this request
  }
  return answer;
};
/** fetch for this site's own background work: not counted as the map waiting for something. */
export const quietFetch = (url, init) => {
  try {
    if (isTile(String(url))) {
      const u = new URL(url, location.href).href;
      ours.set(u, (ours.get(u) || 0) + 1);
      setTimeout(() => { const k = ours.get(u); if (k > 1) ours.set(u, k - 1); else if (k) ours.delete(u); }, 8000);
    }
  } catch { /* as above */ }
  return plainFetch(url, init);
};
/** Fetch map tiles ahead of time. They land in this device's storage, where the map then finds them at once. */
export const prefetch = urls => Promise.all(urls.map(u => quietFetch(u, { mode: 'cors' }).then(r => r.arrayBuffer()).catch(() => null)));
const tellFov = () => { if (al && fovCb) { try { fovCb(al.getFov()[0]); } catch { /* cosmetic */ } } };

// ---------------------------------------------------------------- changes without flashes
// The map library redraws from nothing whenever its picture changes: a new colour of the cube is
// blank white until its tiles are in, and a new place or a new size of the map starts as empty
// sky. So every such change is made behind a still copy of what the visitor was looking at (the
// veil), and that copy dissolves into the new picture once the new picture is complete.
const BG = '#050505';
let veil = null, pic = null, tags = null, veilUp = false, lifting = false, moved = false, gen = 0, jobs = [], fadeFor = 0;
let level = '';                      // how the tiles that make up the picture being prepared are recognised (their level)
let deadline = 0;                    // when, at the latest, the current change shows the map, complete or not
let hue = null;                      // a colour of the cube was asked for and is not on show yet: when, and how its tiles are recognised
let firstShown = () => {};
const firstSeen = new Promise(r => { firstShown = r; });
let opened = false;                  // the live map has been on show at least once
let underWay = Promise.resolve();          // resolves once the map, sent to a new place, has its first tiles

function buildVeil() {
  veil = document.createElement('div'); veil.className = 'veil'; veil.hidden = true; veil.setAttribute('aria-hidden', 'true');
  pic = document.createElement('canvas'); tags = document.createElement('canvas');
  veil.append(pic, tags);
  al.view.catalogCanvas.after(veil);              // over the map and its markers, under the library's own controls
}
const stopAnims = () => { for (const el of [veil, pic]) for (const a of el.getAnimations()) a.cancel(); };
function hideVeil() { if (!veil) return; stopAnims(); veil.hidden = true; veilUp = false; lifting = false; moved = false; opened = true; firstShown(); }

// The archive takes several seconds to deliver a first view of the sky: one to three dozen tiles
// of about 200 kB each. A still picture of that same view ships with the site and is shown at once;
// the live map dissolves in over it when it is complete. The picture is a copy of the map's own
// canvas: a square centred on the opening position that reaches `reach` (in units of the radius of
// the sky globe) to each side, which holds the opening view of a screen of any shape.
const OPENING = { src: 'opening.jpg', ra: 266.4, dec: -29.0, fov: 100, reach: 0.8 };
const openingPic = new Image();
let openingOk = false;
const openingLoaded = new Promise(r => { openingPic.onload = () => { openingOk = true; r(true); }; openingPic.onerror = () => r(false); });
openingPic.src = OPENING.src;
/** Where that picture lies on a map of the given size and width in degrees: left, top and side, in pixels. */
function openingBox(w, h, fovDeg) {
  const side = 2 * OPENING.reach * (w / 2) / Math.sin(Math.min(fovDeg, 179.9) / 2 * Math.PI / 180);
  return [(w - side) / 2, (h - side) / 2, side];
}
/** Until the map library has started, the picture is the background of the map's box. */
function backdrop() {
  try {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    const [x, y, side] = openingBox(w, h, fitFov(OPENING.fov, w, h));
    host.style.background = `${BG} url(${OPENING.src}) ${x}px ${y}px / ${side}px ${side}px no-repeat`;
  } catch { /* cosmetic */ }
}
/** Once it has started: the picture as the still copy over the map, in place of plain darkness. */
function still() {
  if (!al || !openingOk) return false;
  // The library has not sized its own canvas yet at this point: go by the map's box.
  const cw = host.clientWidth, ch = host.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(cw * dpr), h = Math.round(ch * dpr);
  if (!cw || !ch) return false;
  if (!veil) buildVeil();
  stopAnims();
  for (const c of [pic, tags]) { c.width = w; c.height = h; Object.assign(c.style, { width: `${cw}px`, height: `${ch}px`, transform: 'none', transformOrigin: '50% 50%', opacity: '1', display: '' }); }
  tags.style.display = 'none';
  const [x0, y0, side] = openingBox(cw, ch, fitFov(OPENING.fov, cw, ch)), x = pic.getContext('2d');
  x.fillStyle = BG; x.fillRect(0, 0, w, h);
  x.imageSmoothingQuality = 'high';
  x.drawImage(openingPic, x0 * w / cw, y0 * h / ch, side * w / cw, side * h / ch);
  pic.dataset.w = cw; pic.dataset.h = ch;
  veil.style.opacity = '1'; veil.hidden = false; veilUp = true; lifting = false; moved = false;
  return true;
}

/**
 * Put a still copy of the map, exactly as it looks now, over the map: the sky on one layer, the
 * markers (the ring and name of the selected object) on another.
 */
export function freeze() {
  if (!al || !host) return false;
  const v = al.view, gl = v.imageCanvas, w = gl?.width, h = gl?.height;
  if (!w || !h || !host.clientWidth) return false;
  if (!veil) buildVeil();
  if (veilUp && !lifting) return true;            // already frozen on what the visitor last saw: keep it
  const now = document.createElement('canvas'); now.width = w; now.height = h;
  const x = now.getContext('2d');
  x.fillStyle = BG; x.fillRect(0, 0, w, h);
  try { x.drawImage(gl, 0, 0); } catch { return false; }
  if (veilUp && lifting && pic.width === w && pic.height === h) {
    // The previous copy is half-way through dissolving: what is on screen is a mix of it and the map.
    const op = parseFloat(getComputedStyle(veil).opacity), m = new DOMMatrixReadOnly(getComputedStyle(pic).transform);
    const o = (pic.style.transformOrigin || '50% 50%').split(' ').map((s, i) => (s.endsWith('%') ? parseFloat(s) / 100 * (i ? h : w) : parseFloat(s) * w / parseFloat(pic.style.width)));
    const g = document.createElement('canvas'); g.width = w; g.height = h;
    const y = g.getContext('2d'), s = w / parseFloat(pic.style.width);
    y.fillStyle = BG; y.fillRect(0, 0, w, h);
    y.translate(o[0], o[1]); y.transform(m.a, m.b, m.c, m.d, m.e * s, m.f * s); y.translate(-o[0], -o[1]);
    y.globalAlpha = parseFloat(getComputedStyle(pic).opacity); y.drawImage(pic, 0, 0);
    x.globalAlpha = clamp(op, 0, 1); x.drawImage(g, 0, 0); x.globalAlpha = 1;
  }
  stopAnims();
  const cw = v.width || host.clientWidth, ch = v.height || host.clientHeight;
  for (const c of [pic, tags]) { c.width = w; c.height = h; Object.assign(c.style, { width: `${cw}px`, height: `${ch}px`, transform: 'none', transformOrigin: '50% 50%', opacity: '1', display: '' }); }
  pic.getContext('2d').drawImage(now, 0, 0);
  try { tags.getContext('2d').drawImage(v.catalogCanvas, 0, 0, w, h); } catch { /* markers are cosmetic */ }
  pic.dataset.w = cw; pic.dataset.h = ch;
  veil.style.opacity = '1'; veil.hidden = false; veilUp = true; lifting = false; moved = false;
  return true;
}
/** Cover the map with plain darkness (used before the first picture exists). */
function darken() {
  if (!al) return;
  if (!veil) buildVeil();
  stopAnims(); pic.style.display = tags.style.display = 'none';
  veil.style.opacity = '1'; veil.hidden = false; veilUp = true; lifting = false;
}

/** Resolves when the map library has received the first tiles of the current change and has had two frames to act on them. */
function firstTiles() {
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = () => { if (answered.size || performance.now() - t0 > 600) frame().then(frame).then(resolve); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
/** Tells, each time it is called, whether the map's picture has changed since the previous call. */
function pictureWatch() {
  const k = document.createElement('canvas'); k.width = 48; k.height = 36;
  const x = k.getContext('2d', { willReadFrequently: true }); let prev = null;
  return () => {
    try {
      x.fillStyle = BG; x.fillRect(0, 0, 48, 36); x.drawImage(al.view.imageCanvas, 0, 0, 48, 36);
      const d = x.getImageData(0, 0, 48, 36).data; let diff = 0;
      if (prev) for (let i = 0; i < d.length; i += 4) diff += Math.abs(d[i] - prev[i]);
      const changed = !prev || diff > 0.4 * (d.length / 4);
      prev = d;
      return changed;
    } catch { return false; }
  };
}
/**
 * Resolves when the map shows, complete, what it was asked to show: every tile it asked for since
 * the change began has arrived and has been painted.
 * A new colour starts from a blank white map: painted means that tiles of that colour have come
 * in and the map library has stopped repainting. A new place or size starts from empty sky:
 * painted means that the picture itself has stopped changing. A change of place that overlaps a
 * change of colour has to satisfy both.
 * Waiting is counted in frames as well as in time, so that a busy moment cannot end it early.
 */
export function settled({ max = 3200, expect = false, level: tag = '' } = {}) {
  return new Promise(resolve => {
    if (!al) return resolve();
    const t0 = performance.now(), changed = expect ? null : pictureWatch();
    // While a colour is awaited, only its own tiles count as news: tiles of the colour being left,
    // asked for again by a change of size just before, say nothing about the new picture.
    let want = hue, from = want ? Math.max(t0, want.at) : t0;
    const mine = (u, at) => !want || (at >= want.at && u.includes(want.tag));
    const count = () => { if (!want) return answered.size; let k = 0; for (const [u, at] of answered) if (mine(u, at)) k++; return k; };
    const hasLevel = () => { for (const [u, at] of answered) if (u.includes(tag) && mine(u, at)) return true; return false; };
    let done = false, ticks = 0, n = count(), drawn = false, painted = false, firstAt = 0, lastAt = t0, lastTick = 0, busyTick = 0, waitAt = t0, waitTick = 0, stillAt = t0, stillTick = 0;
    const finish = () => { if (!done) { done = true; resolve(); } };
    setTimeout(finish, max + 600);                // also when the page is in the background and frames do not run
    const tick = () => {
      if (done) return;
      if (hue !== want) { want = hue; from = want ? Math.max(performance.now(), want.at) : t0; n = -1; }      // the layer was started afresh under way
      const now = performance.now(), left = outstanding(), k = count(), got = k > 0; ticks++;
      if (left > 0) { waitAt = now; waitTick = ticks; }
      if (k !== n) { n = k; if (!firstAt) firstAt = now; lastAt = now; lastTick = ticks; drawn = false; }
      let busy = false; try { busy = al.view.wasm.isRendering(); } catch { /* not this build */ }
      if (busy) { busyTick = ticks; if (got) { drawn = true; painted = true; } }
      const allIn = left === 0 && now - waitAt >= 120 && ticks - waitTick >= 4;        // nothing on its way, for a while
      const faded = ticks - busyTick >= 2 && (drawn || (now - lastAt >= 450 && ticks - lastTick >= 5));      // tiles fade in: wait that out
      const colour = got ? allIn && faded : allIn && now - from >= 1600 && ticks >= 5;      // the awaited colour is on show
      let ok;
      if (expect) ok = colour;
      else {
        if (changed()) { stillAt = now; stillTick = ticks; }
        const still = now - stillAt >= 170 && ticks - stillTick >= 6;
        // Coming from a close view to a wide one, the library first asks for coarse tiles and for the real
        // ones only half a second later: the picture is not complete before tiles of its own level are in.
        const own = tag ? hasLevel() : got;
        const ready = own || (left === 0 && now - t0 >= (tag ? 750 : 450));        // or nothing was needed: it was all in memory
        ok = ready && allIn && still && (!got || painted || now - firstAt >= 600) && (!want || colour);
      }
      if (ok || now - t0 >= max) return finish();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** The wait for the picture. If it runs out of patience while the layer is being started afresh, that is waited for as well: it must not happen in view. */
async function picture(opts) {
  await settled(opts);
  if (reloading) { await Promise.race([reloading, nap(2500)]); await settled({ max: 2000, expect: true }); }
}

/**
 * Let the still copy travel the way the camera did: it grows (or shrinks) by `k` around the point
 * (ox, oy) of the copy while that point moves by (dx, dy). It starts at once, so the visitor sees
 * the move begin with the click; the new picture dissolves in as soon as it is complete.
 */
function drift(move) {
  if (veilUp) tags.style.display = 'none';         // the ring and the name belong to the view being left
  if (!move) return;                               // the same view: the copy stays as it is
  const { ox, oy, dx = 0, dy = 0, k = 1, ms = 1000, dim = false, ease = null } = move;
  if (!veilUp || !pic.animate || pic.style.display === 'none' || calm()) return;
  if (dim) { pic.animate([{ opacity: getComputedStyle(pic).opacity }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }); return; }
  const from = getComputedStyle(pic).transform;
  for (const a of pic.getAnimations()) a.cancel();
  pic.style.transformOrigin = `${ox ?? pic.dataset.w / 2}px ${oy ?? pic.dataset.h / 2}px`;      // in the copy's own pixels
  pic.animate([{ transform: from && from !== 'none' ? from : 'translate(0px, 0px) scale(1)' }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }],
    { duration: ms, easing: ease || (k >= 1 ? 'cubic-bezier(.4, 0, .5, 1)' : 'cubic-bezier(.2, .6, .35, 1)'), fill: 'forwards' });
}
/** Dissolve the still copy into the live map. */
function lift(fade = 420) {
  if (!veilUp) return Promise.resolve();
  if (calm() || !veil.animate) { hideVeil(); return Promise.resolve(); }
  const my = gen; lifting = true;
  opened = true; firstShown();                    // from here on the map has a picture to show
  const a = veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'ease-in-out', fill: 'forwards' });
  return a.finished.then(() => { if (my === gen && lifting) hideVeil(); }).catch(() => {});
}

/**
 * Make a change to the map behind a still copy of it, then dissolve to the result.
 * `fn` makes the change and may return a promise for whatever must be ready before the result is
 * shown. Changes that overlap share one veil: it lifts when the last of them is complete.
 * Resolves true if this call lifted the veil, false if a later change took over.
 */
export function change(fn, opts = {}) {
  if (!al) { try { fn?.(); } catch { /* nothing to change */ } return Promise.resolve(false); }
  freeze();
  const my = ++gen;
  if (!jobs.length) { since = performance.now(); answered.clear(); deadline = 0; }      // a new change: tile requests from here on belong to it
  lifting = false;
  fadeFor = Math.max(fadeFor, opts.fade ?? 420);      // changes that share a veil: the slowest dissolve asked for,
  const patience = opts.patience ?? 1800;         // before the map's very first picture there is a still picture to look at, and more to load
  deadline = Math.max(deadline, performance.now() + (opened ? patience : Math.max(patience, 12000)));      // and the longest wait
  let job; try { job = Promise.resolve(fn?.()); } catch (e) { job = Promise.reject(e); }
  jobs.push(job.catch(() => {}));
  return (async () => {
    for (;;) { const n = jobs.length; await Promise.race([Promise.all(jobs), nap(5000)]); if (jobs.length === n) break; }
    if (my !== gen) return false;
    await picture({ max: Math.max(250, deadline - performance.now()), expect: opts.expect, level: opts.expect ? '' : level });
    if (my !== gen) return false;
    jobs = []; level = ''; hue = null;
    try { opts.shown?.(); } catch { /* cosmetic */ }
    const fade = fadeFor; fadeFor = 0;
    await lift(fade);
    return my === gen;
  })();
}
/**
 * The visitor has taken hold of the map: show it live at once. Only while the live map is blank
 * (its first picture, or a new colour, is still on its way) the still copy stays where it is, for
 * letting go would show the blank map. The gesture reaches the map all the same, so a click on a
 * star opens it; a drag shows when the copy lifts, a moment later.
 */
function grab() {
  if (veilUp && opened && !hue) letGo();
}
function letGo() {
  if (!veilUp) return;
  gen++; jobs = []; fadeFor = 0; level = ''; hue = null; lifting = true;
  const my = gen;
  if (!veil.animate) return hideVeil();
  veil.animate([{ opacity: getComputedStyle(veil).opacity }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished.then(() => { if (my === gen) hideVeil(); }).catch(() => {});
}

/** Where a point of the sky falls in a view drawn as a globe: centre and width in degrees, size in pixels. Null if it is on the far side. */
function project(ra0, dec0, fovDeg, w, h, ra, dec) {
  const r = Math.PI / 180, dr = (ra - ra0) * r, d0 = dec0 * r, d = dec * r;
  if (Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(dr) <= 0) return null;
  const X = Math.cos(d) * Math.sin(dr), Y = Math.sin(d) * Math.cos(d0) - Math.cos(d) * Math.sin(d0) * Math.cos(dr);
  const scale = (w / 2) / Math.sin(Math.min(fovDeg, 179.9) / 2 * r);
  return [w / 2 - X * scale, h / 2 - Y * scale];              // east is to the left, north is up
}
/**
 * The drift that makes a jump of the camera read as one move. `a` is the view being left and `b`
 * the view being entered (centre, width in degrees, size in pixels). The copy sits where the old
 * view was on screen.
 */
function cameraMove(a, b) {
  const k = (a.fov / a.w) / (b.fov / b.w);        // how much larger the same patch of sky is drawn after the move
  const grew = b.w > a.w * 1.1 || b.h > a.h * 1.1;      // the copy no longer covers the map
  if (!grew && Math.abs(k - 1) < 0.03 && Math.abs(b.w - a.w) < 3 && Math.abs(b.h - a.h) < 3 && sepDeg(a.ra, a.dec, b.ra, b.dec) < 0.01 * a.fov) return null;      // the same view
  const close = (q, w, h) => q && q[0] > -2 * w && q[0] < 3 * w && q[1] > -2 * h && q[1] < 3 * h;
  if (k >= 1.05 && !grew) {
    // Dive: the copy grows around the point nearest the destination that it actually contains,
    // chosen so that the copy keeps covering the whole map while it grows.
    const K = Math.min(k, 5), mx = b.w / (2 * K), my = b.h / (2 * K), p = project(a.ra, a.dec, a.fov, a.w, a.h, b.ra, b.dec), ok = close(p, a.w, a.h);
    const ox = ok ? clamp(p[0], mx, a.w - mx) : clamp(a.w / 2, mx, a.w - mx), oy = ok ? clamp(p[1], my, a.h - my) : clamp(a.h / 2, my, a.h - my);
    return { ox, oy, dx: b.w / 2 - ox, dy: b.h / 2 - oy, k: K, ms: 1500 };
  }
  if (k <= 0.95 && !grew) {
    // Pull back: the copy shrinks onto the place where the old view lies inside the new one.
    const q = project(b.ra, b.dec, b.fov, b.w, b.h, a.ra, a.dec);
    if (q && q[0] > 0 && q[0] < b.w && q[1] > 0 && q[1] < b.h) return { ox: a.w / 2, oy: a.h / 2, dx: q[0] - a.w / 2, dy: q[1] - a.h / 2, k: Math.max(k, 1 / 7), ms: 900 };
  }
  // Nothing in common worth following. While the copy still covers the map it leans in a little and
  // then dissolves into the new view; if the map has outgrown it, the way leads through darkness.
  return grew ? { dim: true } : { ox: a.w / 2, oy: a.h / 2, dx: (b.w - a.w) / 2, dy: (b.h - a.h) / 2, k: Math.max(1.08, 1.08 * Math.max(b.w / a.w, b.h / a.h)), ms: 2200, ease: 'cubic-bezier(.2, .5, .4, 1)' };
}
/** Size of the still copy if one is up (the view it was taken from), else of the map as the library has it. */
const copySize = () => (veilUp && pic.style.display !== 'none' ? [+pic.dataset.w, +pic.dataset.h] : [al.view.width, al.view.height]);
/** Have the map library take the size of its box now, instead of when the browser next tells it. */
const resizeNow = () => { try { al.view.fixLayoutDimensions(); } catch { /* it will find out by itself a frame later */ } };
/** The size the map's box has now, even before the map library has caught up with it. */
const boxSize = () => { const b = host.getBoundingClientRect(); return [Math.max(1, Math.floor(b.width)), Math.max(1, Math.floor(b.height))]; };
/**
 * The page is changing shape (a panel opens or closes, a text gets longer) and the map's box with
 * it: keep the map looking continuous. `fn`, if given, makes the change to the page.
 */
export function reshape(fn = null) {
  if (!al) { try { fn?.(); } catch { /* nothing to do */ } return Promise.resolve(false); }
  const [w0, h0] = copySize();
  return change(async () => {
    fn?.();
    const [w1, h1] = boxSize();
    resizeNow();
    if (!moved && isSpherex()) level = levelTag(al.getFov()[0], w1);
    // The map keeps its centre and its width in degrees: slide and scale the copy to where the same sky will lie.
    const resized = Math.abs(w1 - w0) > 2 || Math.abs(h1 - h0) > 2;
    if (!moved && resized) drift({ ox: w0 / 2, oy: h0 / 2, dx: (w1 - w0) / 2, dy: (h1 - h0) / 2, k: clamp(w1 / w0, 1 / 7, 7), ms: 420 });
    await sized();
  }, { fade: 320, patience: 1800 });
}

export async function init(selector, { onClick, onFov, still: wanted = true } = {}) {
  host = document.querySelector(selector); fovCb = onFov || null;
  if (wanted) backdrop();          // not when the page opens straight on an object somewhere else in the sky
  await A.init;
  al = A.aladin(selector, {
    survey: layerFor(LAYERS[0]), target: `${OPENING.ra} ${OPENING.dec}`, fov: fitFov(OPENING.fov), projection: 'SIN', cooFrame: 'ICRS',
    showReticle: false, showLayersControl: false, showProjectionControl: false, showFullscreenControl: false,
    showFrame: false, showCooGridControl: false, showSettingsControl: false, showShareControl: false,
    showZoomControl: false, showCooLocation: true, showFov: false, showStatusBar: false, showContextMenu: false,
    backgroundColor: 'rgb(5, 7, 12)',
    log: false,          // the library would otherwise report this page's address to its makers on every visit
  });
  al.on('click', e => { if (e && !e.isDragging && onClick) onClick(e.ra, e.dec, al.getFov()[0]); });
  try { al.on('zoomChanged', tellFov); } catch { /* older builds */ }
  try { overlay = A.graphicOverlay({ color: '#06d6a0', lineWidth: 2 }); al.addOverlay(overlay); } catch { overlay = null; }
  try {
    tag = A.catalog({ name: 'Selected object', shape: 'circle', sourceSize: 22, color: '#06d6a0', displayLabel: true,
      labelColumn: 'name', labelColor: '#f3eee6', labelFont: '600 13px "IBM Plex Sans", system-ui, sans-serif' });
    al.addCatalog(tag);
  } catch { tag = null; }
  // The library's own right-click menu (add a layer, load a file…) and its right-button drag (which
  // changes the brightness of the map) do not belong to this site: both are switched off. A long press
  // on a touch screen would open the same menu.
  try { al.contextMenu = null; al.on('rightClickMove', () => {}); } catch { /* older builds have neither */ }
  ready = true; tellFov();
  if (/[?&]debug\b/.test(location.search)) window.__chrono = { al, A, repairs };
  // Dragging or zooming by hand must act on the live map straight away.
  for (const ev of ['pointerdown', 'wheel']) host.addEventListener(ev, grab, { passive: true, capture: true });
  // The cube opens on a blank frame. Until a real one has been chosen and drawn, the map is covered
  // by the still picture of the opening view, or by plain darkness if that picture has not arrived.
  const first = firstFrame();
  try {
    darken();
    const my = ++gen; since = performance.now(); answered.clear(); jobs.push(first);
    let tries = 0;
    const show = () => { if (my === gen && veilUp && !lifting && pic.style.display === 'none' && !still() && ++tries < 40) requestAnimationFrame(show); };
    if (!wanted) { /* plain darkness until the map is there */ } else if (openingOk) show(); else openingLoaded.then(ok => { if (ok) show(); });
    (async () => {
      await Promise.race([Promise.all(jobs), nap(9000)]);
      if (my !== gen) return;
      // Until then the map would be blank white, or white in patches. With a picture to look at, the wait may be longer.
      await picture({ max: pic.style.display === 'none' ? 9000 : 20000, expect: true });
      if (my !== gen) return;
      jobs = []; hue = null; lift(800);
    })();
  } catch { hideVeil(); firstShown(); }
  fetch(`${LAYERS[0].url}/properties`).then(r => r.text()).then(t => {
    const m = t.match(/data_cube_crval3_arr\s*=\s*(.+)/);
    if (m) { const w = m[1].trim().split(/\s+/).map(Number).filter(Number.isFinite); if (w.length > 50) WAVES = w; }
  }).catch(() => {});
  return al;
}
/**
 * A layer of the map, ready to hand to the map library. The library opens a cube on its middle
 * frame, which is blank in the SPHEREx cube, and would ask for those tiles: so a cube is sent to
 * the wanted frame in the very call in which the library adds it, before it has asked for anything.
 */
function layerFor(L, added = null) {
  return A.HiPS(L.url, { name: L.label, successCallback: h => {
    try { if (L.cube && rawSlice(slice, h)) { shown = slice; h.onFrame = true; } } catch { /* firstFrame does it a moment later */ }
    try { added?.(); } catch { /* the caller's own business */ }
  } });
}
/** Resolves once the cube layer exists and shows the wanted frame. */
function firstFrame() {
  return new Promise(resolve => {
    const t0 = Date.now();
    const kick = () => {
      const h = al.getBaseImageLayer();
      if (h?.cubeDepth) { if (!h.onFrame) { rawSlice(slice, h); h.onFrame = true; } shown = slice; resolve(true); }
      else if (Date.now() - t0 < 15000) requestAnimationFrame(kick); else resolve(false);
    };
    kick();
  });
}

const legal = z => { z = clamp(Math.round(z), 0, WAVES.length - 1); while (BLANK.has(z)) z++; return z; };
/** Tell the map library to show frame z of the cube (0-based, ascending wavelength). */
function rawSlice(z, h = al?.getBaseImageLayer()) {
  if (!h || !h.cubeDepth) return false;
  // Aladin addresses cube frames by frequency, linearly between the cube's band edges.
  const c = 299792458, fMin = c / h.emMax, fMax = c / h.emMin;
  const f = fMin + (z + 0.5) * (fMax - fMin) / h.cubeDepth;
  h.setSliceNumber((c / f - h.emMin) / (h.emMax - h.emMin) * h.cubeDepth);
  hue = { at: performance.now(), tag: `_${z}.` };      // the map is blank until tiles of this frame are in
  return true;
}
/**
 * Show frame z of the SPHEREx cube. Its tiles are fetched first, while the map goes on showing the
 * colour it has; the swap is then made out of sight and the map dissolves into the new colour.
 * Returns the frame chosen and a promise that resolves when it is on screen (true), when a later
 * choice replaced it (false), or when its tiles could not be had ('missing').
 */
export function setSlice(z, { fade = 380, onShow = null } = {}) {
  z = legal(z);
  slice = z;
  if (!al || !isSpherex() || !al.getBaseImageLayer()?.cubeDepth) return { z, done: Promise.resolve(false) };
  if (z === shown && !veilUp) { try { onShow?.(); } catch { /* cosmetic */ } return { z, done: Promise.resolve(true) }; }
  const done = (async () => {
    if (z !== shown) {
      // A blank white map is what the library shows until a colour's tiles are in. On a slow connection
      // that can take seconds: so have them at hand before anything changes on screen.
      const want = tiles({ z }), got = await Promise.race([prefetch(want), nap(9000).then(() => null)]);
      if (slice !== z) return false;                               // a later choice has replaced it meanwhile
      if (!got || (want.length && got.every(t => !t))) { slice = shown; return 'missing'; }      // not to be had (offline, or far too slow): keep what is shown
    }
    let applied = false;
    const ok = await change(() => {
      if (slice !== z) return;
      if (z !== shown) { rawSlice(z); shown = z; }
      applied = true;
    }, { fade, expect: z !== shown, patience: 2600, shown: () => { if (applied) onShow?.(); } });
    return ok && applied;
  })();
  return { z, done };
}

export function setLayer(id) {
  const L = LAYERS.find(l => l.id === id) || LAYERS[0];
  layerId = L.id;
  return change(async () => {
    al.setBaseImageLayer(layerFor(L));
    if (L.cube) await firstFrame(); else await nap(350);
  }, { fade: 500, patience: 3500 });
}

export const fov = () => (al ? al.getFov()[0] : 60);
/** Zoom in (factor below 1) or out (above 1) around the centre of the view. */
export function zoomBy(factor) {
  if (!al) return Promise.resolve(false);
  const f0 = al.getFov()[0], f1 = clamp(f0 * factor, 0.03, 180);
  return change(async () => {
    al.setFoV(f1); tellFov();
    if (isSpherex()) level = levelTag(al.getFov()[0], al.view.width);
    moved = true; drift({ ox: al.view.width / 2, oy: al.view.height / 2, k: clamp(f0 / al.getFov()[0], 1 / 7, 7), ms: 480 });
    if (isSpherex()) await Promise.race([prefetch(tiles()), nap(1200)]);
  }, { fade: 300, patience: 2000 });
}
export const center = () => (al ? al.getRaDec() : [0, 0]);
/** Resolves when the map shows its first picture. */
export const firstPicture = () => firstSeen;
/** Resolves when the map, sent somewhere by flyTo, has received its first tiles there (or at once if it is not travelling). */
export const onItsWay = () => underWay;
export function resize() { window.dispatchEvent(new Event('resize')); }

/** Wait until the map library has taken the size its box now has. */
async function sized() {
  for (let i = 0; i < 8; i++) {
    await frame();
    if (al.view.width === Math.max(1, Math.floor(host.getBoundingClientRect().width)) && al.view.height === Math.max(1, Math.floor(host.getBoundingClientRect().height))) break;
  }
  await frame();
}

/**
 * Go to a position. A short hop inside what is already on screen glides there; anything further
 * is made behind a still copy of the old view, which dives towards the destination and dissolves
 * into the new view. `layout`, if given, changes the page (and with it the size of the map) as
 * part of the same move.
 */
export function flyTo(ra, dec, targetFov = 0.6, { layout = null } = {}) {
  if (!al) { layout?.(); return Promise.resolve(false); }
  const [ra0, dec0] = al.getRaDec(), f0 = al.getFov()[0], [w0, h0] = copySize();
  const d = sepDeg(ra0, dec0, ra, dec);
  if (!layout && !veilUp && d < f0 * 0.02 && Math.abs(Math.log(f0 / targetFov)) < 0.1) { al.gotoRaDec(ra, dec); return Promise.resolve(true); }
  if (!layout && !veilUp && !calm() && d < f0 * 0.45 && Math.abs(Math.log(f0 / targetFov)) < 0.5) return glide(ra, dec, targetFov);
  let go; underWay = new Promise(r => { go = r; });
  return change(async () => {
    layout?.();
    const [w1, h1] = boxSize(), f = fitFov(targetFov, w1, h1);
    // The copy starts moving with the click; the map itself jumps there out of sight.
    moved = true; drift(cameraMove({ ra: ra0, dec: dec0, fov: f0, w: w0, h: h0 }, { ra, dec, fov: f, w: w1, h: h1 }));
    // Before the map's first picture the copy is the opening picture, and the wait can be long:
    // enlarged, it is not worth looking at for seconds, so it gives way to darkness.
    if (!opened) { const g = gen; nap(1500).then(() => { if (g === gen && veilUp && !lifting && !opened) drift({ dim: true }); }); }
    // The map takes its new size and its new place in the same breath. Left to itself, the map library
    // would first ask for tiles of the old place at the new size, and those would hold up the ones that matter.
    resizeNow();
    al.gotoRaDec(ra, dec); al.setFoV(f); tellFov();
    level = isSpherex() ? levelTag(f, w1) : '';
    const ahead = isSpherex() ? prefetch(tiles({ ra, dec, fov: f, w: w1, h: h1, coarse: true })) : nap(300);
    firstTiles().then(go);                        // the panel's own work may start once the map has its first tiles
    await sized();
    await Promise.race([ahead, nap(Math.max(200, deadline - performance.now() - 700))]);      // on a slow connection the rest arrives in view of the visitor
  }, { fade: 450, patience: 2500 }).finally(go);
}
/** The map's own animation, for short distances where every tile it needs is already drawn. */
function glide(ra, dec, targetFov) {
  return new Promise(resolve => {
    let done = false; const finish = () => { if (!done) { done = true; tellFov(); resolve(); } };
    setTimeout(finish, 3000);                                   // never hang the UI on an animation
    const zoom = () => (Math.abs(Math.log(al.getFov()[0] / targetFov)) < 0.05 ? finish() : al.zoomToFoV(targetFov, 0.6, finish));
    al.animateToRaDec(ra, dec, 0.6, zoom);
  });
}

/** Mark the selected spot: a named ring that stays visible at any zoom, and the footprint of the SPHEREx stamp. */
export function mark(ra, dec, sizeArcmin, label = '') {
  try {
    overlay?.removeAll();
    const h = sizeArcmin / 120, cd = Math.max(Math.cos(dec * Math.PI / 180), 0.05);
    overlay?.add(A.polygon([[ra - h / cd, dec - h], [ra + h / cd, dec - h], [ra + h / cd, dec + h], [ra - h / cd, dec + h]]));
  } catch { /* marker is cosmetic */ }
  try {
    tag?.removeAll();
    const short = label.length > 22 ? `${label.slice(0, 21)}…` : label;
    tag?.addSources([A.source(ra, dec, { name: short ? `  ${short}` : '' })]);
  } catch { /* marker is cosmetic */ }
}
export function clearMark() { try { overlay?.removeAll(); tag?.removeAll(); } catch { /* ignore */ } }
