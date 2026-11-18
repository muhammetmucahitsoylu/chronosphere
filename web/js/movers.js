// Dots that are not always there: asteroids, comets, dwarf planets passing through a field.
//
// SPHEREx stops, takes up to four exposures two minutes apart while stepping the field across its
// filters, and moves on. Two of its six detectors look at the same sky at the same moment (D1 with D4,
// D2 with D5, D3 with D6). A body of the solar system is therefore caught, within a few minutes, in up to
// eight independent images at one place in the sky, and is gone from that place when the telescope
// returns hours or days later. A cosmic-ray hit is in one image only. Charge left in a detector by a
// bright star of the exposure before does come back to one place in the sky, but at every stop of a
// visit, and never in the first exposure of a stop. So the test is:
//
//   1. For every detector, the sky as it is when nothing is passing: what all visits to the field have
//      in common (where there is only one visit, the level a third of its exposures stay below).
//   2. In every exposure, dots that stand out against that.
//   3. A sighting: dots away from the stars, at one place in the sky at two or more moments of one stop
//      or in both detectors of a pair at one moment, confirmed by the other exposures of that stop and
//      absent from that place on other days, also in exposures of the very same colour.
//   4. A track: sightings that a steady motion joins, carried on through the stops where the body was
//      in front of a star or was caught in one exposure only.
//
// No DOM in here; the same code runs in the page and in the test scripts.
import { robustStats, centroid, aperture } from './core.js';

/** The stop of the telescope an exposure belongs to: "2025W41_1A_0122_3" is the third exposure of stop "2025W41_1A_0122". */
export const stopOf = id => String(id).slice(0, String(id).lastIndexOf('_'));
const subOf = id => +String(id).slice(String(id).lastIndexOf('_') + 1);
const PARTNER = { 1: 4, 4: 1, 2: 5, 5: 2, 3: 6, 6: 3 };
const YES = 2.5;          // an exposure "says yes" at a place when it is this many times its noise brighter there than the calm sky
const STAR_SNR = 15;      // in front of a star the sky is less even: there a dot has to be this strong to count towards a sighting

/** Per pixel, the value at a given rank among the exposures (0 = lowest, 0.5 = median, 1 = highest). NaN where fewer than `need` have the pixel. */
function rankStack(frames, npx, ranks, need) {
  const K = frames.length, data = frames.map(f => f.data), buf = new Float32Array(K), out = ranks.map(() => new Float32Array(npx));
  for (let p = 0; p < npx; p++) {
    let m = 0;
    for (let k = 0; k < K; k++) {
      const v = data[k][p];
      if (v !== v) continue;
      let i = m++;
      while (i > 0 && buf[i - 1] > v) { buf[i] = buf[i - 1]; i--; }
      buf[i] = v;
    }
    for (let r = 0; r < ranks.length; r++) out[r][p] = m < need ? NaN : buf[Math.min(m - 1, Math.round(ranks[r] * (m - 1)))];
  }
  return out;
}
const thinned = (frames, max) => (frames.length > max ? frames.filter((_, i) => i % Math.ceil(frames.length / max) === 0) : frames);
/** Mean of the valid pixels in each 3 x 3 box; NaN where the middle pixel or more than three others are missing. */
function box3(a, n) {
  const out = new Float32Array(n * n).fill(NaN);
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const p = y * n + x;
    if (a[p] !== a[p]) continue;
    let s = 0, k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = a[p + dy * n + dx]; if (v === v) { s += v; k++; } }
    if (k >= 6) out[p] = s / k;
  }
  return out;
}
/**
 * The sky of one detector with nothing passing (`calm`), and where its stars are (`mask`).
 * With two or more visits to the field: per pixel, the faintest of the visits' own medians. A star is in all of them;
 * a body that lingers through one visit is not. With one visit only: the level 30% of its exposures stay below, and
 * as stars whatever 70% of them show, so that a body which stays put for most of the visit cannot be told from a star.
 */
