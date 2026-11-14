// The explorable sky: Aladin Lite showing the SPHEREx all-sky cube served by NASA/IPAC (IRSA).

import A from '../vendor/aladin.js';
import { tileUrl, tilesInView } from './healpix.js';

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

let al = null, overlay = null, tag = null, host = null, fovCb = null, layerId = 'spherex', slice = 25, ready = false;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sepDeg = (ra1, dec1, ra2, dec2) => {
  const r = Math.PI / 180, s = Math.sin(dec1 * r) * Math.sin(dec2 * r) + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(clamp(s, -1, 1)) / r;
};

export const waves = () => WAVES;
export const isReady = () => ready;
export const currentSlice = () => slice;
export const currentLayer = () => layerId;
export const isSpherex = () => layerId === 'spherex';

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
export function tiles({ ra, dec, fov, z = slice, w, h } = {}) {
  if (!host || BLANK.has(z)) return [];
  if (ra === undefined) { if (!al) return []; [ra, dec] = al.getRaDec(); fov = al.getFov()[0]; }
  return tilesInView(ra, dec, fov, w || host.clientWidth, h || host.clientHeight, 5).map(([o, p]) => tileUrl(LAYERS[0].url, o, p, z));
}
const tellFov = () => { if (al && fovCb) { try { fovCb(al.getFov()[0]); } catch { /* cosmetic */ } } };

export async function init(selector, { onClick, onFov } = {}) {
  await A.init;
  host = document.querySelector(selector); fovCb = onFov || null;
  al = A.aladin(selector, {
    survey: LAYERS[0].url, target: '266.4 -29.0', fov: fitFov(100), projection: 'SIN', cooFrame: 'ICRS',
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
  ready = true; tellFov();
  if (/[?&]debug\b/.test(location.search)) window.__chrono = { al, A };
  // The cube opens on its middle frame, which is blank: move to a real one as soon as the layer exists.
  const t0 = Date.now();
  const kick = () => { if (al.getBaseImageLayer()?.cubeDepth) setSlice(slice); else if (Date.now() - t0 < 15000) setTimeout(kick, 150); };
  kick();
  fetch(`${LAYERS[0].url}/properties`).then(r => r.text()).then(t => {
    const m = t.match(/data_cube_crval3_arr\s*=\s*(.+)/);
    if (m) { const w = m[1].trim().split(/\s+/).map(Number).filter(Number.isFinite); if (w.length > 50) WAVES = w; }
  }).catch(() => {});
  return al;
}

/** Show frame z (0-based, ascending wavelength) of the SPHEREx cube. */
export function setSlice(z) {
  z = clamp(Math.round(z), 0, WAVES.length - 1);
  while (BLANK.has(z)) z++;
  slice = z;
  const h = al?.getBaseImageLayer();
  if (!h || !h.cubeDepth) return z;
  // Aladin addresses cube frames by frequency, linearly between the cube's band edges.
  const c = 299792458, fMin = c / h.emMax, fMax = c / h.emMin;
  const f = fMin + (z + 0.5) * (fMax - fMin) / h.cubeDepth;
  h.setSliceNumber((c / f - h.emMin) / (h.emMax - h.emMin) * h.cubeDepth);
  return z;
}

export function setLayer(id) {
  const L = LAYERS.find(l => l.id === id) || LAYERS[0];
  layerId = L.id;
  al.setBaseImageLayer(al.newImageSurvey(L.url, { name: L.label }));
  if (L.cube) { const t0 = Date.now(); const kick = () => { if (al.getBaseImageLayer()?.cubeDepth) setSlice(slice); else if (Date.now() - t0 < 15000) setTimeout(kick, 150); }; kick(); }
}

export const fov = () => (al ? al.getFov()[0] : 60);
/** Zoom in (factor below 1) or out (above 1) around the centre of the view. */
export function zoomBy(factor) {
  if (!al) return;
  al.setFoV(clamp(al.getFov()[0] * factor, 0.03, 180));
  tellFov();
}
export const center = () => (al ? al.getRaDec() : [0, 0]);
export function resize() { window.dispatchEvent(new Event('resize')); }

/** Fly to a position the way a globe viewer does: pull back, travel, dive in. */
export function flyTo(ra, dec, targetFov = 0.6) {
  return new Promise(resolve => {
    if (!al) return resolve();
    // People who ask their device for less motion get there in one step, without the flight.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { al.gotoRaDec(ra, dec); al.setFoV(targetFov); tellFov(); return resolve(); }
    const [cra, cdec] = al.getRaDec(), d = sepDeg(cra, cdec, ra, dec), f0 = al.getFov()[0];
    let done = false; const finish = () => { if (!done) { done = true; tellFov(); resolve(); } };
    setTimeout(finish, 6000);                                   // never hang the UI on an animation
    if (d < f0 * 0.02 && Math.abs(Math.log(f0 / targetFov)) < 0.1) { al.gotoRaDec(ra, dec); return finish(); }
    const dive = () => (Math.abs(Math.log(al.getFov()[0] / targetFov)) < 0.05 ? finish() : al.zoomToFoV(targetFov, 1.3, finish));
    const travel = () => (d < 1e-4 ? dive() : al.animateToRaDec(ra, dec, clamp(0.5 + d / 45, 0.5, 2.4), dive));
    const wide = fitFov(Math.min(Math.max(f0, d * 1.5, targetFov), 140));
    if (wide > f0 * 1.25) al.zoomToFoV(wide, 0.8, travel); else travel();
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
    tag?.addSources([A.source(ra, dec, { name: short ? `\u2003\u2002${short}` : '' })]);
  } catch { /* marker is cosmetic */ }
}
export function clearMark() { try { overlay?.removeAll(); tag?.removeAll(); } catch { /* ignore */ } }
