// SPHEREx straight from NASA's open data, in the browser. No server involved.
//
//  1. A static sky index (web/index/) says which exposures have their image centre near a position.
//  2. Each candidate exposure is a FITS file in the public nasa-irsa-spherex bucket. Only its header
//     and the block of pixels around the target are fetched, with HTTP range requests.
//  3. The block is resampled onto a common north-up grid using the file's own astrometry (TAN-SIP),
//     the sky level is removed, and the wavelength of every pixel is read from the file's WCS-WAVE table.

const S3 = 'https://nasa-irsa-spherex.s3.amazonaws.com/';
const IBE = 'https://irsa.ipac.caltech.edu/ibe/data/spherex/';
const NPIX = 2040, BLOCK = 2880, HEAD_BYTES = 16 * BLOCK, NATIVE = 6.15, MAX_GRID = 300;
const FIELD_RADIUS = 2.55;        // deg: half-diagonal of one 3.5-degree detector image, plus margin
export const MAX_PER_DET = 160;
const D2R = Math.PI / 180;
export const DET_BANDS = { 1: [0.75, 1.11], 2: [1.11, 1.64], 3: [1.64, 2.42], 4: [2.42, 3.82], 5: [3.82, 4.42], 6: [4.42, 5.0] };

// ------------------------------------------------------------------ sky index
let manifestPromise = null;
export function manifest(base = 'index/') {
  manifestPromise ??= fetch(`${base}manifest.json`).then(r => { if (!r.ok) throw new Error('index missing'); return r.json(); })
    .then(m => { m.base = base; return m; });
  manifestPromise.catch(() => { manifestPromise = null; });
  return manifestPromise;
}

function bandInfo(b, cellDeg) {
  const centre = -90 + (b + 0.5) * cellDeg;
  return Math.max(1, Math.round(360 * Math.cos(centre * D2R) / cellDeg));
}
/** Sky cells that a circle of radius r degrees around (ra, dec) can touch. */
function cellsNear(ra, dec, r, cellDeg) {
  const nb = Math.round(180 / cellDeg), out = [];
  const b0 = Math.max(0, Math.floor((dec - r + 90) / cellDeg)), b1 = Math.min(nb - 1, Math.floor((dec + r + 90) / cellDeg));
  for (let b = b0; b <= b1; b++) {
    const n = bandInfo(b, cellDeg), lo = -90 + b * cellDeg, hi = lo + cellDeg;
    const edge = Math.min(89.9, Math.max(Math.abs(Math.max(lo, dec - r)), Math.abs(Math.min(hi, dec + r))));
    const half = r / Math.cos(edge * D2R);          // RA half-width of the circle at this band's poleward edge
    if (half >= 180 || dec + r > 89.5 || dec - r < -89.5) { for (let i = 0; i < n; i++) out.push([b, i]); continue; }
    const i0 = Math.floor(((ra - half + 720) % 360) / 360 * n), i1 = Math.floor(((ra + half + 720) % 360) / 360 * n);
    for (let i = i0; ; i = (i + 1) % n) { out.push([b, i]); if (i === i1) break; if (out.length > 4000) break; }
  }
  return out;
}
function sepDeg(ra1, dec1, ra2, dec2) {
  const s = Math.sin(dec1 * D2R) * Math.sin(dec2 * D2R) + Math.cos(dec1 * D2R) * Math.cos(dec2 * D2R) * Math.cos((ra1 - ra2) * D2R);
  return Math.acos(Math.min(1, Math.max(-1, s))) / D2R;
}

function keyOf(m, f, version) {
  const seq = String(f.seq).padStart(4, '0');
  return `${f.prefix}/level2/${f.week}/${version}/${f.det}/level2_${f.week}_${seq}_${f.sub}D${f.det}_spx_${version}.fits`;
}
/** Candidate cloud paths of an exposure, most likely first. */
function keysOf(m, f) {
  const vs = (m.versions[f.prefix] || {})[f.week] || [];
  const order = f.retry ? [...vs.filter(v => v.includes('retry')), ...vs.filter(v => !v.includes('retry'))] : vs;
  return order.map(v => keyOf(m, f, v));
}