function calmSky(frames, n) {
  const npx = n * n, visits = [];
  for (const f of frames) {                                 // frames come in time order
    const last = visits[visits.length - 1];
    if (last && f.mjd - last[last.length - 1].mjd <= 20) last.push(f); else visits.push([f]);
  }
  const full = visits.filter(v => v.length >= 5);
  let calm, often;
  if (full.length >= 2) {
    calm = new Float32Array(npx).fill(NaN);
    for (const v of full) {
      const [med] = rankStack(thinned(v, 40), npx, [0.5], 3);
      for (let p = 0; p < npx; p++) { const x = med[p]; if (x === x && !(calm[p] <= x)) calm[p] = x; }
    }
    often = calm;
  } else {
    [calm, often] = rankStack(thinned(frames, 60), npx, [0.3, 0.7], 5);
  }
  // stars: wherever the sky is usually brighter than empty sky, and one pixel around that
  const sm = box3(often, n), st = robustStats(sm), lim = st.med + 4 * st.sig, core = new Uint8Array(npx), mask = new Uint8Array(npx);
  for (let p = 0; p < npx; p++) if (sm[p] !== sm[p] || sm[p] > lim) core[p] = 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let on = 0;
    for (let dy = -1; dy <= 1 && !on; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = x + dx, j = y + dy;
      if (i >= 0 && j >= 0 && i < n && j < n && core[j * n + i]) { on = 1; break; }
    }
    mask[y * n + x] = on;
  }
  // stars so bright that their middle is missing: their glare reaches far
  const glare = [];
  for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) {
    const p = y * n + x;
    if (often[p] === often[p]) continue;
    if ([often[p - 1], often[p + 1], often[p - n], often[p + n]].some(u => u > 120 * st.sig)) glare.push([x, y]);
  }
  return { calm, mask, glare };
}

/**
 * Every dot of every exposure that stands out against the calm sky of its detector.
 * frames: [{ id, det, mjd, data, sig, lam }] of one detector, in time order. Each frame also gets `seen(x, y)`:
 * how strongly it shows something at a place, in units of its own noise; null where it did not look.
 */
function dotsOf(frames, grid, minSnr) {
  const n = grid.n, npx = n * n, dots = [];
  if (frames.length < 6) return { dots, calm: null };
  const { calm, mask, glare } = calmSky(frames, n), R = new Float32Array(npx), edge = 5;
  for (const f of frames) {
    for (let p = 0; p < npx; p++) R[p] = f.data[p] - calm[p];
    const S = box3(R, n);
    // how much the empty sky of this exposure scatters, in the same measure
    const v = [];
    for (let p = 0; p < npx; p += 3) if (!mask[p] && S[p] === S[p]) v.push(S[p]);
    if (v.length < 200) continue;
    const st = robustStats(v), lim = st.med + minSnr * st.sig, limStar = st.med + 8 * st.sig;
    for (let y = edge; y < n - edge; y++) for (let x = edge; x < n - edge; x++) {
      const p = y * n + x, s = S[p];
      if (!(s > lim) || (mask[p] && !(s > limStar))) continue;          // in front of a star the sky is less even: only a strong dot counts there
      let top = true;
      for (let dy = -2; dy <= 2 && top; dy++) for (let dx = -2; dx <= 2; dx++) {
        const q = p + dy * n + dx, w = S[q];
        if (f.data[q] !== f.data[q]) { top = false; break; }           // a pixel the pipeline masked right beside it: not a clean dot
        if ((dx || dy) && w > s) { top = false; break; }
      }
      if (!top) continue;
      if (glare.some(([gx, gy]) => Math.hypot(gx - x, gy - y) * grid.scale < 90)) continue;
      const c = centroid(R, n, x, y, 2), cx = c ? c.x : x, cy = c ? c.y : y;
      const ap = aperture(R, n, grid.scale, cx, cy, f.sig);
      if (!ap || !(ap.flux > 0)) continue;
      dots.push({ det: f.det, id: f.id, stop: stopOf(f.id), sub: subOf(f.id), mjd: f.mjd, x: cx, y: cy, snr: (s - st.med) / st.sig,
        flux: ap.flux, err: ap.err, lam: f.lam, onStar: !!mask[p], frame: f });
    }
    f.seen = (x, y) => {
      const i = Math.round(x), j = Math.round(y);
      if (i < 2 || j < 2 || i >= n - 2 || j >= n - 2) return null;
      let best = null;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const q = (j + dy) * n + i + dx;
        let s = 0, k = 0;
        for (let ey = -1; ey <= 1; ey++) for (let ex = -1; ex <= 1; ex++) { const w = f.data[q + ey * n + ex] - calm[q + ey * n + ex]; if (w === w) { s += w; k++; } }
        if (k >= 6) { const z = (s / k - st.med) / st.sig; if (best === null || z > best) best = z; }
      }
      return best;
    };
  }
  return { dots, calm, mask };
}

