// Data loading, sky geometry and image maths. No DOM in here.

export const ARCSEC = 206264.806;
export const EPOCH_COLORS = ['#4cc9f0', '#ff5d8f', '#ffd166', '#06d6a0', '#b388ff', '#ff9f1c', '#9ef01a', '#f4a261'];
export const DET_BANDS = { 1: [0.75, 1.11], 2: [1.11, 1.64], 3: [1.64, 2.42], 4: [2.42, 3.82], 5: [3.82, 4.42], 6: [4.42, 5.0] };

// ---------- binary decoding ----------
const F16 = new Float32Array(65536);
for (let h = 0; h < 65536; h++) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, f = h & 0x3ff;
  F16[h] = e === 0 ? s * f * 5.960464477539063e-8 : e === 31 ? (f ? NaN : s * Infinity) : s * (1 + f / 1024) * Math.pow(2, e - 15);
}
export function decodeF16(b64) {
  const bin = atob(b64), n = bin.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = F16[bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)];
  return out;
}

// ---------- NDJSON stream ----------
export async function loadStream(url, onLine, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (line.trim()) onLine(JSON.parse(line));
    }
  }
  if (buf.trim()) onLine(JSON.parse(buf));
}

// ---------- time ----------
export const mjdToYear = mjd => 2000 + (mjd - 51544.5) / 365.25;
export const mjdToDate = mjd => new Date((mjd - 40587) * 86400000);
export function fmtDate(mjd, withTime = false) {
  const d = mjdToDate(mjd).toISOString();
  return withTime ? d.slice(0, 16).replace('T', ' ') + ' UTC' : d.slice(0, 10);
}
export function fmtMonth(mjd) {
  return mjdToDate(mjd).toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ---------- sky geometry (tangent plane, north up, east left) ----------
const rad = Math.PI / 180;
export function skyToGrid(g, ra, dec) {
  const a0 = g.ra * rad, d0 = g.dec * rad, a = ra * rad, d = dec * rad, da = a - a0;
  const D = Math.sin(d0) * Math.sin(d) + Math.cos(d0) * Math.cos(d) * Math.cos(da);
  const xi = Math.cos(d) * Math.sin(da) / D * ARCSEC;
  const eta = (Math.cos(d0) * Math.sin(d) - Math.sin(d0) * Math.cos(d) * Math.cos(da)) / D * ARCSEC;
  const c = (g.n - 1) / 2;
  return [c - xi / g.scale, c + eta / g.scale];
}
export function gridToSky(g, x, y) {
  const c = (g.n - 1) / 2, xi = -(x - c) * g.scale / ARCSEC, eta = (y - c) * g.scale / ARCSEC;
  const d0 = g.dec * rad, rho = Math.hypot(xi, eta);
  if (rho === 0) return [g.ra, g.dec];
  const cc = Math.atan(rho), dec = Math.asin(Math.cos(cc) * Math.sin(d0) + eta * Math.sin(cc) * Math.cos(d0) / rho);
  const ra = g.ra * rad + Math.atan2(xi * Math.sin(cc), rho * Math.cos(d0) * Math.cos(cc) - eta * Math.sin(d0) * Math.sin(cc));
  return [((ra / rad) % 360 + 360) % 360, dec / rad];
}
/** Position of a catalogue source at a given year (linear proper motion, mas/yr). */
export function propagate(src, epoch0, year) {
  const dt = year - epoch0;
  return [src.ra + (src.pmra || 0) * dt / 3.6e6 / Math.max(Math.cos(src.dec * rad), 1e-6), src.dec + (src.pmdec || 0) * dt / 3.6e6];
}
export function fmtSex(ra, dec) {
  const h = ra / 15, hh = Math.floor(h), mm = Math.floor((h - hh) * 60), ss = ((h - hh) * 60 - mm) * 60;
  const sg = dec < 0 ? '-' : '+', a = Math.abs(dec), dd = Math.floor(a), dm = Math.floor((a - dd) * 60), ds = ((a - dd) * 60 - dm) * 60;
  const p = (v, n = 2) => String(v).padStart(n, '0');
  return `${p(hh)}h${p(mm)}m${p(ss.toFixed(2), 5)}s ${sg}${p(dd)}d${p(dm)}m${p(ds.toFixed(1), 4)}s`;
}
/** Parse "ra dec" in decimal degrees or sexagesimal (RA in hours). Returns null for a name. */
export function parseCoords(text) {
  const t = text.trim().replace(/,/g, ' ');
  let m = t.match(/^([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)$/);
  if (m) { const ra = +m[1], dec = +m[2]; return (ra >= 0 && ra < 360 && Math.abs(dec) <= 90) ? { ra, dec } : null; }
  const num = '(\\d+(?:\\.\\d+)?)', sep = '\\s*[hd:°\\s]\\s*', sep2 = "\\s*[m:'′\\s]\\s*", end = '\\s*(?:s|"|″)?';
  const re = new RegExp(`^${num}${sep}${num}${sep2}${num}${end}\\s*[,\\s]\\s*([+-]?)${num}${sep}${num}${sep2}${num}${end}$`, 'i');
  m = t.match(re);
  if (m) {
    const ra = (+m[1] + m[2] / 60 + m[3] / 3600) * 15, dec = (m[4] === '-' ? -1 : 1) * (+m[5] + m[6] / 60 + m[7] / 3600);
    return (ra < 360 && Math.abs(dec) <= 90) ? { ra, dec } : null;
  }
  return null;
}

// ---------- epochs ----------
/** Split time-sorted frames into observing seasons (gaps longer than gapDays). */
export function splitEpochs(frames, gapDays = 30) {
  const eps = [];
  for (const f of frames) {
    const last = eps[eps.length - 1];
    if (last && f.mjd - last.t1 <= gapDays) { last.frames.push(f); last.t1 = f.mjd; }
    else eps.push({ t0: f.mjd, t1: f.mjd, frames: [f] });
  }
  eps.forEach((e, i) => { e.i = i; e.mid = (e.t0 + e.t1) / 2; e.frames.forEach(f => f.epoch = i); });
  return eps;
}

// ---------- image maths ----------
/** Per-pixel median of many frames, ignoring masked (NaN) pixels. */
export function medianStack(frames, npx) {
  const out = new Float32Array(npx), K = frames.length, buf = new Float32Array(K);
  const need = Math.max(1, Math.min(3, Math.ceil(K * 0.3)));
  for (let p = 0; p < npx; p++) {
    let m = 0;
    for (let k = 0; k < K; k++) { const v = frames[k].data[p]; if (v === v) buf[m++] = v; }
    if (m < need) { out[p] = NaN; continue; }
    const s = buf.subarray(0, m).sort();
    out[p] = m & 1 ? s[m >> 1] : 0.5 * (s[m / 2 - 1] + s[m / 2]);
  }
  return out;
}
export function robustStats(a) {
  const v = Array.from(a).filter(x => x === x).sort((x, y) => x - y);
  if (!v.length) return { med: 0, sig: 1, p: () => 1 };
  const q = f => v[Math.min(v.length - 1, Math.max(0, Math.round(f * (v.length - 1))))];
  const med = q(0.5), dev = v.map(x => Math.abs(x - med)).sort((x, y) => x - y);
  return { med, sig: Math.max(1.4826 * dev[dev.length >> 1], 1e-6), p: q };
}
export function subtract(a, b) {
  const o = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] - b[i];
  return o;
}

/** Brightness-weighted centroid in a small box; falls back to the input position. */
export function centroid(img, n, x, y, r = 3) {
  const x0 = Math.round(x), y0 = Math.round(y);
  const vals = [];
  for (let j = y0 - r - 3; j <= y0 + r + 3; j++) for (let i = x0 - r - 3; i <= x0 + r + 3; i++) {
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    const v = img[j * n + i]; if (v === v) vals.push(v);
  }
  if (vals.length < 10) return null;
  vals.sort((a, b) => a - b);
  const bg = vals[vals.length >> 1];
  let sw = 0, sx = 0, sy = 0, peak = -Infinity;
  for (let j = y0 - r; j <= y0 + r; j++) for (let i = x0 - r; i <= x0 + r; i++) {
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    if (Math.hypot(i - x, j - y) > r + 0.5) continue;
    const v = img[j * n + i] - bg; if (!(v > 0)) continue;
    sw += v; sx += v * i; sy += v * j; if (v > peak) peak = v;
  }
  if (!(sw > 0)) return null;
  return { x: sx / sw, y: sy / sw, peak, flux: sw };
}

/** Aperture photometry in mJy. Returns null when the aperture touches masked pixels. */
export function aperture(img, n, scale, x, y, sigma, rApArcsec = 9.2, rIn = 18, rOut = 30) {
  const ra = rApArcsec / scale, ri = rIn / scale, ro = rOut / scale, R = Math.ceil(ro);
  const x0 = Math.round(x), y0 = Math.round(y);
  if (x0 - R < 0 || y0 - R < 0 || x0 + R >= n || y0 + R >= n) {
    if (x0 - ra < 0 || y0 - ra < 0 || x0 + ra >= n || y0 + ra >= n) return null;
  }
  let sum = 0, nap = 0, bad = 0; const sky = [];
  for (let j = y0 - R; j <= y0 + R; j++) for (let i = x0 - R; i <= x0 + R; i++) {
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    const d = Math.hypot(i - x, j - y), v = img[j * n + i];
    if (d <= ra) { if (v === v) { sum += v; nap++; } else bad++; }
    else if (d >= ri && d <= ro && v === v) sky.push(v);
  }
  if (bad > 0 || nap < 3 || sky.length < 8) return null;
  sky.sort((a, b) => a - b);
  const bg = sky[sky.length >> 1];
  const omega = (scale / ARCSEC) ** 2 * 1e9;      // MJy/sr per pixel -> mJy
  return { flux: (sum - bg * nap) * omega, err: sigma * Math.sqrt(nap + nap * nap / sky.length) * omega };
}

/** Median spectrum on a log-wavelength grid; used as the reference for variability. */
export function referenceSpectrum(pts, step = 0.012) {
  const bins = new Map();
  for (const p of pts) {
    const k = Math.round(Math.log(p.lam) / step);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(p.flux);
  }
  const xs = [], ys = [];
  [...bins.keys()].sort((a, b) => a - b).forEach(k => {
    const v = bins.get(k).sort((a, b) => a - b);
    xs.push(Math.exp(k * step)); ys.push(v[v.length >> 1]);
  });
  return lam => {
    if (!xs.length) return NaN;
    if (lam <= xs[0]) return ys[0];
    if (lam >= xs[xs.length - 1]) return ys[ys.length - 1];
    let i = 1; while (xs[i] < lam) i++;
    const t = (lam - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[i - 1] * (1 - t) + ys[i] * t;
  };
}

/** Masked pixels that sit inside a very bright star are saturation, not missing sky.
 *  Returns a mask (1 = saturated core) grown outward from bright neighbours. */
export function saturatedMask(img, n, thresh) {
  const m = new Uint8Array(n * n);
  let changed = true, pass = 0;
  while (changed && pass++ < 12) {
    changed = false;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const p = j * n + i;
      if (m[p] || img[p] === img[p]) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const q = y * n + x;
        if (m[q] || img[q] > thresh) { m[p] = 1; changed = true; break; }
      }
    }
  }
  return m;
}
