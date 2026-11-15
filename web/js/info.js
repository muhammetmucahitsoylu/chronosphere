// Who is that? Object identification (SIMBAD), encyclopedia card (Wikipedia) and
// one-click links that open the same coordinates in independent tools.

import { propagate, epochNow } from './core.js';
import { G } from './lang.js';

const SIMBAD_TAP = [
  'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
  'https://simbad.harvard.edu/simbad/sim-tap/sync',      // mirror, used when Strasbourg is down
];
let simbadBase = null;

async function adql(query) {
  const order = simbadBase ? [simbadBase, ...SIMBAD_TAP.filter(u => u !== simbadBase)] : SIMBAD_TAP;
  let last;
  for (const base of order) {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(`${base}?request=doQuery&lang=adql&format=json&query=${encodeURIComponent(query)}`, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.json(), cols = js.metadata.map(c => c.name);
      simbadBase = base;
      return js.data.map(row => Object.fromEntries(row.map((v, i) => [cols[i], v])));
    } catch (e) { last = e; }
  }
  throw last;
}
export const simbadHost = () => (simbadBase || SIMBAD_TAP[0]).replace(/\/simbad\/.*/, '');

const yearNow = epochNow;
const sep = (ra1, dec1, ra2, dec2) => Math.hypot((ra1 - ra2) * Math.cos(dec1 * Math.PI / 180), dec1 - dec2) * 3600;
export const cleanName = id => (id || '').replace(/^(NAME|V\*|\*\*|\*|EM\*|PN|Cl\*?)\s+/, '').replace(/\s+/g, ' ').trim();

const COLS = `b.oid, b.main_id, b.otype, o.label, o.description, b.ra, b.dec, b.pmra, b.pmdec, b.plx_value, b.plx_err, b.sp_type, b.rvz_redshift, f.V, f.J, f.K`;
const FROM = `FROM basic AS b LEFT JOIN otypedef AS o ON o.otype = b.otype LEFT JOIN allfluxes AS f ON f.oidref = b.oid`;
const cone = (ra, dec, rDeg) => `CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)}, ${rDeg.toFixed(5)})) = 1`;

function shape(row, ra, dec) {
  const year = yearNow();
  const [raNow, decNow] = propagate({ ra: row.ra, dec: row.dec, pmra: row.pmra, pmdec: row.pmdec }, 2000, year);
  return {
    oid: row.oid, mainId: row.main_id, name: cleanName(row.main_id), otype: row.otype,
    type: row.description || row.label || row.otype, ra2000: row.ra, dec2000: row.dec, pmra: row.pmra, pmdec: row.pmdec,
    plx: row.plx_value, plxErr: row.plx_err, sptype: row.sp_type, redshift: row.rvz_redshift, mags: { V: row.V, J: row.J, K: row.K },
    ra: raNow, dec: decNow, epoch: year, dist: ra == null ? 0 : sep(ra, dec, raNow, decNow),
  };
}

/**
 * Identify what is at a sky position *today*.
 * A plain cone search fails for nearby stars: catalogues store where they were in 2000, and
 * Barnard's Star has moved 270 arcseconds since. So fast movers in a wider area are fetched too
 * and every candidate is moved to today's date before matching.
 * `aimArcsec` is how precisely the position was pointed at (a click on a wide map is only good to
 * a few screen pixels): within that distance the brightest object wins, not the nearest.
 */
