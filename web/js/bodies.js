// Bodies of the solar system by name: where one was while SPHEREx surveyed the sky, when the telescope had it in
// view, and its measured places in the form the Minor Planet Center takes.
//
//   - The path comes from Miriade (IMCCE, Paris Observatory): where the body was, seen from the centre of the Earth.
//   - SPHEREx is not at the centre of the Earth. It circles it some 650 km up, and from there a main-belt asteroid
//     lies up to five arcseconds from where the centre of the Earth sees it. Every exposure says in its header where
//     the spacecraft was at mid-exposure: the path is shifted by that, exposure by exposure (fromSpacecraft).
//   - Which exposures had the body in view is asked of the sky index, cell by cell along the path (visitsOf).
//   - A report to the Minor Planet Center is a table in its ADES format: a time, a place and, for a telescope in
//     orbit, where the telescope was (ades). SPHEREx is observatory 288 there.
//
// No DOM in here; the same code runs in the page and in the test scripts.
import * as Archive from './archive.js';
import { stopOf } from './movers.js';

const MIRIADE = 'https://ssp.imcce.fr/webservices/miriade/api/ephemcc.php';
const D2R = Math.PI / 180, AU_KM = 149597870.7;
const sex = s => { const m = String(s).trim().match(/^([+-]?)(\d+)[: ](\d+)[: ]([\d.]+)/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] + m[3] / 60 + m[4] / 3600) : NaN; };
const east = (ra, from) => ((ra - from + 540) % 360) - 180;          // degrees of right ascension from one place to another, the short way round
const sepDeg = (r1, d1, r2, d2) => Math.acos(Math.min(1, Math.max(-1, Math.sin(d1 * D2R) * Math.sin(d2 * D2R) + Math.cos(d1 * D2R) * Math.cos(d2 * D2R) * Math.cos((r1 - r2) * D2R)))) / D2R;

// ---------------------------------------------------------------- a name, as typed
const WORDS = /^(asteroid|minor planet|dwarf planet|planet|comet|asteroit|cüce gezegen|gezegen|kuyruklu yıldız|asteroide|planeta enano|planeta|cometa|zwergplanet|kleinplanet|komet|astéroïde|asteroïde|planète naine|planète|comète|planetoida|asteroida|planeta karłowata|kometa)\s+/i;
// The planets and the two best-known dwarf planets, as the site's six languages call them (accents folded): Miriade knows the English names.
const LOCAL = { pluto: 'a:Pluto', pluton: 'a:Pluto', ceres: 'a:Ceres', mercury: 'p:Mercury', merkur: 'p:Mercury', mercurio: 'p:Mercury', mercure: 'p:Mercury', merkury: 'p:Mercury',
  venus: 'p:Venus', wenus: 'p:Venus', mars: 'p:Mars', marte: 'p:Mars', jupiter: 'p:Jupiter', jowisz: 'p:Jupiter', saturn: 'p:Saturn', saturno: 'p:Saturn', saturne: 'p:Saturn',
  uranus: 'p:Uranus', urano: 'p:Uranus', uran: 'p:Uranus', neptune: 'p:Neptune', neptun: 'p:Neptune', neptuno: 'p:Neptune' };
const fold = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/**
 * The ways a typed name can be put to Miriade, likeliest first: [{ q, name }]. "(433) Eros" is asteroid 433;
 * "433 Eros" is too, if that is its name (`name` is checked against the answer: "61 Cygni" is a star, and asteroid 61
 * is called Danaë); "2P/Encke" is comet 2P; "2015 TX457" is a provisional designation; one bare word may be an
 * asteroid or a comet. Names are kept without accents ("Cérès" is Ceres). Nothing for a text that cannot be one.
 */
