// Offline support. After one visit the page, the tour objects and every sky-map tile already seen
// are served from this device, so a poor connection does not stop a demonstration.

const SHELL = 'chrono-shell-v3', DATA = 'chrono-data-v1', TILES = 'chrono-tiles-v1', LOOKUP = 'chrono-lookup-v1';
const KEEP = new Set([SHELL, DATA, TILES, LOOKUP, 'chrono-live-v1']);
const SHELL_FILES = ['./', 'index.html', 'css/style.css', 'css/fonts.css', 'config.js', 'vendor/aladin.js', 'data/targets.json',
  'js/app.js', 'js/core.js', 'js/plot.js', 'js/sky.js', 'js/info.js', 'js/tour.js', 'js/pages.js', 'js/archive.js',
  'fonts/IBMPlexMono-400-latin-ext.woff2', 'fonts/IBMPlexMono-400-latin.woff2', 'fonts/IBMPlexMono-500-latin-ext.woff2', 'fonts/IBMPlexMono-500-latin.woff2', 'fonts/IBMPlexSans-400-latin-ext.woff2', 'fonts/IBMPlexSans-400-latin.woff2', 'fonts/IBMPlexSans-500-latin-ext.woff2', 'fonts/IBMPlexSans-500-latin.woff2', 'fonts/IBMPlexSans-600-latin-ext.woff2', 'fonts/IBMPlexSans-600-latin.woff2', 'fonts/InstrumentSerif-400-latin-ext.woff2', 'fonts/InstrumentSerif-400-latin.woff2', 'fonts/InstrumentSerif-400i-latin-ext.woff2', 'fonts/InstrumentSerif-400i-latin.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_FILES.map(f => c.add(f).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('chrono-') && !KEEP.has(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const storable = r => r && r.ok && r.status === 200 && (r.type === 'basic' || r.type === 'cors');

async function cacheFirst(req, name, limit) {
  const hit = await caches.match(req, { ignoreVary: true });          // any of our caches
  if (hit) return hit;
  const c = await caches.open(name);
  const r = await fetch(req);
  if (storable(r)) {
    c.put(req, r.clone());
    if (limit && Math.random() < 0.02) c.keys().then(ks => ks.slice(0, Math.max(0, ks.length - limit)).forEach(k => c.delete(k)));
  }
  return r;
}
async function networkFirst(req, name, timeoutMs) {
  const c = await caches.open(name);
  try {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(req, { signal: ctl.signal });
    clearTimeout(timer);
    if (storable(r)) c.put(req, r.clone());
    return r;
  } catch (err) {
    const hit = await caches.match(req, { ignoreVary: true, ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;        // partial reads of FITS files go straight to the network
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/__live/')) return;
    if (/\/(data|fonts|vendor)\//.test(url.pathname) || /\/index\/c\//.test(url.pathname)) e.respondWith(cacheFirst(req, DATA));
    else e.respondWith(networkFirst(req, SHELL, 3000));                 // page and code: fresh when online, cached when not
    return;
  }
  if (url.hostname === 'irsa.ipac.caltech.edu' && url.pathname.startsWith('/data/hips/')) {
    e.respondWith(cacheFirst(req, TILES, 4000));                        // sky-map tiles never change
    return;
  }
  if (/simbad|wikipedia\.org|wikimedia\.org|cds\.unistra\.fr/.test(url.hostname)) {
    e.respondWith(networkFirst(req, LOOKUP, 7000));                     // names, types, encyclopedia cards
  }
});
