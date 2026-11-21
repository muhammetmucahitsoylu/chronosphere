// The same patch of sky over a quarter of a century.
//
// For the showcase stars, the images built by scripts/build_years.py: 2MASS (1997 to 2001), WISE in 2010 and
// NEOWISE every half year from 2014 to 2024, and SPHEREx, each visit stacked, all on one grid and in MJy/sr.
// For any other place, the 2MASS and AllWISE sky maps (HiPS) that NASA/IPAC's IRSA serves, read in this browser
// and laid on the grid of the SPHEREx images: pictures to look at, not to measure.
import * as C from './core.js';
import { G, N } from './lang.js';

const HIPS = 'https://irsa.ipac.caltech.edu/data/hips/CDS';
/** The band of 2MASS and the band of WISE nearest to each SPHEREx detector. */
export const NEAR = { 1: ['J', 'W1'], 2: ['H', 'W1'], 3: ['Ks', 'W1'], 4: ['Ks', 'W1'], 5: ['Ks', 'W2'], 6: ['Ks', 'W2'] };
/** Wavelength of each band, in microns. */
export const LAM = { J: 1.235, H: 1.662, Ks: 2.159, W1: 3.353, W2: 4.603 };
/** The colour each telescope is marked with in the caption. */
export const COLOR = { '2MASS': '#c77dff', WISE: '#4cc9f0', NEOWISE: '#4cc9f0', AllWISE: '#4cc9f0', SPHEREx: '#ffd166' };
const MAPS = { J: ['2MASS/J', 9], H: ['2MASS/H', 9], Ks: ['2MASS/K', 9], W1: ['AllWISE/W1', 8], W2: ['AllWISE/W2', 8] };
// AllWISE added up WISE's passes over each place in 2010 and early 2011: the middle of that year stands for its date.
const ALLWISE_MJD = 55400;

/** The files of a built star that the view needs for a detector: 2MASS, the nearer WISE band, SPHEREx. */
export const filesFor = det => ['years-2mass.ndjson', NEAR[det][1] === 'W1' ? 'years-w1.ndjson' : 'years-w2.ndjson', 'years-spherex.ndjson'];

/** One file written by scripts/build_years.py: its images, each with the level its brightest pixels are drawn at. */
export async function loadBuilt(url, signal) {
  const out = [];
  await C.loadStream(url, line => {
    if (line.t !== 'frame') return;
    const img = C.decodeF16(line.b64); delete line.b64;
    const st = C.robustStats(img);
    out.push({ ...line, img, sig: line.sig || st.sig, hi: Math.max(st.p(0.997), 25 * (line.sig || st.sig)) });
  }, signal);
  return out;
}

// ------------------------------------------------------------ HiPS maps, read in the browser
const rad = Math.PI / 180;
/** Where a direction falls on the HEALPix grid of a given resolution: face (0 to 11) and position on it, in pixels. */
function faceXY(nside, ra, dec) {
  const z = Math.sin(dec * rad), za = Math.abs(z), tt = (((ra / 90) % 4) + 4) % 4;
  if (za <= 2 / 3) {
    const t1 = nside * (0.5 + tt), t2 = nside * z * 0.75, jp = t1 - t2, jm = t1 + t2;
    const ifp = Math.floor(jp / nside), ifm = Math.floor(jm / nside);
    const face = ifp === ifm ? (ifp & 3) + 4 : ifp < ifm ? (ifp & 3) : (ifm & 3) + 8;
    return [face, jm - nside * ifm, nside - (jp - nside * ifp)];
  }
  const ntt = Math.min(3, Math.floor(tt)), tp = tt - ntt, tmp = nside * Math.sqrt(3 * (1 - za));
  const jp = tp * tmp, jm = (1 - tp) * tmp;
  return z >= 0 ? [ntt, nside - jm, nside - jp] : [ntt + 8, jp, jm];
}
const spread = v => { let r = 0; for (let i = 0; i < 16; i++) r += ((v >> i) & 1) * 4 ** i; return r; };

/**
 * A HiPS map laid on a grid: grey levels 0 to 255 as the map's makers stretched them, NaN where the map has no tile.
 * Within a tile, the row of a pixel is its x on the HEALPix face and its column its y (checked against Gaia stars:
 * spike/hips_check.py puts 2MASS stars within 0.5 to 0.8 arcseconds of their places).
 */