// How far from a star a click can still mean that star. A faint star can only be told apart from
// close to, so its reach ends at 40 arcseconds however coarse the map. A bright star is what the eye
// sees and clicks from far out, where a few pixels of the map are a minute or two of arc: its reach
// grows with its brightness, up to the pointing tolerance itself.
const pointOf = (m, aim) => Math.min(aim, m == null ? 40 : Math.min(200, Math.max(40, 40 + (8 - m) * 20)));
// And at any zoom, a bright star is a disc of glare in the SPHEREx pictures, not a point: about an
// arcminute across for Antares, nothing for a star of the eighth magnitude. A click inside that disc
// is a click on the star (whatever else catalogues list there is drowned in its light). This holds for
// a position pointed at by hand only (`glare`), never for coordinates that were typed.
const GLARE_MAX = 75;
const glareOf = m => (m == null ? 0 : Math.min(GLARE_MAX, Math.max(0, 10 + (6 - m) * 6)));
const reachOf = (m, aim, glare = false) => Math.max(pointOf(m, aim), glare ? glareOf(m) : 0);
const magOf = c => c.mags.K ?? c.mags.J ?? c.mags.V ?? null;
export const identify = (ra, dec, radiusArcsec = 12, aimArcsec = 0, glare = false) => identifyFull(ra, dec, radiusArcsec, aimArcsec, glare).then(x => x.best);

/**
 * Like identify, and also: `moved`, a star that catalogues list at this spot (where it was in
 * 2000) but that has since moved away. Typing a nearby star's catalogue coordinates lands here.
 */
export async function identifyFull(ra, dec, radiusArcsec = 12, aimArcsec = 0, glare = false) {
  const r = Math.max(radiusArcsec, 4), aim = Math.min(aimArcsec, 200);
  const here = `POINT('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)})`, away = `DISTANCE(POINT('ICRS', b.ra, b.dec), ${here})`;
  // The sky is crowded: a minute of arc around the centre of the Milky Way holds three thousand
  // catalogued objects. So the catalogue is asked for the nearest ones, and for the bright ones
  // within the pointing tolerance, never for "any".
  const [near, bright, movers] = await Promise.all([
    adql(`SELECT TOP 30 ${COLS}, ${away} AS d ${FROM} WHERE ${cone(ra, dec, (r + 6) / 3600)} ORDER BY d`),
    // Bright objects within reach, without asking the catalogue to sort them: sorted, the same question
    // takes it a quarter of a minute in a crowded field (and "ORDER BY f.K" it does not accept at all).
    aim > 4 || glare ? Promise.all([
      adql(`SELECT TOP 40 ${COLS} ${FROM} WHERE ${cone(ra, dec, (Math.max(aim, glare ? GLARE_MAX : 0) + 6) / 3600)} AND f.K < 3`).catch(() => []),
      adql(`SELECT TOP 60 ${COLS} ${FROM} WHERE ${cone(ra, dec, (Math.max(aim, glare ? 30 : 0) + 6) / 3600)} AND f.K < 8`).catch(() => []),
      adql(`SELECT TOP 60 ${COLS} ${FROM} WHERE ${cone(ra, dec, (Math.min(aim, 40) + 6) / 3600)} AND f.K < 12.5`).catch(() => []),
    ]).then(a => a.flat()) : [],
    adql(`SELECT TOP 40 ${COLS} ${FROM} WHERE ${cone(ra, dec, 0.13)} AND (b.pmra*b.pmra + b.pmdec*b.pmdec) > 40000`).catch(() => []),
  ]);
  // Planets and sub-components share their host's coordinates: prefer the host.
  const minor = c => /^(Pl|Pl\?|ev|err|reg|\?)$/.test(c.otype) ? 1 : 0;
  const seen = new Set(), cands = [], gone = [];
  for (const row of [...near, ...bright, ...movers]) {
    if (row.ra == null || seen.has(row.oid)) continue;
    seen.add(row.oid);
    const c = shape(row, ra, dec);
    if (c.dist <= Math.max(r, reachOf(magOf(c), aim, glare))) cands.push(c);
    else if (c.dist > 15 && sep(ra, dec, row.ra, row.dec) <= r + 3 && Math.hypot(row.pmra || 0, row.pmdec || 0) >= 100) gone.push(c);
  }
  gone.sort((a, b) => minor(a) - minor(b) || Math.hypot(b.pmra, b.pmdec) - Math.hypot(a.pmra, a.pmdec) || (a.mags.K ?? 99) - (b.mags.K ?? 99));
  const moved = gone[0] || null;
  if (!cands.length) return { best: null, moved };
  const mag = magOf;
  cands.sort((a, b) => minor(a) - minor(b) || a.dist - b.dist || (mag(a) ?? 99) - (mag(b) ?? 99));
  let best = cands[0];
  // Pointed at by hand: the brightest thing within reach of the pointer is what was meant. Distance
  // still counts (a full tolerance away costs as much as 2.5 magnitudes), so that the fainter of two
  // stars can be picked by clicking right on it.
  const cost = c => mag(c) + 2.5 * c.dist / reachOf(mag(c), aim, glare);
  const reach = cands.filter(c => !minor(c) && mag(c) !== null && c.dist <= reachOf(mag(c), aim, glare));
  if (reach.length) best = reach.sort((a, b) => cost(a) - cost(b))[0];
  else if (best.dist > r) best = cands.find(c => c.dist <= r) || best;      // a bright star out of its reach does not stand in for what is here
  best.others = cands.filter(c => c !== best).slice(0, 4).map(c => ({ name: c.name, type: c.type, dist: c.dist }));
  return { best, moved: null };
}