/** Every exposure whose image centre lies close enough to (ra, dec) that it may cover it. */
export async function findFrames(ra, dec, signal) {
  const m = await manifest(), rec = m.recordBytes || 18;
  const cells = cellsNear(ra, dec, FIELD_RADIUS, m.cellDeg);
  const bufs = await Promise.all(cells.map(([b, i]) =>
    fetch(`${m.base}c/${b}_${i}.bin?v=${encodeURIComponent(m.built || '')}`, { signal }).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null)));
  const out = [];
  for (const buf of bufs) {
    if (!buf) continue;
    const dv = new DataView(buf);
    for (let o = 0; o + rec <= buf.byteLength; o += rec) {
      const fra = dv.getFloat32(o, true), fdec = dv.getFloat32(o + 4, true);
      const d = sepDeg(ra, dec, fra, fdec);
      if (d > FIELD_RADIUS) continue;
      const sd = dv.getUint8(o + 16), rr = dv.getUint8(o + 17), rel = m.releases[rr & 127];
      const f = { cra: fra, cdec: fdec, dist: d, mjd: 60000 + dv.getFloat32(o + 8, true), week: m.weeks[dv.getUint16(o + 12, true)],
        seq: dv.getUint16(o + 14, true), sub: sd >> 4, det: sd & 15, coll: rel.name, prefix: rel.prefix, retry: (rr & 128) !== 0 };
      f.id = `${f.week}_${String(f.seq).padStart(4, '0')}_${f.sub}`;
      f.keys = keysOf(m, f);
      if (f.keys.length) out.push(f);
    }
  }
  return out.sort((a, b) => a.mjd - b.mjd || a.det - b.det);
}

export function epochsOf(mjds, gap = 30) {
  const out = [];
  for (const t of [...mjds].sort((a, b) => a - b)) {
    if (out.length && t - out[out.length - 1][1] <= gap) out[out.length - 1][1] = t; else out.push([t, t]);
  }
  return out;
}
function thin(frames, limit) {
  if (frames.length <= limit) return frames;
  const idx = new Set();
  for (let k = 0; k < limit; k++) idx.add(Math.round(k * (frames.length - 1) / (limit - 1)));
  return [...idx].sort((a, b) => a - b).map(i => frames[i]);
}

// ------------------------------------------------------------------ output grid
/** North-up, east-left tangent-plane grid centred on the target. */
export function makeGrid(ra, dec, sizeArcmin) {
  const size = Math.min(Math.max(+sizeArcmin || 5, 1), 120);
  const scale = Math.max(NATIVE / 2, size * 60 / MAX_GRID), n = 2 * Math.round(size * 30 / scale), c = (n - 1) / 2;
  const raG = new Float64Array(n * n), decG = new Float64Array(n * n), a0 = ra * D2R, d0 = dec * D2R, s = scale / 206264.806;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const xi = -(i - c) * s, eta = (j - c) * s, den = Math.cos(d0) - eta * Math.sin(d0);
    raG[j * n + i] = (a0 + Math.atan2(xi, den)) / D2R;
    decG[j * n + i] = Math.atan2(Math.sin(d0) + eta * Math.cos(d0), Math.hypot(xi, den)) / D2R;
  }
  return { ra, dec, n, scale, size, raG, decG };
}

// ------------------------------------------------------------------ FITS
async function range(key, start, end, signal, suffix) {
  const hdr = { Range: suffix ? `bytes=-${suffix}` : `bytes=${start}-${end}` };
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(S3 + key, { headers: hdr, signal });
      if (r.status === 404 || r.status === 403) { const e = new Error('missing'); e.missing = true; throw e; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.arrayBuffer();
    } catch (e) {
      if (e.name === 'AbortError' || e.missing) throw e;
      last = e; await new Promise(res => setTimeout(res, 400 * (attempt + 1)));
    }
  }
  throw last;
}