export function namesFor(text) {
  const raw = String(text).trim().replace(/\s+/g, ' '), said = WORDS.test(raw), t = fold(raw.replace(WORDS, ''));
  if (LOCAL[t.toLowerCase()]) return [{ q: LOCAL[t.toLowerCase()] }];
  let m;
  if (/^\d{4} [A-Z]{2}\d*$/i.test(t)) return [{ q: `a:${t.toUpperCase()}` }];
  if ((m = t.match(/^\((\d{1,7})\)(?:\s+\S.*)?$/))) return [{ q: `a:${m[1]}` }];
  if ((m = t.match(/^(\d{1,7}) ([A-Za-z][A-Za-z '’-]+)$/))) return [{ q: `a:${m[1]}`, name: m[2] }];
  if (/^\d{1,7}$/.test(t)) return [{ q: `a:${t}` }];
  if ((m = t.match(/^(\d{1,3}[PDI])(?:[/\s].*)?$/i))) return [{ q: `c:${m[1].toUpperCase()}` }];
  if (/^[CPDXAI]\/\d{4} [A-Z]{1,2}\d*/i.test(t)) return [{ q: `c:${t.split(/\s*\(/)[0]}` }];
  return (said ? /^[A-Za-z][A-Za-z '’-]{2,}$/ : /^[A-Za-z][A-Za-z'’-]{2,}$/).test(t) ? [{ q: `a:${t}` }, { q: `c:${t}` }] : [];
}
/** Does a typed text say outright that a body of the solar system is meant? ("asteroid Iris", "(7) Iris", "2P/Encke", "2015 TX457") */
export const saysBody = text => { const t = String(text).trim(); return WORDS.test(t) || /^\(\d+\)/.test(t) || /^\d{1,3}[PDI]([/\s]|$)/i.test(t) || /^[CPDXAI]\/\d{4} /i.test(t) || /^\d{4} [A-Z]{2}\d*$/i.test(t); };

// ---------------------------------------------------------------- its path
/**
 * Where a body was, seen from the centre of the Earth, at `n` moments `step` apart from `mjd0` on ("1d", "1h", "10m").
 * { num, name, kind, cls, h, rows: [{ mjd, ra, dec, delta, sun, v, elong, rate }] }: degrees (ICRS), au from Earth and
 * from the Sun, visual magnitude (NaN for a comet), degrees from the Sun, arcseconds an hour. Null when Miriade knows
 * no body of that name; throws when it cannot be reached.
 */
export async function ephemeris(name, mjd0, n, step = '1d', signal) {
  const q = new URLSearchParams({ '-name': name, '-type': '', '-ep': (mjd0 + 2400000.5).toFixed(5), '-nbd': String(n), '-step': step, '-tscale': 'UTC',
    '-observer': '500', '-theory': 'INPOP', '-teph': '1', '-tcoor': '1', '-rplane': '1', '-mime': 'json', '-output': '--jd' });
  const r = await fetch(`${MIRIADE}?${q}`, { signal });
  if ([400, 404, 422].includes(r.status)) return null;
  if (!r.ok) throw new Error(`Miriade ${r.status}`);
  const js = await r.json(), sso = js.sso || {}, par = sso.parameters || {};
  if (!Array.isArray(js.data) || !js.data.length) return null;
  const rows = js.data.map(o => {
    const mjd = +o.Date - 2400000.5, delta = +o.Dobs, elong = +o['Elong.'];
    // how far the Earth is from the Sun that day (to a ten-thousandth), and from the triangle Sun, Earth, body: how far the body is from the Sun
    const g = (357.529 + 0.98560028 * (mjd - 51544.5)) * D2R, R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
    return { mjd, ra: sex(o.RA) * 15, dec: sex(o.DEC), delta, sun: Math.sqrt(delta * delta + R * R - 2 * delta * R * Math.cos(elong * D2R)),
      v: +o.VMag > 0 ? +o.VMag : NaN, elong, rate: Math.hypot(+o.dRAcosDEC, +o.dDEC) * 60 };
  }).filter(o => o.ra === o.ra && o.dec === o.dec);
  if (!rows.length) return null;
  const num = +sso.num > 0 ? +sso.num : null, code = sso.code || '';
  return { num, name: String(sso.name || name).trim(), code, kind: String(sso.type || ''), cls: String(par.dynamical_class || ''), h: par.absolute_magnitude ?? null, query: name, rows };
}
/** Look a typed name up: the first of its readings that Miriade knows, day by day from `mjd0` on. */
export async function lookup(text, mjd0, days, signal) {
  const plain = v => fold(v).toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const { q, name } of namesFor(text)) {
    const e = await ephemeris(q, mjd0, days, '1d', signal);
    if (e && (!name || plain(e.name) === plain(name))) return e;
  }
  return null;
}
/** A path as a function of time: at(mjd) → { ra, dec, delta, sun, v, rate }, straight between its points; null outside them. */
export function pathAt(rows) {
  return mjd => {
    if (!rows.length || mjd < rows[0].mjd || mjd > rows[rows.length - 1].mjd) return null;
    let lo = 0, hi = rows.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rows[m].mjd <= mjd) lo = m; else hi = m; }
    const a = rows[lo], b = rows[hi], t = (mjd - a.mjd) / Math.max(b.mjd - a.mjd, 1e-9), mix = k => a[k] + t * (b[k] - a[k]);
    let dra = b.ra - a.ra; if (dra > 180) dra -= 360; if (dra < -180) dra += 360;
    return { ra: (a.ra + t * dra + 360) % 360, dec: mix('dec'), delta: mix('delta'), sun: mix('sun'), v: mix('v'), rate: mix('rate') };
  };
}
/**
 * A place in the sky seen from the centre of the Earth, at `delta` au, as the spacecraft sees it from `sc`
 * ([x, y, z] km from the centre of the Earth, equatorial axes): [ra, dec] in degrees.
 */
export function fromSpacecraft(ra, dec, delta, sc) {
  if (!sc || !(delta > 0)) return [ra, dec];
  const a = ra * D2R, d = dec * D2R, r = delta * AU_KM;
  const x = r * Math.cos(d) * Math.cos(a) - sc[0], y = r * Math.cos(d) * Math.sin(a) - sc[1], z = r * Math.sin(d) - sc[2];
  return [(Math.atan2(y, x) / D2R + 360) % 360, Math.atan2(z, Math.hypot(x, y)) / D2R];
}

// ---------------------------------------------------------------- when SPHEREx had it in view
/**
 * The visits of the telescope during which the body lay well inside its images, latest first. For each, the patch of
 * sky to open: where the body spent the most stops of the telescope within one field of `size` arcminutes.
 * rows: its path day by day (ephemeris). Returns [{ t0, t1, exposures, stops, size, ra, dec, mjd, from, to, inField, v, rate, delta, sun }]:
 * the whole visit (t0, t1, exposures, stops) and the chosen field (centre, the moments its first and last stop were
 * made, how many stops fall in it).
 */
export async function visitsOf(rows, signal) {
  const at = pathAt(rows), pts = [];
  let last = null;
  for (const r of rows) if (!last || sepDeg(last.ra, last.dec, r.ra, r.dec) > 0.8) { pts.push([r.ra, r.dec]); last = r; }
  const frames = await Archive.findAlong(pts, mjd => { const p = at(mjd); return p ? [p.ra, p.dec] : null; }, signal);
  const visits = [];
  for (const f of frames) {
    const v = visits[visits.length - 1];
    if (v && f.mjd - v[v.length - 1].mjd <= 20) v.push(f); else visits.push([f]);
  }
  return visits.map(fr => {
    const by = new Map();
    for (const f of fr) { const k = stopOf(f.id); if (!by.has(k)) by.set(k, { mjd: 0, n: 0 }); const o = by.get(k); o.mjd += f.mjd; o.n++; }
    const stops = [...by.values()].map(o => { const mjd = o.mjd / o.n, p = at(mjd); return { mjd, n: o.n, ra: p.ra, dec: p.dec }; }).sort((a, b) => a.mjd - b.mjd);
    // the field that holds the most stops: tried around every stop, for a small field first
    const mid = (stops[0].mjd + stops[stops.length - 1].mjd) / 2;
    const best = size => {
      const half = (size / 2 - 1.2) / 60;
      let pick = null;
      for (const c of stops) {
        const inside = stops.filter(s => Math.abs(east(s.ra, c.ra) * Math.cos(c.dec * D2R)) <= half && Math.abs(s.dec - c.dec) <= half);
        if (!pick || inside.length > pick.inside.length || (inside.length === pick.inside.length && Math.abs(c.mjd - mid) < Math.abs(pick.c.mjd - mid))) pick = { c, inside };
      }
      return pick;
    };
    const small = best(5), wide = best(10), use = small.inside.length >= 0.8 * wide.inside.length ? small : wide, size = use === small ? 5 : 10;
    // the middle of the stops it holds (right ascensions counted from the first one, so that a field across 0h is no trouble)
    const ra0 = use.inside[0].ra, ras = use.inside.map(s => east(s.ra, ra0)), decs = use.inside.map(s => s.dec), when = (use.inside[0].mjd + use.inside[use.inside.length - 1].mjd) / 2, p = at(when);
    return { t0: fr[0].mjd, t1: fr[fr.length - 1].mjd, exposures: fr.length, stops: stops.length, size,
      ra: (ra0 + (Math.min(...ras) + Math.max(...ras)) / 2 + 360) % 360, dec: (Math.min(...decs) + Math.max(...decs)) / 2, mjd: when,
      from: use.inside[0].mjd, to: use.inside[use.inside.length - 1].mjd, inField: use.inside.length, v: p.v, rate: p.rate, delta: p.delta, sun: p.sun };
  }).reverse();
}

// ---------------------------------------------------------------- is it known? where is it reported?
const two = v => String(v).padStart(2, '0');
function sexa(ra, dec) {
  const h = ra / 15, hh = Math.floor(h), hm = Math.floor((h - hh) * 60), hs = ((h - hh) * 60 - hm) * 60;
  const a = Math.abs(dec), dd = Math.floor(a), dm = Math.floor((a - dd) * 60), ds = Math.round(((a - dd) * 60 - dm) * 60);
  return [`${two(hh)} ${two(hm)} ${hs.toFixed(1).padStart(4, '0')}`, `${dec < 0 ? '-' : '+'}${two(dd)} ${two(dm)} ${two(Math.min(ds, 59))}`];
}
const dateOf = mjd => new Date((mjd - 40587) * 864e5);
/**
 * The Minor Planet Center's own check of what was at a place at a moment (MPChecker), with the form filled in:
 * every minor planet and comet it knows within `radius` arcminutes, down to magnitude 21.
 */
export function mpcheckerUrl(ra, dec, mjd, radius = 5) {
  const d = dateOf(mjd), [r, c] = sexa(ra, dec);
  const day = d.getUTCDate() + (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600) / 24;
  const q = new URLSearchParams({ year: d.getUTCFullYear(), month: two(d.getUTCMonth() + 1), day: day.toFixed(2).padStart(5, '0'), which: 'pos', ra: r, decl: c, TextArea: '',
    radius: String(radius), limit: '21.0', oc: '500', sort: 'd', mot: 'h', tmot: 's', pdes: 'u', needed: 'f', ps: 'n', type: 'p' });
  return `https://minorplanetcenter.net/cgi-bin/mpcheck.cgi?${q}`;
}

/** SPHEREx at the Minor Planet Center: its observatory code, and what its report header says about the telescope. */
export const MPC = { code: '288', aperture: '0.2', fRatio: '3', design: 'Reflector', detector: 'CMO' };
/**
 * How well one place measured in these images is known, in arcseconds: a floor that the test bodies set (the
 * pixels are 6.15 arcseconds wide and the images are resampled once), and more for a faint dot.
 */
export const placeError = snr => Math.hypot(0.7, 7.5 / Math.max(snr, 3));
/**
 * Measured places of one body as a report in the Minor Planet Center's ADES format (pipe-separated, version 2022).
 * id: { permID } for a numbered body, { provID } for one with a provisional designation, { trkSub } for a dot nobody
 * has named. obs: [{ mjd, ra, dec, rms, sc: [x, y, z] km, snr, remark }], one for each moment the body was measured.
 * who: the name of the person who measured them, as the Center writes names ("J. Smith").
 */
export function ades(id, obs, who, note = []) {
  // a line of comment holds a hundred characters at most: longer ones are broken between words
  const wrap = text => { const out = ['']; for (const w of String(text).split(/\s+/)) { const k = out.length - 1; if (out[k] && out[k].length + 1 + w.length > 100) out.push(w); else out[k] += (out[k] ? ' ' : '') + w; } return out; };
  note = note.flatMap(wrap);
  const head = ['# version=2022', '# observatory', `! mpcCode ${MPC.code}`, '# submitter', `! name ${who}`, '# observers', '! name SPHEREx Science Team',
    '# measurers', `! name ${who}`, '# telescope', `! design ${MPC.design}`, `! aperture ${MPC.aperture}`, `! fRatio ${MPC.fRatio}`, `! detector ${MPC.detector}`,
    '# comment', ...note.map(l => `! line ${l}`)];
  const cols = ['permID', 'provID', 'trkSub', 'mode', 'stn', 'sys', 'ctr', 'pos1', 'pos2', 'pos3', 'obsTime', 'ra', 'dec', 'rmsRA', 'rmsDec', 'astCat', 'logSNR', 'exp', 'remarks'];
  const rows = [...obs].sort((a, b) => a.mjd - b.mjd).map(o => {
    const t = dateOf(o.mjd).toISOString().replace(/(\.\d\d)\d*Z$/, '$1Z');
    return [id.permID || '', id.provID || '', id.trkSub || '', 'CMO', MPC.code, 'ICRF_KM', '399', o.sc[0].toFixed(3), o.sc[1].toFixed(3), o.sc[2].toFixed(3), t,
      o.ra.toFixed(6), (o.dec >= 0 ? '+' : '') + o.dec.toFixed(6), o.rms.toFixed(2), o.rms.toFixed(2), 'Gaia3', Math.log10(Math.max(o.snr, 1)).toFixed(2), o.exp ? o.exp.toFixed(1) : '', o.remark || ''];
  });
  const w = cols.map((c, i) => Math.max(c.length, ...rows.map(r => r[i].length)));
  const line = r => r.map((v, i) => v.padEnd(w[i])).join('|');
  return [...head, line(cols), ...rows.map(line)].join('\n') + '\n';
}
/** The name a report gives a body: its number, its provisional designation, or a label of the reporter's own for a dot without a name. */
export function reportId(body, ra, dec, mjd) {
  if (body?.num) return { permID: String(body.num) };
  if (body?.name && /^\d{4} [A-Z]{2}\d*$/.test(body.name)) return { provID: body.name };
  if (body?.code) return { permID: body.code };
  // a label that the same dot gets again another time: from the day and the place it was first seen
  const d = dateOf(mjd), k = Math.round(ra * 100) * 18001 + Math.round((dec + 90) * 100);
  return { trkSub: `CS${String(d.getUTCFullYear()).slice(2)}${(k % 46656).toString(36).toUpperCase().padStart(3, '0')}` };
}

// ---------------------------------------------------------------- a field to hunt in
const NGP = [192.85948, 27.12825];          // the pole of the Milky Way
const galLat = (ra, dec) => 90 - sepDeg(ra, dec, NGP[0], NGP[1]);
/**
 * A field for an asteroid hunt: one of the first few thousand numbered asteroids, picked at random, and a patch of
 * sky it crossed while SPHEREx was looking, away from the crowded band of the Milky Way. Bright enough to be in
 * reach of a single exposure (magnitude 16.5 or brighter) and slow enough to stay in the field for three stops.
 * Returns { body, visit, rows } or null when a handful of picks gave nothing; `tried` is called with each pick.
 * `only` names the asteroid instead of picking one (a link that repeats a hunt): its first fitting visit is taken.
 */
export async function pickHunt(mjd0, days, signal, { rand = Math.random, tries = 6, tried = null, upTo = 3000, only = 0 } = {}) {
  for (let k = 0; k < (only ? 1 : tries); k++) {
    const num = only || 1 + Math.floor(rand() * upTo);
    const body = await ephemeris(`a:${num}`, mjd0, days, '1d', signal).catch(e => { if (e.name === 'AbortError') throw e; return null; });
    if (tried) tried(num, body);
    if (!body) continue;
    const good = (await visitsOf(body.rows, signal)).filter(v => v.v <= 16.5 && v.inField >= 3 && v.size === 10 && v.rate <= 45 && Math.abs(galLat(v.ra, v.dec)) >= 12);
    if (good.length) return { body, visit: good[only ? good.length - 1 : Math.floor(rand() * good.length)], rows: body.rows };
  }
  return null;
}
