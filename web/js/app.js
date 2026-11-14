import * as C from './core.js';
import { Plot, dateTicks } from './plot.js';

const API = (window.BLINK_API || '').replace(/\/$/, '');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const MODES = {
  epochs: 'One stacked image per observing season. Blink between them: anything that moved between seasons jumps.',
  frames: 'Every single exposure in time order. Each one sees the sky at a slightly different wavelength, so stars flicker naturally.',
  color: 'Time shown as colour: first season in red, last in blue. Stars that stayed put look white; anything that moved or changed splits into colours.',
  diff: 'A later season minus an earlier one. Steady stars cancel; a moving object leaves a dark-and-bright pair.',
  deep: 'All exposures of this detector added together: the deepest, cleanest image.',
  bands: 'The same patch of sky in each of the six detectors, from 0.75 to 5 microns, then all six as one colour picture (short wavelengths blue, long red). Cold objects only appear at the long end.',
};

const S = {
  targets: [], target: null, track: null, ra: 0, dec: 0, size: 5,
  head: null, grid: null, det: 2, dets: {}, mode: 'epochs',
  seq: [], idx: 0, playing: false, fps: 2, timer: null,
  sel: null, view: { z: 1, cx: 0, cy: 0 }, white: 0, invert: false, smooth: false, mask: false,
  showGaia: true, gaia: null, off: new Set(), abort: null, deep: null, hi: 1, gen: 0,
};

const cv = $('sky'), ctx = cv.getContext('2d');
const off = document.createElement('canvas'), octx = off.getContext('2d');
const specPlot = new Plot($('spec'), $('spec').nextElementSibling);
const lcPlot = new Plot($('lc'), $('lc').nextElementSibling);

// ------------------------------------------------------------ loading
function streamUrl(det) {
  if (S.target && S.size === S.target.size) return `data/${S.target.slug}/d${det}.ndjson`;
  return `${API}/api/stream?ra=${S.ra.toFixed(6)}&dec=${S.dec.toFixed(6)}&size=${S.size}&det=${det}`;
}

async function go({ ra, dec, size, target = null, track = null, det, mode }) {
  S.abort?.abort(); S.abort = new AbortController();
  const gen = ++S.gen;
  stop();
  Object.assign(S, { ra, dec, size: size || 5, target, track: track || (target && target.resolved) || null,
    head: null, grid: null, dets: {}, seq: [], idx: 0, sel: null, gaia: null, catwise: null, deep: null, off: new Set() });
  if (det) S.det = det;
  if (mode && MODES[mode]) S.mode = mode;
  $('fov').value = String(S.size);
  $('notice').hidden = true;
  syncUrl(); renderChips(); renderAbout(); renderModes(); renderDets(); paint(); refreshPlots();
  setStatus('Asking the archive which exposures cover this spot…');
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
    if (gen === S.gen) setStatus('');
  } catch (e) {
    if (e.name === 'AbortError' || gen !== S.gen) return;
    console.error(e);
    setStatus(S.target ? `Could not load data: ${e.message}` :
      'The live archive service is not reachable right now. The five test targets above still work.');
  }
}

async function loadDet(det, gen) {
  const D = S.dets[det] = { frames: [], total: 0, done: false, loading: true };
  renderDets();
  let last = 0;
  await C.loadStream(streamUrl(det), line => {
    if (gen !== S.gen) return;
    if (line.t === 'head') {
      D.total = line.total; D.found = line.found;
      if (!S.head) {
        line.epochs = C.refineEpochs(line.epochs || []);
        S.head = line; S.grid = line.grid;
        const c = (S.grid.n - 1) / 2; S.view = { z: 1, cx: c, cy: c };
        renderReleases(); renderAbout();
        if (!line.total && !+line.avail[det]) {
          const other = [1, 2, 3, 4, 5, 6].find(d => +line.avail[d] > 0);
          if (!other) setStatus('SPHEREx has no public exposures at this position yet.');
        }
      }
      renderDets();
    } else if (line.t === 'frame') {
      line.data = C.decodeF16(line.b64); delete line.b64;
      D.frames.push(line);
      const now = performance.now();
      if (now - last > 600) { last = now; onData(det); }
    } else if (line.t === 'done') {
      D.done = true; D.loading = false; onData(det);
    }
  }, S.abort.signal);
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
}