/** Parse one FITS header starting at byte `off`; returns its cards and where its data begins. */
function readHeader(bytes, off) {
  const cards = {}, td = new TextDecoder('ascii');
  let p = off;
  for (;;) {
    if (p + 80 > bytes.length) throw new Error('header truncated');
    const card = td.decode(bytes.subarray(p, p + 80)); p += 80;
    const key = card.slice(0, 8).trim();
    if (key === 'END') break;
    if (card[8] !== '=' || !key) continue;
    let v = card.slice(10);
    if (v.trimStart()[0] === "'") { const m = v.match(/'((?:[^']|'')*)'/); cards[key] = m ? m[1].trimEnd() : ''; continue; }
    v = v.split('/')[0].trim();
    cards[key] = v === 'T' ? true : v === 'F' ? false : Number(v.replace(/D/i, 'E'));
  }
  return { cards, next: off + Math.ceil((p - off) / BLOCK) * BLOCK };
}

// ------------------------------------------------------------------ astrometry (TAN + SIP)
function makeWcs(h) {
  const cd11 = (h.CD1_1 ?? (h.PC1_1 ?? 1) * (h.CDELT1 ?? 1)), cd12 = (h.CD1_2 ?? (h.PC1_2 ?? 0) * (h.CDELT1 ?? 1));
  const cd21 = (h.CD2_1 ?? (h.PC2_1 ?? 0) * (h.CDELT2 ?? 1)), cd22 = (h.CD2_2 ?? (h.PC2_2 ?? 1) * (h.CDELT2 ?? 1));
  const det = cd11 * cd22 - cd12 * cd21;
  const poly = prefix => {
    const order = h[`${prefix}_ORDER`] || 0, terms = [];
    for (let p = 0; p <= order; p++) for (let q = 0; q <= order - p; q++) {
      const c = h[`${prefix}_${p}_${q}`]; if (c) terms.push([p, q, c]);
    }
    return (u, v) => { let s = 0; for (const [p, q, c] of terms) s += c * Math.pow(u, p) * Math.pow(v, q); return s; };
  };
  const A = poly('A'), B = poly('B');
  const a0 = h.CRVAL1 * D2R, d0 = h.CRVAL2 * D2R, sd0 = Math.sin(d0), cd0 = Math.cos(d0);
  return {
    /** Sky (degrees) to zero-based pixel coordinates. */
    world2pix(ra, dec) {
      const a = ra * D2R, d = dec * D2R, da = a - a0, sd = Math.sin(d), cdd = Math.cos(d), cda = Math.cos(da);
      const cosc = sd0 * sd + cd0 * cdd * cda;
      if (cosc <= 0) return [NaN, NaN];
      const xi = cdd * Math.sin(da) / cosc / D2R, eta = (cd0 * sd - sd0 * cdd * cda) / cosc / D2R;
      const U = (cd22 * xi - cd12 * eta) / det, V = (-cd21 * xi + cd11 * eta) / det;
      let u = U, v = V;                              // undo the SIP distortion by fixed-point iteration
      for (let k = 0; k < 8; k++) { const nu = U - A(u, v), nv = V - B(u, v); u = nu; v = nv; }
      return [u + h.CRPIX1 - 1, v + h.CRPIX2 - 1];
    },
  };
}

