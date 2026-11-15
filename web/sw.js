// Offline support. After one visit the page, the tour objects and every sky-map tile already seen
// are served from this device, so a poor connection does not stop a demonstration.

// VERSION is replaced with the commit id when the site is published, so every release is its own set.
const VERSION = 'dev-93';
const SHELL = `chrono-shell-${VERSION}`, DATA = 'chrono-data-v2', TILES = 'chrono-tiles-v1', LOOKUP = 'chrono-lookup-v1';
const KEEP = new Set([SHELL, DATA, TILES, LOOKUP, 'chrono-live-v1']);
const SHELL_FILES = ['./', 'opening.jpg', 'css/style.css', 'css/fonts.css', 'config.js', 'vendor/aladin.js', 'data/targets.json',
  'js/app.js', 'js/core.js', 'js/plot.js', 'js/sky.js', 'js/info.js', 'js/tour.js', 'js/pages.js', 'js/archive.js', 'js/healpix.js',
  'fonts/IBMPlexMono-400-latin-ext.woff2', 'fonts/IBMPlexMono-400-latin.woff2', 'fonts/IBMPlexMono-500-latin-ext.woff2', 'fonts/IBMPlexMono-500-latin.woff2', 'fonts/IBMPlexSans-400-latin-ext.woff2', 'fonts/IBMPlexSans-400-latin.woff2', 'fonts/IBMPlexSans-500-latin-ext.woff2', 'fonts/IBMPlexSans-500-latin.woff2', 'fonts/IBMPlexSans-600-latin-ext.woff2', 'fonts/IBMPlexSans-600-latin.woff2', 'fonts/InstrumentSerif-400-latin-ext.woff2', 'fonts/InstrumentSerif-400-latin.woff2', 'fonts/InstrumentSerif-400i-latin-ext.woff2', 'fonts/InstrumentSerif-400i-latin.woff2'];

// The sky maps describe themselves in a small "properties" file that the map asks for before anything
// else, on the very first visit, before this worker is in charge. Fetch them here so the map can start
// without a connection, and quickly with one.
const HIPS = 'https://irsa.ipac.caltech.edu/data/hips';
const MAPS = [`${HIPS}/SPHEREx/spherex_allsky_cube`, `${HIPS}/CDS/2MASS/Color`, `${HIPS}/CDS/AllWISE/RGB-W4-W2-W1`, `${HIPS}/CDS/DSS2/color`];
const MAP_FILES = [...MAPS.map(m => `${m}/properties`), `${MAPS[0]}/Moc.fits`];

self.addEventListener('install', e => {
  // Only the site's own files hold up a new version; they come from one place and arrive together.
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(SHELL_FILES.map(f => c.add(new Request(f, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('chrono-') && !KEEP.has(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
    // The archive can be slow to answer, so its small map files are fetched after taking over, not before.
    .then(() => caches.open(LOOKUP)).then(c => Promise.all(MAP_FILES.map(f => c.match(f).then(hit => hit || c.add(f)).catch(() => null)))));
});

const storable = r => r && r.ok && r.status === 200 && (r.type === 'basic' || r.type === 'cors');

/** A slow or failing archive should not leave holes in the map: give up after a while and try once more. */
async function patientFetch(req, tries, timeoutMs) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(req, { signal: ctl.signal });
      clearTimeout(timer);
      if (r.status < 500) return r;
      last = r;
    } catch (err) { clearTimeout(timer); last = err; if (!self.navigator.onLine) break; }
  }
  if (last instanceof Response) return last;
  throw last;
}

async function cacheFirst(req, name, limit) {
  const hit = await caches.match(req, { ignoreVary: true });          // any of our caches
  if (hit) return hit;
  const c = await caches.open(name);
  const r = limit ? await patientFetch(req, 2, 15000) : await fetch(req);
  if (storable(r)) {
    c.put(req, r.clone());
    if (limit && Math.random() < 0.02) c.keys().then(ks => ks.slice(0, Math.max(0, ks.length - limit)).forEach(k => c.delete(k)));
  }
  return r;
}
/** The page and its code are stored as one set per version, so a slow connection can never mix
 *  new files with old ones. A new version is fetched whole, then takes over. */
async function shell(req) {
  const c = await caches.open(SHELL);
  const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate', ignoreVary: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (storable(r)) c.put(req, r.clone());
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

/** Answer from storage straight away and refresh the stored copy in the background.
 *  When a sky map announces a new release, its stored tiles are dropped so the new ones are fetched. */
async function freshLater(req) {
  const c = await caches.open(LOOKUP), hit = await c.match(req.url);
  const refresh = fetch(req.url).then(async r => {
    if (!storable(r)) return r;
    if (hit && req.url.endsWith('/properties')) {
      const date = t => (t.match(/hips_release_date\s*=\s*(\S+)/) || [])[1];
      const [was, now] = await Promise.all([hit.clone().text(), r.clone().text()]);
      if (date(was) && date(now) && date(was) !== date(now)) await caches.delete(TILES);
    }
    await c.put(req.url, r.clone());
    return r;
  });
  if (hit) { refresh.catch(() => null); return hit.clone(); }
  return refresh;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;        // partial reads of FITS files go straight to the network
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/__live/')) return;
    if (/\/index\/manifest\.json$/.test(url.pathname)) e.respondWith(networkFirst(req, LOOKUP, 4000));        // says whether the sky index was rebuilt
    else if (/\/(data\/[^/]+\/|fonts\/|vendor\/|index\/c\/)/.test(url.pathname)) e.respondWith(cacheFirst(req, DATA));   // big, versioned by their address
    else e.respondWith(shell(req));                                    // the page and its code: one consistent set
    return;
  }
  if (url.hostname === 'irsa.ipac.caltech.edu' && url.pathname.startsWith('/data/hips/')) {
    if (/\/(properties|Moc\.fits)$/.test(url.pathname)) e.respondWith(freshLater(req));     // answer at once, refresh behind the scenes
    else e.respondWith(cacheFirst(req, TILES, 4000));                   // tiles of one release never change
    return;
  }
  if (/simbad|wikipedia\.org|wikimedia\.org|cds\.unistra\.fr|cfa\.harvard\.edu/.test(url.hostname)) {
    e.respondWith(networkFirst(req, LOOKUP, 7000));                     // names, types, encyclopedia cards
  }
});