async function loadCatalog(gen) {
  try {
    const url = S.target && S.size === S.target.size ? `data/${S.target.slug}/gaia.json`
      : `${API}/api/catalog?ra=${S.ra.toFixed(5)}&dec=${S.dec.toFixed(5)}&size=${S.size}&cat=gaia`;
    const r = await fetch(url, { signal: S.abort.signal });
    if (!r.ok) return;
    const js = await r.json();
    if (gen === S.gen) { S.gaia = js; paint(); }
  } catch { /* overlay is optional */ }
}
async function loadCatwise() {
  if (S.catwise || !S.grid) return;
  const gen = S.gen;
  try {
    const url = S.target && S.size === S.target.size ? `data/${S.target.slug}/catwise.json`
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
  const keepMjd = S.seq[S.idx]?.mjd;
  // Group by the archive-wide observing seasons so every detector agrees on what "season 2" is.
  const byEp = new Map();
  for (const f of frames) { const k = gEpoch(f.mjd); if (!byEp.has(k)) byEp.set(k, []); byEp.get(k).push(f); }
  S.epochs = [...byEp.keys()].sort((a, b) => a - b).map(k => {
    const fr = byEp.get(k); return { i: k, frames: fr, t0: fr[0].mjd, t1: fr[fr.length - 1].mjd, mid: (fr[0].mjd + fr[fr.length - 1].mjd) / 2 };
  });
  const stacks = S.epochs.map(e => {
    const img = C.medianStack(e.frames, npx);
    return { kind: 'stack', img, sig: C.robustStats(img).sig, mjd: e.mid, n: e.frames.length, ep: e,
      title: `Season ${gEpoch(e.mid) + 1} · ${C.fmtMonth(e.mid)}`, sub: `${e.frames.length} exposures stacked (${C.fmtDate(e.t0)} to ${C.fmtDate(e.t1)})` };
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
      title: C.fmtDate(f.mjd, true), sub: `${lamAt(f).toFixed(3)} µm · exposure ${f.id}` }));
  } else if (S.mode === 'epochs') seq = stacks;
  else if (S.mode === 'deep') {
    if (S.deep) seq = [{ kind: 'stack', img: S.deep, sig: S.deepSig, mjd: frames[frames.length >> 1].mjd, n: frames.length,
      title: 'Deep sum', sub: `${frames.length} exposures, all seasons` }];
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
          n: fr.length, title: `${C.DET_BANDS[d][0]} to ${C.DET_BANDS[d][1]} µm`, sub: `${fr.length} exposures, all seasons` };
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
      if (pm > 150) {   // arrow: motion over the next 10 years
        const [ra2, dec2] = C.propagate(src, S.gaia.epoch, year + 10), [x2, y2] = C.skyToGrid(g, ra2, dec2), [X2, Y2] = g2c(x2, y2, W, H, s);
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
  const ox = W - 30, oy = 52;
  arrow(ox, oy, ox, oy - 26, '#fff'); ctx.fillText('N', ox, oy - 30);
  arrow(ox, oy, ox - 26, oy, '#fff'); ctx.fillText('E', ox - 33, oy + 4);
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
      ? '<b>Needs two seasons</b><span>This detector has only one observing season here so far.</span>'
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
  return pts;
}
function pct(v, f) { const s = [...v].sort((a, b) => a - b); return s[clamp(Math.round(f * (s.length - 1)), 0, s.length - 1)]; }
function drawPlots() {
  const pts = S.pts = measureAll(), cur = S.seq[S.idx]?.frame;
  const fl = pts.map(p => p.flux);
  const sp = pts.map(p => ({ x: p.lam, y: p.flux, err: p.err, color: epochColor(p.mjd), src: p, big: p.frame === cur }));
  const ymax = fl.length ? pct(fl, 0.98) * 1.25 : 1, ymin = fl.length ? Math.min(0, pct(fl, 0.02)) : 0;
  specPlot.set(sp, {
    xlabel: 'wavelength (µm)', ylabel: S.haloDets?.length === 6 ? 'halo flux (relative)' : 'flux (mJy)', ylim: [ymin - (ymax - ymin) * 0.04, ymax > ymin ? ymax : ymin + 1],
    xlim: [0.7, 5.1], empty: S.sel ? 'Measuring…' : 'Click a star in the image',
    shade: S.grid ? [{ x0: C.DET_BANDS[S.det][0], x1: C.DET_BANDS[S.det][1], color: '#4cc9f012' }] : [],
    tipText: p => `${p.x.toFixed(3)} µm · ${p.y.toFixed(2)} ± ${p.err.toFixed(2)} mJy · ${C.fmtDate(p.src.mjd)} · D${p.src.det}`,
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
  lcPlot.set(lc, {
    xlabel: 'date', ylabel: 'relative brightness', ylim: [lo - 0.1, hi + 0.1], hline: 1, errors: lc.length < 400,
    xTicks: dateTicks, empty: pts.length ? `Too faint (or saturated) in D${S.det} to measure changes` : 'Click a star in the image',
    tipText: p => `${C.fmtDate(p.x)} · ×${p.y.toFixed(2)} · ${p.src.lam.toFixed(2)} µm`,
    onPick: p => jumpTo(p.src),
  });
  $('lctitle').textContent = `Brightness over time · D${S.det} (${C.DET_BANDS[S.det].join('–')} µm)`;
  const legend = (S.head?.epochs || []).map((e, i) => `<span><i style="background:${C.EPOCH_COLORS[i % C.EPOCH_COLORS.length]}"></i>${C.fmtMonth((e[0] + e[1]) / 2)}</span>`).join('');
  const haloNote = S.haloDets?.length ? `<b>Too bright for the detector:</b> the star's core is saturated in ${S.haloDets.map(d => 'D' + d).join(', ')}, so those points are measured from its outer halo (a ring well outside the core). Their scale is relative; the changes over time are real. ` : '';
  $('specnote').innerHTML = `<span class="legend">${legend}</span>${haloNote}Every exposure sees the spot at a different wavelength, so stepping through time builds a spectrum (${pts.length} measurements so far). Click a point to jump to that exposure. Aperture radius 9″, no aperture correction.`;
}
function markCurrent() {
  const cur = S.seq[S.idx]?.frame;
  for (const pl of [specPlot, lcPlot]) { for (const p of pl.pts) p.big = !!cur && p.src.frame === cur; pl.draw(); }
}
function jumpTo(src) {
  stop();
  S.det = src.det; S.mode = 'frames';
  renderModes(); renderDets(); rebuild();
  const i = S.seq.findIndex(it => it.frame === src.frame);
  if (i >= 0) { S.idx = i; show(); }
  syncUrl();
}

// ------------------------------------------------------------ side panels
function renderChips() {
  $('chips').innerHTML = '';
  for (const t of S.targets) {
    const b = document.createElement('button');
    b.className = 'chip'; b.type = 'button';
    b.innerHTML = `${t.label}<small>${t.kind === 'motion' ? 'moves' : 'varies'}</small>`;
    b.setAttribute('aria-pressed', S.target?.slug === t.slug);
    b.onclick = () => go({ ra: t.ra, dec: t.dec, size: t.size, target: t, ...(t.view || { mode: 'epochs' }) });
    $('chips').appendChild(b);
  }
}
function renderAbout() {
  const t = S.target, k = S.track, el = $('about');
  const name = t ? t.label : k ? k.name : 'Custom position';
  const facts = [];
  if (S.grid || S.ra) facts.push(`<span><b>${C.fmtSex(S.ra, S.dec)}</b></span>`, `<span>RA ${S.ra.toFixed(5)}° Dec ${S.dec.toFixed(5)}°</span>`);
  if (k && k.pmra != null) {
    const pm = Math.hypot(k.pmra, k.pmdec) / 1000;
    facts.push(`<span>catalogue motion <b>${pm.toFixed(2)}″/yr</b> = ${(pm / 6.15).toFixed(2)} SPHEREx pixels/yr</span>`);
    if (k.plx) facts.push(`<span>distance <b>${(3261.56 / k.plx).toFixed(1)} light-years</b></span>`);
  }
  if (S.head) facts.push(`<span><b>${S.head.total}</b> exposures, <b>${S.head.epochs.length}</b> seasons (${C.fmtMonth(S.head.epochs[0]?.[0] ?? 0)} to ${C.fmtMonth(S.head.epochs.at(-1)?.[1] ?? 0)})</span>`);
  const moved = k && k.pmra != null && Math.hypot(k.pmra, k.pmdec) > 200
    ? `<p class="hint">Centred on where it is now, not its year-2000 catalogue position (it has moved ${(Math.hypot(k.pmra, k.pmdec) / 1000 * (C.mjdToYear(S.head?.epochs?.[0]?.[0] ?? 61000) - 2000)).toFixed(0)}″ since then). Dots mark the predicted position in each season.</p>` : '';
  el.innerHTML = `<h2>${name}</h2>${t ? `<p>${t.blurb}</p>${t.look ? `<p class="look"><b>What to look for.</b> ${t.look}</p>` : ''}` : ''}${moved}<div class="facts">${facts.join('')}</div><div id="motion"></div>`;
  renderMotion();
}
/** Measured position per season versus the catalogue prediction. */
function renderMotion() {
  const el = $('motion');
  if (!el) return;
  if (!S.track || S.track.pmra == null || !S.stacks || S.stacks.length < 2) { el.innerHTML = ''; return; }
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
    el.innerHTML = `<p class="hint">This star does not move measurably on the sky. Its measured position changes by at most ${as(worst)}″ between seasons in D${S.det}: that is how well the images are aligned (1 SPHEREx pixel = 6.15″).</p>`;
    return;
  }
  const body = rows.map(({ st, p, m }) => {
    const pe = -(p[0] - p0[0]), pn = p[1] - p0[1];
    if (!m) return `<tr><td>${C.fmtMonth(st.mjd)}</td><td colspan="3">not detected</td></tr>`;
    const me = -(m.x - m0.x), mn = m.y - m0.y, d = Math.hypot(me - pe, mn - pn);
    return `<tr><td><i style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${epochColor(st.mjd)};margin-right:5px"></i>${C.fmtMonth(st.mjd)}</td><td>${as(Math.hypot(me, mn))}″</td><td>${as(Math.hypot(pe, pn))}″</td><td>${as(d)}″</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="motion"><thead><tr><th>Season</th><th>Measured shift</th><th>Catalogue predicts</th><th>Disagreement</th></tr></thead><tbody>${body}</tbody></table>
  <p class="hint">Shift since the first season, measured from the stacked D${S.det} images (1 SPHEREx pixel = 6.15″). The prediction uses catalogue proper motion only.</p>`;
}
function renderModes() {
  for (const b of $('modes').children) b.setAttribute('aria-pressed', b.dataset.mode === S.mode);
  $('explain').textContent = MODES[S.mode];
}
function renderDets() {
  const el = $('dets'); el.innerHTML = '';
  for (let d = 1; d <= 6; d++) {
    const b = document.createElement('button'), D = S.dets[d], avail = S.head ? +S.head.avail[d] : null;
    b.type = 'button';
    b.innerHTML = `D${d}<small>${C.DET_BANDS[d][0]}–${C.DET_BANDS[d][1]} µm</small><small>${D ? (D.loading ? `${D.frames.length}/${D.total || '…'}` : `${D.frames.length} exp.`) : avail === null ? '' : avail ? `${avail} exp.` : 'none'}</small>`;
    b.setAttribute('aria-pressed', d === S.det);
    b.disabled = avail === 0;
    if (D?.loading) b.classList.add('loading');
    b.title = `Detector ${d}: ${C.DET_BANDS[d][0]} to ${C.DET_BANDS[d][1]} microns`;
    b.onclick = () => { S.det = d; renderDets(); rebuild(); refreshPlots(); syncUrl(); if (!S.dets[d]) setStatus(`Detector ${d} is still loading…`); };
    el.appendChild(b);
  }
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
    add('Detector', `D${S.det} (${C.DET_BANDS[S.det].join('–')} µm)`);
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
  try {
    const r = await fetch('https://cds.unistra.fr/cgi-bin/nph-sesame/-oxp/SNV?' + encodeURIComponent(name));
    if (r.ok) { const v = parse(await r.text()); if (v) return v; }
  } catch { /* fall through to our own API */ }
  const r = await fetch(`${API}/api/resolve?q=${encodeURIComponent(name)}`);
  if (!r.ok) return null;
  return r.json();
}
const sepArcsec = (ra1, dec1, ra2, dec2) => Math.hypot((ra1 - ra2) * Math.cos(dec1 * Math.PI / 180), dec1 - dec2) * 3600;

async function search(text) {
  text = text.trim();
  if (!text) return;
  const size = +$('fov').value;
  const co = C.parseCoords(text);
  if (co) {
    await go({ ...co, size });
    // Did the user type old coordinates of a fast mover we know about?
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
        el.querySelector('button').onclick = () => go({ ra: t.ra, dec: t.dec, size: t.size, target: t, ...(t.view || {}) });
      }
    }
    return;
  }
  const q = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const preset = S.targets.find(t => [t.label, t.slug, t.query].some(s => { const v = s.toLowerCase().replace(/[^a-z0-9]/g, ''); return v.includes(q) || q.includes(v); }));
  if (preset && size === preset.size) return go({ ra: preset.ra, dec: preset.dec, size, target: preset, ...(preset.view || {}) });
  setStatus(`Looking up “${text}”…`);
  const r = await resolveName(text).catch(() => null);
  if (!r) { setStatus(`Could not find “${text}”. Try coordinates, e.g. 269.446 4.771`); return; }
  go({ ra: r.ra, dec: r.dec, size, track: r, target: preset || null });
}

function syncUrl() {
  const p = new URLSearchParams();
  if (S.target && S.size === S.target.size) p.set('target', S.target.slug);
  else { p.set('ra', S.ra.toFixed(5)); p.set('dec', S.dec.toFixed(5)); p.set('fov', S.size); }
  p.set('det', S.det); p.set('mode', S.mode);
  if (document.body.classList.contains('embed')) p.set('embed', '1');
  history.replaceState(null, '', '?' + p.toString());
}

// ------------------------------------------------------------ events
$('search').onsubmit = e => { e.preventDefault(); search($('q').value); };
$('fov').onchange = () => { if (S.grid || S.ra) go({ ra: S.ra, dec: S.dec, size: +$('fov').value, target: S.target, track: S.track }); };
$('play').onclick = () => S.playing ? stop() : play();
$('prev').onclick = () => { stop(); step(-1); };
$('next').onclick = () => { stop(); step(1); };
$('seek').oninput = e => { stop(); S.idx = +e.target.value; show(); };
$('fps').onchange = e => { S.fps = +e.target.value; if (S.playing) play(); };
for (const b of $('modes').children) b.onclick = () => { stop(); S.mode = b.dataset.mode; S.seq = []; S.idx = 0; renderModes(); rebuild(); syncUrl(); };
$('white').oninput = e => { S.white = +e.target.value; paint(); };
$('invert').onchange = e => { S.invert = e.target.checked; paint(); };
$('smooth').onchange = e => { S.smooth = e.target.checked; paint(); };
$('gaia').onchange = e => { S.showGaia = e.target.checked; paint(); };
$('wise').onchange = e => { S.showWise = e.target.checked; if (S.showWise) loadCatwise(); paint(); };
$('mask').onchange = e => { S.mask = e.target.checked; paint(); };
$('resetview').onclick = () => { if (S.grid) { const c = (S.grid.n - 1) / 2; S.view = { z: 1, cx: c, cy: c }; paint(); } };
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.key === ' ') { e.preventDefault(); S.playing ? stop() : play(); }
  else if (e.key === 'ArrowRight') { stop(); step(1); }
  else if (e.key === 'ArrowLeft') { stop(); step(-1); }
});
new ResizeObserver(() => paint()).observe(cv);