/**
 * Is a group of dots, found at one place during one stop, a body passing by? Returns the sighting; `why` on it says
 * why not, when it is not. g: the stop ({ frames, dots }); all: every exposure of the field that was searched; n: the
 * width of the grid in pixels.
 */
function judge(stop, g, group, all, n) {
  // Two minutes apart and one filter step on, a body is about as bright as before. Within each detector the dots that
  // differ from the others by more than three times are left out: a cosmic-ray hit beside the body, or instead of it.
  const hits = [];
  for (const d of new Set(group.map(c => c.det))) {
    const v = group.filter(c => c.det === d && !(c.fault && c.fault.length)), f = v.map(c => c.flux).sort((a, b) => a - b), m = f[f.length >> 1];
    if (v.length === 2 && f[1] > 3 * f[0]) continue;
    hits.push(...v.filter(c => c.flux <= 3 * m && c.flux >= m / 3));
  }
  const all0 = [...group].sort((a, b) => a.mjd - b.mjd || a.det - b.det), top = group.reduce((m, c) => (c.snr > m.snr ? c : m), group[0]);
  const s = { stop, x: top.x, y: top.y, mjd: (all0[0].mjd + all0[all0.length - 1].mjd) / 2, t0: all0[0].mjd, t1: all0[all0.length - 1].mjd, hits: all0,
    moments: new Set(group.map(c => c.sub)).size, dets: [...new Set(group.map(c => c.det))].sort(), snr: top.snr, best: top };
  if (hits.length < 2) { s.why = group.some(c => c.fault && c.fault.length) ? 'marked as a fault by the pipeline' : 'brightness jumps'; return s; }
  const best = hits.reduce((m, c) => (c.snr > m.snr ? c : m), hits[0]), same = hits.filter(c => c.det === best.det);
  const pair = hits.some(c => hits.some(o => o.sub === c.sub && o.det === PARTNER[c.det]));          // both detectors of a pair, at one moment
  const twice = new Set(same.map(c => c.sub)).size >= 2;                                               // the same detector, at two moments
  const w = hits.reduce((q, c) => q + c.snr, 0), x = hits.reduce((q, c) => q + c.x * c.snr, 0) / w, y = hits.reduce((q, c) => q + c.y * c.snr, 0) / w;
  hits.sort((a, b) => a.mjd - b.mjd || a.det - b.det);
  Object.assign(s, { x, y, mjd: (hits[0].mjd + hits[hits.length - 1].mjd) / 2, t0: hits[0].mjd, t1: hits[hits.length - 1].mjd, hits,
    moments: new Set(hits.map(c => c.sub)).size, dets: [...new Set(hits.map(c => c.det))].sort(), pair, snr: best.snr, best });
  // Was it there in every exposure of this stop that looked? In the detector that shows it best, nearly all must say yes;
  // in its partner, which sees the same sky at the same moments, they must whenever the body is bright enough to expect it there.
  const says = d => g.frames.filter(f => f.det === d).map(f => f.seen(x, y)).filter(z => z != null);
  const own = says(best.det), other = says(PARTNER[best.det]);
  const ownYes = own.filter(z => z >= YES).length, otherYes = other.filter(z => z >= YES).length;
  s.looked = own.length + other.length; s.said = ownYes + otherYes; s.partner = other;
  const first = g.frames.filter(f => f.det === best.det).sort((a, b) => a.mjd - b.mjd)[0];
  const expect = best.det >= 4 ? best.snr >= 10 : best.snr >= 40;      // sunlight thrown back is brighter at the short end; only a strong dot at the short end must show at the long end too
  // In front of a star: the star's own light changes from one colour to the next, so more is asked. Three images or
  // more, two of them in one detector, and (below) next to nothing at that place on other days.
  s.covered = hits.some(c => c.onStar);
  s.why = best.snr < 5.5 ? 'too faint to be sure'
    : s.covered && (hits.length < 3 || !twice) ? 'in front of a star, and in too few images'
    : !twice && !pair ? 'one image per detector, and not a pair'
    : own.length < 2 && !pair ? 'one exposure only'
    : ownYes < Math.ceil(own.length * 0.75) ? 'missing from exposures of its own detector'
    : expect && other.length && otherYes < Math.ceil(other.length * 0.5) ? 'missing from the partner detector'
    // A body shines by sunlight thrown back, which is brighter at the short end: the test bodies stand out two to five
    // times more clearly in D2 and D3 than in their partners D5 and D6. A dot that is strongest in D5 or D6 while the
    // partner, which looked at the same place at the same moments, shows less than half as much, is a fault of that detector.
    : best.det >= 5 && other.length && [...other].sort((p, q) => p - q)[other.length >> 1] < Math.max(YES, best.snr / 2) ? 'in the long-wavelength detector only'
    // left-over charge: missing from the first exposure of a stop, there in the rest
    : subOf(first.id) === 1 && own.length >= 3 && first.seen(x, y) != null && first.seen(x, y) < YES ? 'not in the first exposure of the stop'
    : null;
  if (s.why) return s;
  // Is it at that place on other days too? Then it is not a visitor: a star the mask missed (a faint one, or one that
  // varies), the spike of a bright one, or left-over charge, which returns to one place at every stop of a visit.
  // The exposures of the same half of the camera (D1 to D3, or D4 to D6) more than three days away are asked: those
  // of the same visit, and those of other visits.
  const half = d => (d <= 3 ? 0 : 1);
  const share = keep => {
    const z = all.filter(f => half(f.det) === half(best.det) && keep(Math.abs(f.mjd - s.mjd))).map(f => f.seen(x, y)).filter(q => q != null), yes = z.filter(q => q >= YES).length;
    return z.length >= 6 && yes >= 3 ? yes / z.length : 0;
  };
  s.elsewhere = Math.max(share(dt => dt > 3 && dt <= 40), share(dt => dt > 40));
  if (s.elsewhere >= (s.covered ? 0.1 : 0.2)) { s.why = 'there on other days too'; return s; }
  // A faint star may show at one end of a detector's range of wavelengths only, and so in a few exposures in a row
  // and in few others. The exposures to ask are then the ones of other stops that saw this place in the same colour
  // (within 4%): a star is in them, a visitor is not.
  const c = (n - 1) / 2, colour = f => f.lam + (f.lgx || 0) * (x - c) + (f.lgy || 0) * (y - c), here = colour(best.frame);
  const alike = all.filter(f => f.det === best.det && stopOf(f.id) !== stop && Math.abs(colour(f) / here - 1) < 0.04).map(f => f.seen(x, y)).filter(q => q != null);
  const again = alike.filter(q => q >= YES).length;
  s.alike = alike.length >= 2 ? again / alike.length : null;
  // half of them, or a third when that is three exposures or more: among the test bodies the share never passes 29%
  if (s.alike >= 0.5 || (again >= 3 && s.alike >= 1 / 3)) s.why = 'there in this colour at other times too';
  return s;
}