async function mapOnGrid(grid, band, signal) {
  const [path, maxOrder] = MAPS[band];
  const order = Math.max(3, Math.min(maxOrder, Math.round(Math.log2(412.3 / grid.scale)))), K = order + 9, nside = 2 ** K;
  const n = grid.n, where = new Float64Array(n * n * 3), need = new Set();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const [ra, dec] = C.gridToSky(grid, i, j), [face, x, y] = faceXY(nside, ra, dec), p = (j * n + i) * 3;
    where[p] = face; where[p + 1] = x - 0.5; where[p + 2] = y - 0.5;
    const ix = Math.floor(x), iy = Math.floor(y);
    for (const [a, b] of [[ix, iy], [ix + 1, iy + 1], [ix - 1, iy - 1]]) {
      const ax = Math.min(nside - 1, Math.max(0, a)), by = Math.min(nside - 1, Math.max(0, b));
      need.add(face * 4 ** order + spread(ax >> 9) + 2 * spread(by >> 9));
    }
  }
  const tiles = new Map();
  await Promise.all([...need].map(async t => {
    const url = `${HIPS}/${path}/Norder${order}/Dir${Math.floor(t / 10000) * 10000}/Npix${t}.jpg`;
    try {
      const r = await fetch(url, { signal });
      if (!r.ok) return;
      const bmp = await createImageBitmap(await r.blob());
      const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      const cx = cv.getContext('2d');
      cx.drawImage(bmp, 0, 0);
      const px = cx.getImageData(0, 0, bmp.width, bmp.height).data, g = new Uint8Array(bmp.width * bmp.height);
      for (let k = 0; k < g.length; k++) g[k] = px[4 * k];
      tiles.set(t, g);
    } catch (e) { if (e.name === 'AbortError') throw e; }
  }));
  if (!tiles.size) throw new Error('no tiles');
  const at = (face, x, y) => {
    x = Math.min(nside - 1, Math.max(0, x)); y = Math.min(nside - 1, Math.max(0, y));
    const g = tiles.get(face * 4 ** order + spread(x >> 9) + 2 * spread(y >> 9));
    return g ? g[(x & 511) * 512 + (y & 511)] : NaN;
  };
  const img = new Float32Array(n * n);
  for (let p = 0; p < n * n; p++) {
    const face = where[3 * p], x = where[3 * p + 1], y = where[3 * p + 2], ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    img[p] = (1 - fx) * (1 - fy) * at(face, ix, iy) + fx * (1 - fy) * at(face, ix + 1, iy) + (1 - fx) * fy * at(face, ix, iy + 1) + fx * fy * at(face, ix + 1, iy + 1);
  }
  return img;
}

/**
 * The 2MASS and AllWISE maps of a place, on its grid. `night` is the day 2MASS looked at the place (from its catalogue),
 * when known. The pictures carry the stretch their makers gave them: they are shown as they are, and not measured.
 */
export async function loadMaps(grid, night, signal) {
  const out = [];
  for (const band of ['J', 'H', 'Ks', 'W1', 'W2']) {
    try {
      const img = await mapOnGrid(grid, band, signal), twomass = band[0] !== 'W';
      out.push({ survey: twomass ? '2MASS' : 'AllWISE', band, lam: LAM[band], img, pic: true,
        mjd: twomass ? night ?? 51179 : ALLWISE_MJD, guessed: twomass && night == null });
    } catch (e) { if (e.name === 'AbortError') throw e; }
  }
  return out;
}

/** What an image of the view says about itself: when, which telescope and band, from how many exposures. */
export function caption(f) {
  const when = f.survey === 'AllWISE' ? '2010' : f.guessed ? '1997–2001' : f.t0 !== undefined && f.t1 - f.t0 > 1 ? C.fmtRange(f.t0, f.t1) : C.fmtDate(f.mjd);
  const what = f.survey === 'SPHEREx' ? `SPHEREx D${f.det}` : `${f.survey} ${f.band} · ${LAM[f.band].toFixed(2)} µm`;
  const how = f.pic ? G`sky map` : f.survey === '2MASS' ? G`Atlas Images` : f.n ? N(f.n, 'exposure') : '';
  return { title: f.survey === 'AllWISE' ? '2010' : f.guessed ? '1997–2001' : C.fmtMonth(f.mjd), sub: [what, how, f.guessed ? '' : when].filter(Boolean).join(' · ') };
}