/** Look an object up by name in SIMBAD itself. Used when the name resolvers cannot be reached. */
export async function byName(name) {
  const t = name.trim().replace(/\s+/g, ' '), q = s => s.replace(/'/g, "''");
  const spaced = t.replace(/^(M|NGC|IC|HD|HR|HIP|GJ|LHS|TYC|BD|SAO|UGC|PGC|TOI|WASP|2MASS|WISE|WISEA)\s*(?=[\d+J-])/i, (m, c) => `${c.toUpperCase()} `);
  const ids = [...new Set([t, `NAME ${t}`, spaced, `V* ${t}`, `* ${t}`])];
  const rows = await adql(`SELECT TOP 1 ${COLS} ${FROM} JOIN ident AS i ON i.oidref = b.oid WHERE i.id IN (${ids.map(s => `'${q(s)}'`).join(', ')})`);
  if (!rows.length || rows[0].ra == null) return null;
  const c = shape(rows[0], null, null);
  return { name: c.name, ra2000: c.ra2000, dec2000: c.dec2000, pmra: c.pmra, pmdec: c.pmdec, plx: c.plx, ra: c.ra, dec: c.dec };
}

export async function aliases(oid) {
  try {
    const rows = await adql(`SELECT id FROM ident WHERE oidref = ${+oid}`);
    return rows.map(r => r.id);
  } catch { return []; }
}

/** The everyday name of an object, when SIMBAD knows one ("Kapteyn's Star" rather than "HD 33793"). */
export function commonName(ids) {
  const names = ids.filter(id => /^NAME /.test(id)).map(id => id.slice(5).trim()).filter(n => n.length > 2 && !/^[A-Z0-9 +.-]+$/.test(n));
  if (!names.length) return null;
  names.sort((a, b) => b.length - a.length);
  return names[0].replace(/(^|\s)([a-z])(?=[a-z']{2,})/g, (m, sp, c) => sp + c.toUpperCase());
}

// ---------------------------------------------------------------- Wikipedia
const GREEK = { alf: 'Alpha', bet: 'Beta', gam: 'Gamma', del: 'Delta', eps: 'Epsilon', zet: 'Zeta', eta: 'Eta', tet: 'Theta', iot: 'Iota', kap: 'Kappa', lam: 'Lambda', mu: 'Mu', nu: 'Nu', ksi: 'Xi', omi: 'Omicron', pi: 'Pi', rho: 'Rho', sig: 'Sigma', tau: 'Tau', ups: 'Upsilon', phi: 'Phi', chi: 'Chi', psi: 'Psi', ome: 'Omega' };
const GENITIVE = { And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae', Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Boötis', Cae: 'Caeli', Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris', CMi: 'Canis Minoris', Cap: 'Capricorni', Car: 'Carinae', Cas: 'Cassiopeiae', Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini', Col: 'Columbae', Com: 'Comae Berenices', CrA: 'Coronae Australis', CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis', Cyg: 'Cygni', Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani', For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii', Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis', LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis', Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis', Mus: 'Muscae', Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis', Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium', PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli', Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti', Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii', Tri: 'Trianguli', TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris', Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae' };

/** Turn catalogue identifiers into likely Wikipedia titles, most specific first. */
export function wikiTitles(ids) {
  const out = [];
  const push = t => { t = t.trim(); if (t && !out.includes(t)) out.push(t); };
  for (const id of ids) if (/^NAME /.test(id)) push(id.slice(5).replace(/\b([a-z])/g, (m, c, i) => i === 0 ? c.toUpperCase() : m));
  for (const id of ids) {
    let m = id.match(/^\*\s+(\w+?)(\d*)\s+(\w{3})(?:\s+([A-Z]))?$/);          // Bayer: "* eps Ind B"
    if (m && GENITIVE[m[3]]) {
      const base = GREEK[m[1]] ? `${GREEK[m[1]]}${m[2] ? ' ' + m[2] : ''} ${GENITIVE[m[3]]}` : `${m[1]} ${GENITIVE[m[3]]}`;
      if (m[4]) push(`${base} ${m[4]}`);
      push(base);
    }
    m = id.match(/^V\*\s+(\S+)\s+(\w{3})$/);                                   // variable star: "V* RW Aur"
    if (m && GENITIVE[m[2]]) push(`${m[1]} ${GENITIVE[m[2]]}`);
    m = id.match(/^M\s+(\d+)$/); if (m) push(`Messier ${m[1]}`);
    m = id.match(/^(NGC|IC)\s+(\d+)$/); if (m) push(`${m[1]} ${m[2]}`);
    m = id.match(/^(HD|HR|HIP|GJ|Gl|TOI|Kepler|TRAPPIST|WASP|LHS|Wolf|Ross|Luyten)[- ]?\s*(\S+)$/); if (m) push(`${m[1]} ${m[2]}`);
  }
  return out;
}

const ASTRO = /\b(star|stars|galaxy|galaxies|nebula|dwarf|cluster|quasar|supernova|constellation|planet|pulsar|binary|variable|astronom|light-years|parsec|magnitude)\b/i;

async function wikiSummary(title) {
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`);
  if (!r.ok) return null;
  const js = await r.json();
  if (js.type !== 'standard' || !ASTRO.test(`${js.description || ''} ${js.extract || ''}`)) return null;
  return { title: js.title, extract: js.extract, thumb: js.thumbnail?.source || null, url: js.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(js.title)}`, description: js.description || '' };
}

/** The same article in another language (a card found by wikipedia() or kept with a showcase object), or null if that Wikipedia has none. */
export async function wikipediaIn(lang, card) {
  try {
    const title = decodeURIComponent((card.url || '').split('/wiki/')[1] || card.title).replace(/_/g, ' ');
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=${lang}&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`);
    const local = Object.values((await r.json()).query?.pages || {})[0]?.langlinks?.[0]?.['*'];
    if (!local) return null;
    const s = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(local.replace(/ /g, '_'))}?redirect=true`);
    if (!s.ok) return null;
    const js = await s.json();
    if (js.type !== 'standard' || !js.extract) return null;
    return { title: js.title, extract: js.extract, thumb: card.thumb || js.thumbnail?.source || null, description: js.description || '', lang,
      url: js.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(js.title)}` };
  } catch { return null; }
}

/** Wikipedia card for an object, or null. Only pages that are clearly about astronomy are accepted. */
export async function wikipedia(titles) {
  for (const t of titles.slice(0, 6)) {
    try { const s = await wikiSummary(t); if (s) return s; } catch { /* next */ }
  }
  return null;
}

// ---------------------------------------------------------------- external tools
/** Links that open the same position in independent tools, so anyone can cross-check. */
export function externalLinks(ra, dec, info) {
  const c = `${ra.toFixed(5)}%20${dec >= 0 ? '%2B' : ''}${dec.toFixed(5)}`, host = simbadHost();
  const links = [];
  if (info?.mainId) links.push({ label: 'SIMBAD', title: G`Catalogue entry: names, type, measurements, references`, url: `${host}/simbad/sim-id?Ident=${encodeURIComponent(info.mainId)}` });
  else links.push({ label: 'SIMBAD', title: G`Everything catalogued within 1 arcminute`, url: `${host}/simbad/sim-coo?Coord=${c}&CooFrame=ICRS&Radius=1&Radius.unit=arcmin` });
  links.push(
    { label: 'WiseView', title: G`Backyard Worlds blink tool: the same spot in 15 years of WISE images`, url: `http://byw.tools/wiseview#ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&size=300&band=3&speed=20&zoom=9` },
    { label: 'ESASky', title: G`ESA sky viewer, 2MASS infrared`, url: `https://sky.esa.int/esasky/?target=${c}&hips=2MASS+color+JHK&fov=0.15&cooframe=J2000&sci=true` },
    { label: 'Legacy Survey', title: G`unWISE deep infrared image`, url: `https://www.legacysurvey.org/viewer?ra=${ra.toFixed(5)}&dec=${dec.toFixed(5)}&layer=unwise-neo7&zoom=13` },
    { label: 'VizieR', title: G`Published brightness measurements at every wavelength`, url: `https://vizier.cds.unistra.fr/vizier/sed/?submitSimbad=Photometry&-c=${c}&-c.r=5&-c.u=arcsec` },
  );
  return links;
}

// ---------------------------------------------------------------- plain-language types
const GLOSS = [
  [/^(BD\*|BD\?)$/, G`A brown dwarf: too big to be a planet, too small to shine like a star. It glows faintly in infrared from leftover heat.`],
  [/^Mi\*/, G`A Mira variable: a swollen red giant near the end of its life, pulsing brighter and fainter over months.`],
  [/^(TT\*|Or\*|Y\*O|Y\*\?|Ae\*)/, G`A newborn star, still gathering material from the cloud around it. Dust drifting past makes its light flicker.`],
  [/^BY\*/, G`A cool dwarf star with dark spots. As it spins, the spots turn in and out of view and its brightness changes a little.`],
  [/^PM\*/, G`A star close enough to us that its motion across the sky can be seen within a few years.`],
  [/^(LM\*|dM\*)/, G`A low-mass star: small, cool and dim, the most common kind of star in our galaxy.`],
  [/^(RG\*|AB\*|C\*|S\*|LP\*|sr\*|OH\*)/, G`A giant star late in its life: cool, swollen and very bright in infrared, often changing in brightness.`],
  [/^(RR\*|Ce\*|cC\*|dS\*|Pu\*)/, G`A pulsating star: it swells and shrinks in a regular rhythm, and its brightness follows.`],
  [/^(EB\*|El\*)/, G`Two stars orbiting each other so that one regularly passes in front of the other and dims the pair.`],
  [/^(SB\*|\*\*)/, G`Two stars bound together, orbiting each other.`],
  [/^WD\*/, G`A white dwarf: the hot, Earth-sized core left behind when a star like the Sun runs out of fuel.`],
  [/^(Er\*|Fl\*|RS\*|Ro\*)/, G`A magnetically active star whose brightness changes through flares or spots.`],
  [/^(No\*|CV\*)/, G`A pair of stars in which one feeds on the other, with occasional outbursts.`],
  [/^(SN\*|SNR)/, G`The site of an exploded star.`],
  [/^(Em\*|Be\*)/, G`A star surrounded by glowing gas.`],
  [/^V\*/, G`A variable star: its brightness changes over time.`],
  [/^(QSO|BLL|Bla|AGN|Sy1|Sy2|SyG|LIN)/, G`An active galaxy: the surroundings of a giant black hole at its centre shine across billions of light-years.`],
  [/^(G|GiG|GiP|GiC|BiC|IG|PaG|LSB|EmG|SBG|H2G|rG|bCG)$/, G`A galaxy: a distant island of billions of stars.`],
  [/^(ClG|GrG|CGG|SCG)/, G`A group or cluster of galaxies held together by gravity.`],
  [/^GlC/, G`A globular cluster: hundreds of thousands of ancient stars packed into a ball.`],
  [/^(OpC|Cl\*|As\*)/, G`A cluster of stars born together from the same cloud.`],
  [/^PN/, G`A planetary nebula: the glowing shell thrown off by a dying Sun-like star.`],
  [/^(HII|RNe|GNe|MoC|DNe|Cld|SFR|ISM)/, G`A cloud of gas and dust between the stars, often a place where new stars are forming.`],
  [/^Psr/, G`A pulsar: the dense, spinning remnant of an exploded star.`],
  [/^(Pl|Pl\?)$/, G`A planet orbiting another star.`],
  [/^(IR|NIR|MIR|FIR)$/, G`A source first noticed in infrared light; what it is has not been settled.`],
  [/^\*$/, G`A star.`],
];
/** One plain sentence for a SIMBAD object type code. */
export function gloss(otype, sptype = '') {
  // Spectral classes T and Y are brown dwarfs, whatever heading the catalogue files them under.
  // Class L straddles the line between the smallest stars and brown dwarfs, so it is described as such.
  const sp = (sptype || '').trim(), pair = /\+\s*[LTY]\d/.test(sp);
  if (/^[LTY]\d/.test(sp) && !/^(BD\*|BD\?)$/.test(otype || '')) {
    if (/[TY]\d/.test(sp)) {
      return pair ? G`A pair of brown dwarfs: objects too big to be planets and too small to shine like stars, orbiting each other.`
        : G`A brown dwarf: too big to be a planet, too small to shine like a star. It glows faintly in infrared from leftover heat.`;
    }
    return pair ? G`A pair of very cool dwarfs on the borderline between the smallest stars and brown dwarfs, brightest in infrared.`
      : G`A very cool dwarf on the borderline between the smallest stars and brown dwarfs, brightest in infrared.`;
  }
  for (const [re, text] of GLOSS) if (re.test(otype || '')) return text;
  return '';
}

// ---------------------------------------------------------------- catalogues for the overlays (VizieR)
const VIZIER = ['https://vizier.cds.unistra.fr/viz-bin/asu-tsv', 'https://vizier.cfa.harvard.edu/viz-bin/asu-tsv'];
let vizBase = null;

/** Rows of a VizieR catalogue around a position, brightest first. Tries CDS, then its mirror at Harvard. */
async function vizier(source, ra, dec, radiusArcmin, cols, sortBy, max = 600) {
  const query = `?-source=${encodeURIComponent(source)}&-c=${ra.toFixed(6)}${dec >= 0 ? '%2B' : ''}${dec.toFixed(6)}&-c.rm=${radiusArcmin.toFixed(2)}`
    + `&-out=${cols.join(',')}&-out.max=${max}&-sort=${sortBy}`;
  const order = vizBase ? [vizBase, ...VIZIER.filter(u => u !== vizBase)] : VIZIER;
  let last = new Error('VizieR unreachable');
  for (const base of order) {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(base + query, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const lines = (await r.text()).split('\n'), bar = lines.findIndex(l => /^-+(\t-+)*\s*$/.test(l));
      vizBase = base;
      if (bar < 2) return [];                                  // answered, but nothing there
      const names = lines[bar - 2].split('\t').map(s => s.trim()), rows = [];
      for (let i = bar + 1; i < lines.length && lines[i].trim(); i++) {
        const v = lines[i].split('\t');
        rows.push(Object.fromEntries(names.map((k, j) => [k, v[j] === undefined || v[j].trim() === '' ? null : +v[j]])));
      }
      return rows;
    } catch (e) { last = e; }
  }
  throw last;
}

/** Gaia DR3 stars with their proper motions (positions at 2016.0). */
export async function gaiaStars(ra, dec, radiusArcmin) {
  const rows = await vizier('I/355/gaiadr3', ra, dec, radiusArcmin, ['RA_ICRS', 'DE_ICRS', 'pmRA', 'pmDE', 'Gmag', 'Plx'], 'Gmag');
  return { cat: 'gaia', epoch: 2016.0, sources: rows.filter(r => r.RA_ICRS != null).map(r => ({ ra: r.RA_ICRS, dec: r.DE_ICRS, pmra: r.pmRA, pmdec: r.pmDE, plx: r.Plx, g: r.Gmag ?? 21 })) };
}

/** Infrared sources from WISE: CatWISE2020 where it can be reached, AllWISE otherwise. */
export async function wiseSources(ra, dec, radiusArcmin) {
  try {
    const rows = await vizier('II/365/catwise', ra, dec, radiusArcmin, ['RA_ICRS', 'DE_ICRS', 'W1mproPM', 'W2mproPM', 'pmRA', 'pmDE'], 'W2mproPM');
    if (rows.length) {
      return { cat: 'CatWISE2020', epoch: 2015.4, sources: rows.filter(r => r.RA_ICRS != null).map(r => ({ ra: r.RA_ICRS, dec: r.DE_ICRS,
        pmra: r.pmRA == null ? 0 : r.pmRA * 1000, pmdec: r.pmDE == null ? 0 : r.pmDE * 1000, w1: r.W1mproPM, w2: r.W2mproPM ?? 99 })) };
    }
  } catch { /* fall through to AllWISE */ }
  const rows = await vizier('II/328/allwise', ra, dec, radiusArcmin, ['RAJ2000', 'DEJ2000', 'W1mag', 'W2mag'], 'W2mag');
  // AllWISE motions mix real motion with parallax, so the sources are drawn where they were seen (2010.6).
  return { cat: 'AllWISE', epoch: 2010.6, sources: rows.filter(r => r.RAJ2000 != null).map(r => ({ ra: r.RAJ2000, dec: r.DEJ2000, pmra: 0, pmdec: 0, w1: r.W1mag, w2: r.W2mag ?? 99 })) };
}

// ---------------------------------------------------------------- overlay when VizieR cannot be reached
/** Catalogued stars with measured motion in a field (SIMBAD), shaped like the Gaia overlay. */
export async function fieldStars(ra, dec, radiusArcmin) {
  const rows = await adql(`SELECT TOP 300 b.main_id, b.ra, b.dec, b.pmra, b.pmdec, b.plx_value, f.V, f.G FROM basic AS b LEFT JOIN allfluxes AS f ON f.oidref = b.oid `
    + `WHERE CONTAINS(POINT('ICRS', b.ra, b.dec), CIRCLE('ICRS', ${ra.toFixed(6)}, ${dec.toFixed(6)}, ${(radiusArcmin / 60 + 0.05).toFixed(5)})) = 1 AND b.pmra IS NOT NULL`);
  return { cat: 'simbad', epoch: 2000.0, sources: rows.map(r => ({ id: r.main_id, ra: r.ra, dec: r.dec, pmra: r.pmra, pmdec: r.pmdec, plx: r.plx_value,
    g: r.G ?? r.V ?? (Math.hypot(r.pmra || 0, r.pmdec || 0) > 100 ? 10 : 17) })) };
}