/** What the pipeline's FLAGS layer calls a fault at a pixel: a dot that carries one of these is not counted. */
export const FAULTS = ['TRANSIENT', 'SUR_ERROR', 'NONFUNC', 'PERSIST', 'HOT', 'COLD', 'SNOWBALL', 'GHOST', 'GHOST_FPA', 'GHOST_EXT', 'STREAK', 'BLOOM', 'OVERFLOW', 'MISSING_DATA', 'CROSSTALK'];

/**
 * Sightings and tracks in the exposures of a field.
 * dets: { 1: frames, …, 6: frames }; grid: { n, scale }. Options:
 *   minSnr (4.5); pause (called now and then, may return a promise);
 *   flags: async (frame) => ({ n, bits, planes }) — the pipeline's flags of an exposure on this grid (Archive.readFlags).
 *     A sighting that is not part of a straight track of three or more stops rests on a few dots only, and two cosmic-ray
 *     hits can fall on one place by chance: each of its dots is looked up in the flags, the ones marked as faults are
 *     dropped, and the sighting has to stand on what is left. Without `flags`, or when they cannot be read, such
 *     sightings are left out.
 * Returns { tracks, sightings, frames, stops, unchecked }. A track: { sightings, t0, t1, hours, moved, path, rate, dE, dN, images, snr };
 * a sighting: { stop, x, y, mjd, hits, dets, snr, best, looked, said, added }.
 */