// ------------------------------------------------------------------ wavelength table
const waveCache = new Map();
async function waveTable(key, det, f, signal) {
  const ck = `${det}|${f.prefix}|${key.split('/')[3]}`;
  if (!waveCache.has(ck)) {
    waveCache.set(ck, (async () => {
      const buf = new Uint8Array(await range(key, 0, 0, signal, 2 * BLOCK));
      const { cards } = readHeader(buf, 0);
      if (cards.EXTNAME !== 'WCS-WAVE') throw new Error('WCS-WAVE not at end of file');
      const nx = parseInt(cards.TFORM1, 10), ny = parseInt(cards.TFORM2, 10), dv = new DataView(buf.buffer, buf.byteOffset + BLOCK);
      const x = new Float64Array(nx), y = new Float64Array(ny), lam = new Float64Array(nx * ny), bw = new Float64Array(nx * ny);
      for (let i = 0; i < nx; i++) x[i] = dv.getInt32(4 * i, false);
      for (let j = 0; j < ny; j++) y[j] = dv.getInt32(4 * (nx + j), false);
      const o = 4 * (nx + ny);
      for (let k = 0; k < nx * ny; k++) { lam[k] = dv.getFloat32(o + 8 * k, false); bw[k] = dv.getFloat32(o + 8 * k + 4, false); }
      return { nx, ny, x, y, lam, bw };
    })());
    waveCache.get(ck).catch(() => waveCache.delete(ck));
  }
  return waveCache.get(ck);
}
function tableAt(t, arr, px, py) {       // bilinear lookup; px, py are 1-based detector pixels
  const find = (g, n, v) => { let i = 0; while (i < n - 2 && v > g[i + 1]) i++; return i; };
  const cx = Math.min(t.x[t.nx - 1], Math.max(t.x[0], px)), cy = Math.min(t.y[t.ny - 1], Math.max(t.y[0], py));
  const i = find(t.x, t.nx, cx), j = find(t.y, t.ny, cy);
  const tx = (cx - t.x[i]) / (t.x[i + 1] - t.x[i]), ty = (cy - t.y[j]) / (t.y[j + 1] - t.y[j]);
  const a = arr[j * t.nx + i], b = arr[j * t.nx + i + 1], c = arr[(j + 1) * t.nx + i], d = arr[(j + 1) * t.nx + i + 1];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// ------------------------------------------------------------------ one exposure
/** Cut out, resample and background-subtract one exposure. Null when it does not cover the stamp. */
export async function readFrame(f, grid, signal) {
  let key = null, head = null, lastErr = null;
  for (const k of f.keys) {
    try { head = new Uint8Array(await range(k, 0, HEAD_BYTES - 1, signal)); key = k; break; }
    catch (e) { if (e.name === 'AbortError') throw e; lastErr = e; }
  }
  if (!head) throw lastErr || new Error('exposure not found');
  const h1 = readHeader(head, 0), img = readHeader(head, h1.next), h = img.cards, dataOff = img.next;
  const wcs = makeWcs(h), n = grid.n, npx = n * n;
  const xs = new Float64Array(npx), ys = new Float64Array(npx);
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (let p = 0; p < npx; p++) {
    const [x, y] = wcs.world2pix(grid.raG[p], grid.decG[p]);
    if (!(x === x)) return null;
    xs[p] = x; ys[p] = y;
    if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
  }
  const x0 = Math.max(0, Math.floor(xmin) - 1), x1 = Math.min(NPIX, Math.ceil(xmax) + 2);
  const y0 = Math.max(0, Math.floor(ymin) - 1), y1 = Math.min(NPIX, Math.ceil(ymax) + 2);
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  // One contiguous byte range covering rows y0..y1-1, columns x0..x1-1.
  const first = y0 * NPIX + x0, last = (y1 - 1) * NPIX + x1;
  const dv = new DataView(await range(key, dataOff + 4 * first, dataOff + 4 * last - 1, signal));
  const w = x1 - x0, hgt = y1 - y0, cut = new Float32Array(w * hgt);
  for (let j = 0; j < hgt; j++) {
    const rowStart = ((y0 + j) * NPIX + x0 - first) * 4;
    for (let i = 0; i < w; i++) cut[j * w + i] = dv.getFloat32(rowStart + 4 * i, false);
  }
  // Bilinear resampling; anything touching a masked or missing pixel stays masked.
  const out = new Float32Array(npx);
  let good = 0;
  for (let p = 0; p < npx; p++) {
    const x = xs[p] - x0, y = ys[p] - y0, i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i + 1 >= w || j + 1 >= hgt) { out[p] = NaN; continue; }
    const tx = x - i, ty = y - j, q = j * w + i;
    const v = (cut[q] * (1 - tx) + cut[q + 1] * tx) * (1 - ty) + (cut[q + w] * (1 - tx) + cut[q + w + 1] * tx) * ty;
    out[p] = v; if (v === v) good++;
  }
  const cov = good / npx;
  if (cov < 0.2) return null;

  // Local sky (zodiacal light + residuals) as a clipped median.
  const vals = Float32Array.from(out.filter(v => v === v)).sort();
  const median = a => (a.length ? a[a.length >> 1] : 0);
  let med = median(vals), sig = 1.4826 * median(Float32Array.from(vals, v => Math.abs(v - med)).sort());
  for (let k = 0; k < 3; k++) {
    const keep = vals.filter(v => Math.abs(v - med) < 3 * Math.max(sig, 1e-6));
    if (keep.length < 10) break;
    med = median(keep); sig = 1.4826 * median(Float32Array.from(keep, v => Math.abs(v - med)).sort());
  }
  for (let p = 0; p < npx; p++) out[p] -= med;

  // Wavelength of every output pixel in this exposure, summarised as a plane.
  const t = await waveTable(key, f.det, f, signal), c = (n - 1) / 2;
  let s0 = 0, sx = 0, sy = 0, sxx = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const p = j * n + i, lam = tableAt(t, t.lam, xs[p] + 1, ys[p] + 1);
    s0 += lam; sx += lam * (i - c); sy += lam * (j - c); sxx += (i - c) * (i - c);
  }
  const pc = Math.floor(n / 2) * n + Math.floor(n / 2);
  return {
    id: f.id, det: f.det, coll: f.coll, mjd: h['MJD-AVG'] ?? f.mjd, date: String(h['DATE-AVG'] || '').slice(0, 19),
    exp: h.XPOSURE ?? h.EXPTIME ?? null, url: IBE + key,
    lam: s0 / npx, lgx: sx / sxx, lgy: sy / sxx, bw: tableAt(t, t.bw, xs[pc] + 1, ys[pc] + 1),
    bg: med, sig, cov, fwhm: +(h.PSF_FWHM || 0).toFixed(2), px: [+xs[pc].toFixed(1), +ys[pc].toFixed(1)], data: out,
  };
}

