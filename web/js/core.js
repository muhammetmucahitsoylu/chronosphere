// Data loading, sky geometry and image maths. No DOM in here.

import { locale } from './lang.js';
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

const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
function toHalf(v) {
  if (v !== v) return 0x7e00;
  f32[0] = v;
  const x = u32[0], s = (x >>> 16) & 0x8000, e = ((x >>> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) return e < -10 ? s : s | (((m | 0x800000) >>> (1 - e)) + 0x1000 >>> 13);
  if (e >= 31) return s | 0x7c00;
  const h = s | (e << 10) | ((m + 0x1000) >>> 13);
  return h;
}
/** Float32Array -> base64 of little-endian float16 (the storage format of image stamps). */
export function encodeF16(arr) {
  let bin = '';
  for (let i = 0; i < arr.length; i++) { const h = toHalf(arr[i]); bin += String.fromCharCode(h & 255, (h >> 8) & 255); }
  return btoa(bin);
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
// Month names in the language of the page. English keeps its own fixed list.
const MONTHS = locale === 'en' ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : Array.from({ length: 12 }, (_, m) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2021, m, 15))));
/** A short date range: "21–30 Aug 2025", "21 Aug – 3 Sep 2025", "21 Dec 2025 – 3 Jan 2026". */
export function fmtRange(mjd0, mjd1) {
  const a = mjdToDate(mjd0), b = mjdToDate(mjd1), M = MONTHS;
  const d = x => x.getUTCDate(), m = x => M[x.getUTCMonth()], y = x => x.getUTCFullYear();
  if (y(a) !== y(b)) return `${d(a)} ${m(a)} ${y(a)} – ${d(b)} ${m(b)} ${y(b)}`;
  if (m(a) !== m(b)) return `${d(a)} ${m(a)} – ${d(b)} ${m(b)} ${y(b)}`;
  return d(a) === d(b) ? `${d(a)} ${m(a)} ${y(a)}` : `${d(a)}–${d(b)} ${m(b)} ${y(b)}`;
}
const MONTH_YEAR = new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
export function fmtMonth(mjd) {
  return MONTH_YEAR.format(mjdToDate(mjd));
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
/**
 * "Today", for working out where a moving star is now: the middle of the current month. A position,
 * and with it everything kept on the device for that position, then stays the same all month. The
 * price is under half an arcsecond for the fastest star in the sky, a twelfth of a SPHEREx pixel.
 */
export const epochNow = () => { const d = new Date(); return d.getUTCFullYear() + (d.getUTCMonth() + 0.5) / 12; };
export function propagate(src, epoch0, year) {
  const dt = year - epoch0;
  return [src.ra + (src.pmra || 0) * dt / 3.6e6 / Math.max(Math.cos(src.dec * rad), 1e-6), src.dec + (src.pmdec || 0) * dt / 3.6e6];
}
/**
 * Parallax: the yearly wobble of a nearby star caused by the Earth's trip around the Sun.
 * Returns the offset [east, north] in arcseconds at a given date for a parallax in milliarcseconds.
 * The Earth's position comes from the low-precision solar formulae of the Astronomical Almanac,
 * good to about 0.01 degrees: far better than a SPHEREx pixel needs.
 */
export function parallaxOffset(raDeg, decDeg, plxMas, mjd) {
  const n = mjd - 51544.5, g = (357.528 + 0.9856003 * n) * rad, q = 280.459 + 0.98564736 * n;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const eps = (23.439 - 0.00000036 * n) * rad;
  // Earth's position as seen from the Sun (equatorial axes, astronomical units) is minus the Sun's as seen from Earth.
  const X = -R * Math.cos(L), Y = -R * Math.cos(eps) * Math.sin(L), Z = -R * Math.sin(eps) * Math.sin(L);
  const a = raDeg * rad, d = decDeg * rad, p = plxMas / 1000;
  return [p * (X * Math.sin(a) - Y * Math.cos(a)), p * (X * Math.cos(a) * Math.sin(d) + Y * Math.sin(a) * Math.sin(d) - Z * Math.cos(d))];
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
  const data = frames.map(f => f.data);
  for (let p = 0; p < npx; p++) {
    let m = 0;
    for (let k = 0; k < K; k++) {
      const v = data[k][p];
      if (v !== v) continue;
      let i = m++;                                // insert in order: the list is short, so this beats sorting it afterwards
      while (i > 0 && buf[i - 1] > v) { buf[i] = buf[i - 1]; i--; }
      buf[i] = v;
    }
    if (m < need) { out[p] = NaN; continue; }
    out[p] = m & 1 ? buf[m >> 1] : 0.5 * (buf[m / 2 - 1] + buf[m / 2]);
  }
  return out;
}
export function robustStats(a) {
  let m = 0; const v = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) { const x = a[i]; if (x === x) v[m++] = x; }
  if (!m) return { med: 0, sig: 1, p: () => 1 };
  const s = v.subarray(0, m).sort();            // typed arrays sort by value
  const q = f => s[Math.min(m - 1, Math.max(0, Math.round(f * (m - 1))))];
  const med = q(0.5), dev = new Float64Array(m);
  for (let i = 0; i < m; i++) dev[i] = Math.abs(s[i] - med);
  dev.sort();
  return { med, sig: Math.max(1.4826 * dev[m >> 1], 1e-6), p: q };
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

/** Centroid that re-centres its window on what it finds, so that a source which has moved most of
 *  a window away from the starting point is still located without bias. */
export function locate(img, n, x, y, r = 3) {
  let m = centroid(img, n, x, y, r);
  for (let i = 0; i < 3 && m; i++) {
    const next = centroid(img, n, m.x, m.y, r);
    if (!next || Math.hypot(next.x - m.x, next.y - m.y) < 0.02) break;
    m = next;
  }
  return m;
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
  // Uncertainty, calibrated on how much real stars scatter from one exposure to the next:
  // the pixels of a resampled stamp are not independent, which makes the plain sum of variances
  // too small by a factor of about 2.4 (faint stars); and no star repeats better than about 3.5%,
  // because SPHEREx images are undersampled (bright stars).
  const flux = (sum - bg * nap) * omega, noise = 2.4 * sigma * Math.sqrt(nap + nap * nap / sky.length) * omega;
  return { flux, err: Math.hypot(noise, 0.035 * flux) };
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

/** Number of masked pixels inside the measurement aperture (saturated cores are masked). */
export function coreMasked(img, n, scale, x, y, rApArcsec = 9.2) {
  const ra = rApArcsec / scale, R = Math.ceil(ra), x0 = Math.round(x), y0 = Math.round(y);
  let bad = 0;
  for (let j = y0 - R; j <= y0 + R; j++) for (let i = x0 - R; i <= x0 + R; i++) {
    if (i < 0 || j < 0 || i >= n || j >= n) continue;
    if (Math.hypot(i - x, j - y) <= ra && img[j * n + i] !== img[j * n + i]) bad++;
  }
  return bad;
}

/** Photometry for saturated stars: median surface brightness in a ring of the outer halo,
 *  which scales with the star's brightness even when the core is saturated. Masked pixels
 *  and neighbouring stars are tolerated by the median. Relative units. */
export function halo(img, n, scale, x, y, sigma, r1 = 21, width = 15) {
  const a = r1 / scale, b = (r1 + width) / scale, c = b + 30 / scale, d = c + 20 / scale, R = Math.ceil(d);
  const x0 = Math.round(x), y0 = Math.round(y);
  const ring = [], sky = []; let nr = 0;
  for (let j = y0 - R; j <= y0 + R; j++) for (let i = x0 - R; i <= x0 + R; i++) {
    const dist = Math.hypot(i - x, j - y);
    if (dist < a || dist > d || (dist > b && dist < c)) continue;
    const v = (i >= 0 && j >= 0 && i < n && j < n) ? img[j * n + i] : NaN;
    if (dist <= b) { nr++; if (v === v) ring.push(v); }
    else if (v === v) sky.push(v);
  }
  const valid = nr ? ring.length / nr : 0;
  if (ring.length < 20 || sky.length < 30) return { valid, flux: NaN };
  ring.sort((p, q) => p - q); sky.sort((p, q) => p - q);
  const bg = sky[Math.floor(sky.length * 0.3)];      // lower quantile: the halo still reaches the sky ring
  const omega = (scale / ARCSEC) ** 2 * 1e9;
  // Halo measurements of one star scatter by 5 to 35% between exposures, whatever the photon noise says.
  const flux = (ring[ring.length >> 1] - bg) * nr * omega;
  return { valid, flux, err: Math.hypot(2.4 * sigma * 1.25 * Math.sqrt(nr) * omega, 0.15 * flux), halo: true };
}

/**
 * A saturated star is measured from its outer halo. That follows the shape of its spectrum within
 * one detector, but not its level: the halo of an overloaded star does not scale simply with its
 * brightness. So each such detector is scaled to join the neighbouring detector where their
 * wavelength ranges meet, working outward from the detectors that were measured normally.
 * Returns { det: factor } for the halo detectors. If every detector is saturated the chain starts
 * from the one with the most measurements, and the overall level stays arbitrary.
 */
export function stitchScales(pts) {
  const dets = [...new Set(pts.map(p => p.det))].sort((a, b) => a - b);
  const haloDets = new Set(pts.filter(p => p.halo).map(p => p.det));
  const scale = {};
  if (!haloDets.size) return scale;
  const med = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  // Level of one detector's spectrum at a boundary wavelength: a straight line in log-log through
  // the third of its points nearest that boundary.
  const edge = (det, lamB) => {
    const v = pts.filter(p => p.det === det && p.flux > 0).sort((a, b) => Math.abs(a.lam - lamB) - Math.abs(b.lam - lamB));
    const near = v.slice(0, Math.max(8, Math.ceil(v.length * 0.33)));
    if (near.length < 6) return NaN;
    const a = near.slice(0, near.length >> 1), b = near.slice(near.length >> 1);
    const xa = med(a.map(p => Math.log(p.lam))), ya = med(a.map(p => Math.log(p.flux)));
    const xb = med(b.map(p => Math.log(p.lam))), yb = med(b.map(p => Math.log(p.flux)));
    if (Math.abs(xb - xa) < 1e-4) return Math.exp(ya);
    const slope = Math.max(-6, Math.min(6, (yb - ya) / (xb - xa)));
    return Math.exp(ya + slope * (Math.log(lamB) - xa));
  };
  const done = new Set(dets.filter(d => !haloDets.has(d)));
  if (!done.size) {                                      // nothing to anchor on: keep the best-sampled detector as it is
    const start = dets.reduce((best, d) => (pts.filter(p => p.det === d).length > pts.filter(p => p.det === best).length ? d : best), dets[0]);
    scale[start] = 1; done.add(start);
  }
  for (let pass = 0; pass < 6; pass++) {
    for (const d of dets) {
      if (done.has(d)) continue;
      const est = [];
      for (const nb of [d - 1, d + 1]) {
        if (!done.has(nb)) continue;
        const lamB = nb < d ? DET_BANDS[d][0] : DET_BANDS[d][1];
        const mine = edge(d, lamB), theirs = edge(nb, lamB) * (scale[nb] ?? 1);
        if (mine > 0 && theirs > 0) est.push(theirs / mine);
      }
      if (!est.length) continue;
      scale[d] = Math.exp(est.reduce((s, x) => s + Math.log(x), 0) / est.length);
      done.add(d);
    }
  }
  return scale;
}

/** Split long, continuously observed seasons into roughly monthly pieces. */
export function refineEpochs(eps, maxDays = 60, chunkDays = 40) {
  const out = [];
  for (const [t0, t1] of eps) {
    const span = t1 - t0;
    if (span <= maxDays) { out.push([t0, t1]); continue; }
    const k = Math.ceil(span / chunkDays), step = span / k;
    for (let i = 0; i < k; i++) out.push([t0 + i * step, i === k - 1 ? t1 : t0 + (i + 1) * step - 1e-6]);
  }
  return out;
}

// ---------- molecular absorption bands ----------
/** Wavelength ranges where common molecules absorb, with comparison windows on either side. */
export const MOLECULES = [
  // Comparison windows stay clear of detector edges, where sensitivity drops and
  // measurements scatter; each band is compared with clean spectrum on both sides.
  { name: 'Water vapour', f: 'H₂O', band: [1.34, 1.48], side: [[1.22, 1.31], [1.55, 1.62]] },
  { name: 'Water vapour', f: 'H₂O', band: [1.80, 1.98], side: [[1.68, 1.75], [2.05, 2.15]], glow: 'Hydrogen gas (Paschen α)' },
  { name: 'Carbon monoxide, methane', f: 'CO, CH₄', band: [2.28, 2.38], side: [[2.05, 2.18], null] },
  // Beyond 3.5 microns a cold object's spectrum climbs steeply towards its 4-micron peak, so the
  // long-wavelength comparison window sits on that peak, where the spectrum is level again.
  { name: 'Water vapour', f: 'H₂O', band: [2.55, 2.85], side: [[2.05, 2.18], [3.90, 4.10]] },
  // In a cold atmosphere this dip is methane gas; towards a young star inside a cloud it is water ice.
  { name: 'Methane, or water ice', f: 'CH₄', band: [3.15, 3.50], side: [[2.05, 2.18], [3.90, 4.10]], glow: 'Carbon-rich dust (PAH)' },
  { name: 'Carbon dioxide, gas or ice', f: 'CO₂', band: [4.20, 4.33], side: [[4.05, 4.15], [4.46, 4.54]] },
  { name: 'Carbon monoxide', f: 'CO', band: [4.56, 4.80], side: [[4.46, 4.54], [4.90, 4.98]], glow: 'Hydrogen gas (Pfund β)' },
];

function medMad(v) {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), med = s[s.length >> 1];
  const dev = s.map(x => Math.abs(x - med)).sort((a, b) => a - b);
  return { med, err: 1.4826 * dev[dev.length >> 1] / Math.sqrt(v.length), n: v.length };
}
/** Depth of each band relative to the spectrum on either side (1 = fully absorbed, 0 = flat). */
export function bandDepths(pts) {
  const inRange = r => pts.filter(p => !p.halo && p.lam >= r[0] && p.lam <= r[1]).map(p => p.flux);
  return MOLECULES.map(m => {
    if (pts.some(p => p.halo && p.lam >= m.band[0] && p.lam <= m.band[1])) return { ...m, depth: null, why: 'star too bright to tell' };
    const core = medMad(inRange(m.band));
    const sides = m.side.map(r => (r ? { c: (r[0] + r[1]) / 2, ...(medMad(inRange(r)) || { n: 0 }) } : { n: 0 })).filter(x => x.n >= 4);
    if (!core || core.n < 5 || sides.length < m.side.filter(Boolean).length) return { ...m, depth: null };
    const mid = (m.band[0] + m.band[1]) / 2;
    let cont, cerr;
    if (sides.length === 2 && sides[0].med > 0 && sides[1].med > 0) {
      // Interpolate the surroundings as a power law (straight line in log-log), so the
      // smooth downward slope of an ordinary star's spectrum is not mistaken for a dip.
      const t = Math.log(mid / sides[0].c) / Math.log(sides[1].c / sides[0].c);
      cont = Math.exp(Math.log(sides[0].med) * (1 - t) + Math.log(sides[1].med) * t);
      cerr = cont * Math.hypot(sides[0].err / sides[0].med * (1 - t), sides[1].err / sides[1].med * t);
    } else { const sd = sides.find(x => x.med > 0); if (!sd) return { ...m, depth: null }; cont = sd.med; cerr = sd.err; }
    if (!(cont > 0) || cont < 12 * cerr) {
      // Not clear enough: either the spot is faint, or it is bright but its measurements disagree.
      const near = pts.filter(p => !p.halo && p.err > 0 && p.lam >= m.band[0] - 0.3 && p.lam <= m.band[1] + 0.3).map(p => p.flux / p.err).sort((a, b) => a - b);
      return { ...m, depth: null, why: near.length && near[near.length >> 1] > 10 ? 'too uneven to tell' : 'too faint to tell' };
    }
    return { ...m, depth: 1 - core.med / cont, err: Math.hypot(core.err, cerr * core.med / cont) / cont };
  });
}