export async function findMovers(dets, grid, opt = {}) {
  const minSnr = opt.minSnr || 4.5, scale = grid.scale, n = grid.n;
  const dots = [], all = [], masks = {};
  for (let d = 1; d <= 6; d++) {
    const fr = (dets[d] || []).filter(f => f.data && f.cov >= 0.5).sort((a, b) => a.mjd - b.mjd);
    if (opt.pause) await opt.pause();
    const r = dotsOf(fr, grid, minSnr);
    dots.push(...r.dots);
    if (r.calm) { all.push(...fr.filter(f => f.seen)); masks[d] = r.mask; }
  }
  // the exposures of each stop, and the dots found in them
  const stops = new Map();
  for (const f of all) { const k = stopOf(f.id); if (!stops.has(k)) stops.set(k, { frames: [], dots: [] }); stops.get(k).frames.push(f); }
  for (const c of dots) stops.get(c.stop)?.dots.push(c);
  if (opt.pause) await opt.pause();

  const raw = [];
  // dots of one stop that sit at one place: within about a pixel at one moment, a little more for every step in between
  const groupsOf = v => {
    const parent = v.map((_, i) => i), root = i => (parent[i] === i ? i : (parent[i] = root(parent[i])));
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
      const a = v[i], b = v[j];
      if (a.id === b.id && a.det === b.det) continue;
      const reach = (4 + 3 * Math.abs(a.sub - b.sub)) / scale;          // arcseconds: 4 at one moment, 3 more per two-minute step (about 85″ an hour)
      if (Math.hypot(a.x - b.x, a.y - b.y) <= reach) parent[root(j)] = root(i);
    }
    const groups = new Map();
    v.forEach((c, i) => { const r = root(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(c); });
    return [...groups.values()].filter(group => group.length >= 2);
  };
  for (const [stop, g] of stops) {
    // first the dots away from the stars
    const told = new Set();
    for (const group of groupsOf(g.dots.filter(c => !c.onStar))) {
      const s = judge(stop, g, group, all, n);
      raw.push({ g, group, s });
      if (!s.why) for (const c of group) told.add(c);
    }
    // then the strong ones in front of a star, with their neighbours, wherever the first round found no visitor
    for (const group of groupsOf(g.dots.filter(c => !c.onStar || c.snr >= STAR_SNR))) {
      if (!group.some(c => c.onStar) || group.some(c => told.has(c))) continue;
      raw.push({ g, group, s: judge(stop, g, group, all, n) });
    }
  }
  let sightings = raw.map(r => r.s).filter(s => !s.why).sort((a, b) => a.mjd - b.mjd);
  if (opt.pause) await opt.pause();

  // What the pipeline itself says about the dots of the sightings that rest on little.
  let tracks = link(sightings, scale), unchecked = 0;
  const sure = new Set(tracks.filter(t => new Set(t.sightings.map(s => s.stop)).size >= 3).flatMap(t => t.sightings));
  const doubt = raw.filter(r => !r.s.why && !sure.has(r.s));
  if (doubt.length) {
    // the exposures to look up, each once, four at a time
    const asked = new Map(), want = r => [...r.group].sort((a, b) => b.snr - a.snr).slice(0, 6);
    if (opt.flags) for (const r of doubt) for (const c of want(r)) asked.set(`${c.det}:${c.id}`, c.frame);
    const got = new Map(), queue = [...asked];
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) { const [k, f] = queue.shift(); got.set(k, await Promise.resolve().then(() => opt.flags(f)).catch(() => null)); }
    }));
    for (const r of doubt) {
      let known = !!opt.flags;
      if (known) for (const c of want(r)) {
        const fl = got.get(`${c.det}:${c.id}`);
        if (!fl || fl.n !== n) { known = false; break; }
        const v = fl.bits[Math.round(c.y) * n + Math.round(c.x)];
        c.fault = fl.planes.filter(pl => v & (1 << pl.bit) && FAULTS.includes(pl.name)).map(pl => pl.name);
      }
      if (!known) { r.s.why = 'the pipeline’s flags could not be read'; unchecked++; continue; }
      const again = judge(r.s.stop, r.g, r.group, all, n);
      Object.assign(r.s, again, { why: again.why || null });
    }
    sightings = raw.map(r => r.s).filter(s => !s.why).sort((a, b) => a.mjd - b.mjd);
    tracks = link(sightings, scale);
  }
  if (opt.pause) await opt.pause();

  // A track tells where the body was at the stops in between, and where it was heading before and after: exposures
  // that show a dot there, though alone they proved nothing (a single exposure, or a place in front of a star), are
  // added to it. The stops are taken in order of time, outwards from the track, so that each one added carries it on.
  const when = g => g.frames.reduce((q, f) => q + f.mjd, 0) / g.frames.length;
  const order = [...stops].map(([stop, g]) => ({ stop, g, mjd: when(g) })).sort((a, b) => a.mjd - b.mjd);
  for (const t of tracks) {
    if (t.sightings.length < 2) continue;
    const strength = t.snr;
    const add = o => {
      const v = t.sightings, a = v[0], b = v[v.length - 1];
      if (v.some(q => q.stop === o.stop)) return;
      const before = o.mjd < a.mjd, after = o.mjd > b.mjd, gap = (before ? a.mjd - o.mjd : after ? o.mjd - b.mjd : 0) * 24;      // hours beyond the track's ends
      if (gap > 72) return;
      // beyond its ends the track is carried on at the speed of its last piece, which two sightings fix only so well
      const piece = (before ? v[1].mjd - a.mjd : after ? b.mjd - v[v.length - 2].mjd : 1) * 24;
      const [px, py] = trackAt(t, o.mjd), reach = Math.min(45, 8 + 6 * gap / Math.max(piece, 1)) / scale;
      const near = o.g.dots.filter(c => Math.hypot(c.x - px, c.y - py) <= reach && c.snr < 8 * strength && c.snr > strength / 20);
      if (!near.length) return;
      const w = near.reduce((q, c) => q + c.snr, 0), x = near.reduce((q, c) => q + c.x * c.snr, 0) / w, y = near.reduce((q, c) => q + c.y * c.snr, 0) / w;
      const said = o.g.frames.map(f => ({ f, z: f.seen(x, y) })).filter(q => q.z != null), yes = said.filter(q => q.z >= YES).length;
      // between two sightings the place is known to a few arcseconds, and most exposures saying yes will do; beyond the ends more is asked
      if (yes < Math.ceil(said.length * 0.6) || (gap > 0 && said.filter(q => q.z >= 5).length < Math.ceil(said.length * 0.4))) return;
      const best = near.reduce((m, c) => (c.snr > m.snr ? c : m), near[0]);
      near.sort((p, q) => p.mjd - q.mjd || p.det - q.det);
      v.push({ stop: o.stop, x, y, mjd: o.mjd, t0: near[0].mjd, t1: near[near.length - 1].mjd, hits: near, moments: new Set(near.map(c => c.sub)).size,
        dets: [...new Set(near.map(c => c.det))].sort(), snr: best.snr, best, looked: said.length, said: yes, added: true });
      v.sort((p, q) => p.mjd - q.mjd);
    };
    const mid = (t.sightings[0].mjd + t.sightings[t.sightings.length - 1].mjd) / 2;
    for (const o of order.filter(o => o.mjd >= mid)) add(o);
    for (const o of order.filter(o => o.mjd < mid).reverse()) add(o);
    describe(t, scale);
  }
  // What stays at one place for days is not passing through. And a body seen at one stop only, never again, has to be
  // plain to see there: three images or more, or a strong dot.
  tracks = tracks.filter(t => !(t.hours >= 48 && t.moved < 8) && (t.sightings.length > 1 || t.sightings[0].hits.length >= 3 || t.sightings[0].snr >= 8));
  return { sightings, tracks, frames: all.length, stops: stops.size, dots: dots.length, unchecked, ...(opt.debug ? { debug: { masks, dots, raw: raw.map(r => r.s) } } : {}) };
}