// ------------------------------------------------------------------ stream for one detector
/**
 * Same message shapes as the pre-built showcase files, delivered through `emit`:
 *   { t: 'head', ... }   then   { t: 'frame', ..., data: Float32Array }   then   { t: 'done' }
 */
export async function stream(ra, dec, sizeArcmin, det, emit, signal, found) {
  const all = found || await findFrames(ra, dec, signal);
  const avail = {};
  for (let d = 1; d <= 6; d++) avail[d] = all.filter(f => f.det === d).length;
  const releases = {};
  for (const f of all) releases[f.coll] = (releases[f.coll] || 0) + 1;
  const mine = all.filter(f => f.det === det).sort((a, b) => a.dist - b.dist);
  // Exposures centred far from the target may not actually cover it; prefer the sure ones when thinning.
  const sure = mine.filter(f => f.dist <= 1.7), maybe = mine.filter(f => f.dist > 1.7);
  const use = thin([...sure, ...maybe].sort((a, b) => a.mjd - b.mjd), MAX_PER_DET);
  const grid = makeGrid(ra, dec, sizeArcmin);
  emit({ t: 'head', det, grid: { ra: grid.ra, dec: grid.dec, n: grid.n, scale: grid.scale, size: grid.size }, band: DET_BANDS[det],
    total: all.length, avail, releases, epochs: epochsOf(all.map(f => f.mjd)), use: use.length, found: mine.length, estimated: true });
  let n = 0, skipped = 0, failed = 0, next = 0;
  const worker = async () => {
    while (next < use.length) {
      const f = use[next++];
      try {
        const r = await readFrame(f, grid, signal);
        if (r) { n++; emit({ t: 'frame', ...r }); } else { skipped++; emit({ t: 'skip' }); }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        failed++; emit({ t: 'skip' });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  emit({ t: 'done', n, skipped, failed });
}