// pointer: tap = measure, drag = pan, pinch / wheel = zoom
const ptrs = new Map(); let pinch = null;
function clampView() {
  const n = S.grid.n; S.view.z = clamp(S.view.z, 1, 32);
  S.view.cx = clamp(S.view.cx, 0, n - 1); S.view.cy = clamp(S.view.cy, 0, n - 1);
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

// ------------------------------------------------------------ start
(async function init() {
  if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
  renderModes(); renderDets();
  try { S.targets = await (await fetch('data/targets.json')).json(); } catch { S.targets = []; }
  renderChips();
  const q = new URLSearchParams(location.search), det = +q.get('det') || undefined, mode = q.get('mode') || undefined;
  const t = S.targets.find(x => x.slug === q.get('target'));
  if (t) return go({ ra: t.ra, dec: t.dec, size: t.size, target: t, ...(t.view || {}), ...(det ? { det } : {}), ...(mode ? { mode } : {}) });
  if (q.has('ra') && q.has('dec')) return go({ ra: +q.get('ra'), dec: +q.get('dec'), size: +(q.get('fov') || q.get('size') || 5), det, mode });
  if (S.targets.length) { const d = S.targets[0]; return go({ ra: d.ra, dec: d.dec, size: d.size, target: d, ...(d.view || {}) }); }
  setStatus('Type an object name or coordinates above.');
})();