/** Fill in what a track is: when, how far, how fast. */
export function describe(t, scale) {
  const v = t.sightings, a = v[0], b = v[v.length - 1];
  t.t0 = a.t0; t.t1 = b.t1; t.hours = (b.mjd - a.mjd) * 24;
  t.dE = -(b.x - a.x) * scale; t.dN = (b.y - a.y) * scale; t.moved = Math.hypot(t.dE, t.dN);
  // the length of the path, stop by stop: a distant body near its turning point slows down and doubles back
  t.path = 0; for (let i = 1; i < v.length; i++) t.path += Math.hypot(v[i].x - v[i - 1].x, v[i].y - v[i - 1].y) * scale;
  t.rate = t.hours > 0 ? t.path / t.hours : null;
  t.images = v.reduce((q, x) => q + x.hits.length, 0); t.snr = Math.max(...v.map(x => x.snr));
  return t;
}

/**
 * Join sightings into tracks. First the ones that lie on a straight line at a steady speed (three or more: such a
 * line is not there by chance), then slow pieces and lone sightings that continue one another over days (a distant
 * body), then pairs. What is left stays a track of one sighting.
 */
function link(sightings, scale) {
  const S = sightings, free = new Set(S.map((_, i) => i)), lines = [];
  const hoursBetween = (a, b) => (b.mjd - a.mjd) * 24, dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * scale;
  // straight lines: every pair proposes a motion, the other sightings vote
  for (;;) {
    let bestSet = null;
    for (const i of free) for (const j of free) {
      if (j <= i) continue;
      const a = S[i], b = S[j], h = hoursBetween(a, b);
      if (h < 0.3 || h > 72) continue;
      const vx = (b.x - a.x) / h, vy = (b.y - a.y) / h, speed = Math.hypot(vx, vy) * scale;
      if (speed > 80) continue;
      const set = [];
      for (const k of free) {
        const c = S[k], dt = hoursBetween(a, c);
        if (dt < -48 || dt > h + 48) continue;
        const off = Math.hypot(c.x - (a.x + vx * dt), c.y - (a.y + vy * dt)) * scale;
        const out = dt < 0 ? -dt : dt > h ? dt - h : 0;                // hours outside the two that proposed the motion
        if (off <= 6 + 0.04 * speed * out) set.push(k);
      }
      const nStops = new Set(set.map(k => S[k].stop)).size;
      if (nStops >= 3 && set.length === nStops && (!bestSet || set.length > bestSet.length)) bestSet = set;
    }
    if (!bestSet) break;
    for (const k of bestSet) free.delete(k);
    lines.push(bestSet.map(k => S[k]).sort((a, b) => a.mjd - b.mjd));
  }
  // A distant body: slow pieces and lone sightings that follow one another over days. A piece says by its own speed
  // where to look next; two lone sightings are joined only within two days, a short way apart.
  const units = [...lines, ...[...free].map(k => [S[k]])].sort((a, b) => a[0].mjd - b[0].mjd);
  const speed = u => (u.length < 2 ? null : dist(u[0], u[u.length - 1]) / Math.max(hoursBetween(u[0], u[u.length - 1]), 1));
  const follows = (u, w) => {                       // does w, later, carry u on?
    const a = u[u.length - 1], b = w[0], h = hoursBetween(a, b);
    if (h <= 0 || h > 24 * 12 || new Set([...u, ...w].map(q => q.stop)).size !== u.length + w.length) return false;
    const guess = (piece, from, to, hours) => {     // from a piece's last step, where the body is `hours` on, and how well that is known
      const [p, q] = piece, ph = Math.max(Math.abs(hoursBetween(p, q)), 1), vx = (q.x - p.x) / ph, vy = (q.y - p.y) / ph, v = Math.hypot(vx, vy) * scale;
      const off = Math.hypot(to.x - (from.x + vx * hours), to.y - (from.y + vy * hours)) * scale;
      return off <= 10 + (4 / ph) * Math.abs(hours) + 0.35 * v * Math.abs(hours);
    };
    if (u.length >= 2) return guess([u[u.length - 2], a], a, b, h);
    if (w.length >= 2) return guess([w[0], w[1]], b, a, -h);
    return h <= 48 && dist(a, b) <= 8 + 1.5 * h;
  };
  for (let i = 0; i < units.length; i++) {
    if (!units[i] || speed(units[i]) >= 5) continue;
    for (let j = i + 1; j < units.length; j++) {
      if (!units[j] || speed(units[j]) >= 5) continue;
      if (follows(units[i], units[j])) { units[i] = [...units[i], ...units[j]]; units[j] = null; }
    }
  }
  const merged = units.filter(Boolean), lone = merged.filter(u => u.length === 1).map(u => u[0]), out = merged.filter(u => u.length > 1);
  // pairs: the two sightings closest in time that one steady motion of a main-belt asteroid would join
  const used = new Set(), pairs = [];
  for (let i = 0; i < lone.length; i++) for (let j = i + 1; j < lone.length; j++) {
    const h = hoursBetween(lone[i], lone[j]);
    if (h >= 0.3 && h <= 14 && dist(lone[i], lone[j]) <= 6 + 80 * h && lone[i].stop !== lone[j].stop) pairs.push([h, i, j]);
  }
  for (const [, i, j] of pairs.sort((p, q) => p[0] - q[0])) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i); used.add(j); out.push([lone[i], lone[j]]);
  }
  lone.forEach((q, i) => { if (!used.has(i)) out.push([q]); });
  return out.map(v => describe({ sightings: v.sort((a, b) => a.mjd - b.mjd) }, scale))
    .sort((a, b) => b.sightings.length - a.sightings.length || b.snr - a.snr);
}

/** Where a track was at a moment: between its sightings in a straight line, and on at the speed of its first or last piece outside them. Grid pixels. */
export function trackAt(track, mjd) {
  const v = track.sightings, last = v.length - 1;
  if (v.length === 1) return [v[0].x, v[0].y];
  let i = 1;
  while (i < last && v[i].mjd < mjd) i++;
  const a = v[i - 1], b = v[i], t = (mjd - a.mjd) / Math.max(b.mjd - a.mjd, 1e-9);
  return [a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)];
}
