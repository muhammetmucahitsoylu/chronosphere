// Plain pages with addresses of their own, in all six languages, so that a search engine, a link preview or a
// browser without scripts can read what the site otherwise shows only through its code:
//   - the three information pages ("What is SPHEREx?", "How it works", "About"), from web/js/pages.js and
//     web/js/pages/<code>.js: the same words the site shows as sheets over the map;
//   - "Planet X, Pluto and SPHEREx", from the guided tour's own words in web/js/lang.js;
//   - one page for each of the five test objects and for Pluto, from web/data/targets.json, the tour and the panel's dictionaries.
// The pictures they show are made by scripts/build_images.py. After changing any of these words, run
//   node scripts/build_pages.mjs
//
// Writes web/<name>.html for English, web/<code>/<name>.html for the other languages, and web/sitemap.xml.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), WEB = join(HERE, '..', 'web');
const SITE = 'https://chronospherex.com/';
const SHEET_FILES = { spherex: 'what-is-spherex.html', how: 'how-it-works.html', about: 'about.html' };
const ENGLISH_NAV = { spherex: 'What is SPHEREx?', how: 'How it works', about: 'About' };
const OBJECT_FILES = { barnard: 'barnards-star.html', epsindib: 'epsilon-indi-b.html', wise0855: 'wise-0855.html', rwaur: 'rw-aurigae.html', rdra: 'r-draconis.html', pluto: 'pluto.html' };
const FILES = { ...SHEET_FILES, planetx: 'planet-x.html', ...OBJECT_FILES };
const TARGETS = JSON.parse(readFileSync(join(WEB, 'data', 'targets.json'), 'utf8'));
const TOUR_KEYS = ['tour.3.title', 'tour.3.text', 'tour.px.title', 'tour.px.text', 'tour.faint.title', 'tour.faint.text', 'tour.4.title', 'tour.4.text',
  'hero.tour', 'ladder.title', 'ladder.note', 'ladder.limit', 'ladder.r1', 'ladder.r2', 'ladder.r3', 'ladder.r4', 'ladder.r5', 'ladder.r6', ...TARGETS.map(o => `tour.${o.slug}`)];
// The ladder of brightness, as the tour shows it (see RUNGS in web/js/app.js for the numbers and their sources).
const RUNGS = [['−1.5', 'r1'], ['6', 'r2'], ['9.5', 'r3'], ['15', 'r4'], ['19', 'r5'], ['22–25', 'r6']];

// Words these pages need that the site itself does not say anywhere.
const DOC = {
  en: {
    open: 'Open the sky map', sources: 'Sources', objects: 'The test objects',
    pxTitle: 'Planet X, Pluto and SPHEREx',
    pxLead: 'The search for a planet beyond Neptune found Pluto in 1930. How it was found, what astronomers predict today, and whether NASA’s SPHEREx could see it.',
    plutoAlt: 'Two SPHEREx exposures of the same patch of sky, taken six days apart in October 2025 and shown in turn. One dot moves: Pluto.',
    plutoCap: 'Pluto in SPHEREx images of 6 and 12 October 2025, shown in turn: the one dot that moves, 50 arcseconds in six days. Tombaugh’s two plates were also six days apart, taken on 23 and 29 January 1930.',
    title: n => `${n} in SPHEREx images`, alt: (n, how) => `SPHEREx images of ${n}: ${how}`,
    how: { visit: 'one picture per visit', month: 'one picture per month', det: 'one picture per detector, from 0.75 to 5 microns', stop: 'one picture for every stop of the telescope that caught it' },
    openIt: n => `Open ${n} in Chronosphere`, facts: (k, a, b) => `SPHEREx has ${k} exposures of this spot, from ${a} to ${b}.`,
  },
  tr: {
    open: 'Gökyüzü haritasını aç', sources: 'Kaynaklar', objects: 'Test nesneleri',
    pxTitle: 'X Gezegeni, Plüton ve SPHEREx',
    pxLead: 'Neptün’ün ötesindeki bir gezegeni arayanlar 1930’da Plüton’u buldu. Plüton nasıl bulundu, gökbilimciler bugün neyi öngörüyor ve NASA’nın SPHEREx teleskobu onu görebilir mi?',
    plutoAlt: 'Aynı gökyüzü parçasının Ekim 2025’te altı gün arayla çekilmiş iki SPHEREx pozu, sırayla gösteriliyor. Bir nokta yer değiştiriyor: Plüton.',
    plutoCap: '6 ve 12 Ekim 2025 tarihli SPHEREx görüntülerinde Plüton, sırayla gösteriliyor: yeri değişen tek nokta, altı günde 50 yay saniyesi. Tombaugh’un iki fotoğraf plakası da altı gün arayla, 23 ve 29 Ocak 1930’da çekilmişti.',
    title: n => `SPHEREx görüntülerinde ${n}`, alt: (n, how) => `${n}, SPHEREx görüntüleri: ${how}`,
    how: { visit: 'her ziyaret için bir resim', month: 'her ay için bir resim', det: '0,75 ile 5 mikron arasında her dedektör için bir resim', stop: 'teleskobun onu yakaladığı her durak için bir resim' },
    openIt: n => `Chronosphere’de aç: ${n}`, facts: (k, a, b) => `SPHEREx’in bu noktaya ait ${k} pozu var: ${a} ile ${b} arasında.`,
  },
  es: {
    open: 'Abrir el mapa del cielo', sources: 'Fuentes', objects: 'Los objetos de prueba',
    pxTitle: 'El Planeta X, Plutón y SPHEREx',
    pxLead: 'La búsqueda de un planeta más allá de Neptuno encontró a Plutón en 1930. Cómo se encontró, qué predicen hoy los astrónomos y si SPHEREx, de la NASA, podría verlo.',
    plutoAlt: 'Dos exposiciones de SPHEREx de la misma zona del cielo, tomadas con seis días de diferencia en octubre de 2025 y mostradas por turnos. Un punto se mueve: Plutón.',
    plutoCap: 'Plutón en imágenes de SPHEREx del 6 y el 12 de octubre de 2025, mostradas por turnos: el único punto que se mueve, 50 segundos de arco en seis días. Las dos placas de Tombaugh también se tomaron con seis días de diferencia, el 23 y el 29 de enero de 1930.',
    title: n => `${n} en imágenes de SPHEREx`, alt: (n, how) => `Imágenes de SPHEREx de ${n}: ${how}`,
    how: { visit: 'una imagen por visita', month: 'una imagen por mes', det: 'una imagen por detector, de 0,75 a 5 micras', stop: 'una imagen por cada parada del telescopio que lo captó' },
    openIt: n => `Abrir ${n} en Chronosphere`, facts: (k, a, b) => `SPHEREx tiene ${k} exposiciones de este punto, del ${a} al ${b}.`,
  },
  de: {
    open: 'Himmelskarte öffnen', sources: 'Quellen', objects: 'Die Testobjekte',
    pxTitle: 'Planet X, Pluto und SPHEREx',
    pxLead: 'Die Suche nach einem Planeten jenseits des Neptun fand 1930 Pluto. Wie er gefunden wurde, was Astronomen heute vorhersagen und ob SPHEREx, das Teleskop der NASA, ihn sehen könnte.',
    plutoAlt: 'Zwei SPHEREx-Aufnahmen derselben Himmelsgegend, im Oktober 2025 im Abstand von sechs Tagen aufgenommen und abwechselnd gezeigt. Ein Punkt wandert: Pluto.',
    plutoCap: 'Pluto auf SPHEREx-Aufnahmen vom 6. und 12. Oktober 2025, abwechselnd gezeigt: der einzige Punkt, der wandert, 50 Bogensekunden in sechs Tagen. Auch Tombaughs zwei Fotoplatten lagen sechs Tage auseinander, aufgenommen am 23. und 29. Januar 1930.',
    title: n => `${n} auf SPHEREx-Aufnahmen`, alt: (n, how) => `SPHEREx-Aufnahmen von ${n}: ${how}`,
    how: { visit: 'eine Aufnahme pro Besuch', month: 'eine Aufnahme pro Monat', det: 'eine Aufnahme pro Detektor, von 0,75 bis 5 Mikrometer', stop: 'ein Bild für jeden Halt des Teleskops, bei dem er erfasst wurde' },
    openIt: n => `${n} in Chronosphere öffnen`, facts: (k, a, b) => `SPHEREx hat ${k} Aufnahmen dieser Stelle, vom ${a} bis zum ${b}.`,
  },
  fr: {
    open: 'Ouvrir la carte du ciel', sources: 'Sources', objects: 'Les objets de test',
    pxTitle: 'La planète X, Pluton et SPHEREx',
    pxLead: 'La recherche d’une planète au-delà de Neptune a trouvé Pluton en 1930. Comment elle a été trouvée, ce que prédisent aujourd’hui les astronomes, et si SPHEREx, le télescope de la NASA, pourrait la voir.',
    plutoAlt: 'Deux poses SPHEREx de la même région du ciel, prises à six jours d’intervalle en octobre 2025 et montrées tour à tour. Un point se déplace : Pluton.',
    plutoCap: 'Pluton sur des images SPHEREx des 6 et 12 octobre 2025, montrées tour à tour : le seul point qui se déplace, 50 secondes d’arc en six jours. Les deux plaques de Tombaugh avaient elles aussi été prises à six jours d’intervalle, les 23 et 29 janvier 1930.',
    title: n => `${n} sur les images SPHEREx`, alt: (n, how) => `Images SPHEREx de ${n} : ${how}`,
    how: { visit: 'une image par visite', month: 'une image par mois', det: 'une image par détecteur, de 0,75 à 5 microns', stop: 'une image pour chaque arrêt du télescope qui l’a saisie' },
    openIt: n => `Ouvrir ${n} dans Chronosphere`, facts: (k, a, b) => `SPHEREx a ${k} poses de ce point, du ${a} au ${b}.`,
  },
  pl: {
    open: 'Otwórz mapę nieba', sources: 'Źródła', objects: 'Obiekty testowe',
    pxTitle: 'Planeta X, Pluton i SPHEREx',
    pxLead: 'Poszukiwania planety za Neptunem doprowadziły w 1930 roku do odkrycia Plutona. Jak go znaleziono, co przewidują dziś astronomowie i czy teleskop SPHEREx należący do NASA mógłby ją zobaczyć.',
    plutoAlt: 'Dwie ekspozycje SPHEREx tego samego fragmentu nieba, wykonane w październiku 2025 roku w odstępie sześciu dni i pokazywane na zmianę. Jeden punkt się przesuwa: to Pluton.',
    plutoCap: 'Pluton na zdjęciach SPHEREx z 6 i 12 października 2025 roku, pokazywanych na zmianę: jedyny punkt, który się przesuwa, o 50 sekund łuku w sześć dni. Dwie klisze Tombaugha również dzieliło sześć dni: wykonano je 23 i 29 stycznia 1930 roku.',
    title: n => `${n} na zdjęciach SPHEREx`, alt: (n, how) => `Zdjęcia SPHEREx: ${n}, ${how}`,
    how: { visit: 'jedno zdjęcie na wizytę', month: 'jedno zdjęcie na miesiąc', det: 'jedno zdjęcie na detektor, od 0,75 do 5 mikrometrów', stop: 'jedno zdjęcie na każdy postój teleskopu, który go uchwycił' },
    openIt: n => `Otwórz w Chronosphere: ${n}`, facts: (k, a, b) => `SPHEREx ma ${k} ekspozycji tego miejsca, od ${a} do ${b}.`,
  },
};
// Object names as each language writes them (the tour's ladder already names Barnard's Star in every language).
const NAME = (code, o, words) => (o.slug === 'barnard' ? words['ladder.r3'] : o.slug === 'pluto' ? words['ladder.r4'] : o.label);
const PX_SOURCES = [
  ['NASA: Hypothetical Planet X', 'https://science.nasa.gov/solar-system/planet-x/'],
  ['NASA: Pluto', 'https://science.nasa.gov/dwarf-planets/pluto/'],
  ['Lowell Observatory: the Pluto discovery plates', 'https://collectionslowellobservatory.omeka.net/items/show/1247'],
  ['Batygin & Brown 2016', 'https://doi.org/10.3847/0004-6256/151/2/22'],
  ['Brown & Batygin 2016', 'https://doi.org/10.3847/2041-8205/824/2/L23'],
  ['Brown, Holman & Batygin 2024', 'https://arxiv.org/abs/2401.17977'],
  ['Crill et al. 2025, the SPHEREx sky simulator', 'https://arxiv.org/abs/2505.24856'],
  ['JPL Horizons: where Pluto was', 'https://ssd.jpl.nasa.gov/horizons/'],
];

// One language at a time, each in a process of its own: the site's code fixes its language when it is loaded.
if (process.argv[2] === '--one') {
  const code = process.argv[3];
  globalThis.location = { search: code === 'en' ? '' : `?lang=${code}` };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const { SHEETS, NAV } = await import(pathToFileURL(join(WEB, 'js', 'pages.js')).href);
  const L = await import(pathToFileURL(join(WEB, 'js', 'lang.js')).href);
  if (L.lang !== code) throw new Error(`asked for ${code}, got ${L.lang}`);
  if (code !== 'en' && !NAV) throw new Error(`no pages in ${code}`);
  const words = Object.fromEntries(TOUR_KEYS.map(k => [k, L.t(k)]));
  for (const o of TARGETS) for (const s of [o.blurb, o.look, o.type]) words[s] = L.G(s);
  words['What to look for'] = L.G('What to look for');
  process.stdout.write(JSON.stringify({ LANGS: L.LANGS, nav: NAV || ENGLISH_NAV, words, sheets: Object.fromEntries(Object.keys(SHEET_FILES).map(id => [id, SHEETS[id]()])) }));
  process.exit(0);
}

const read = code => {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--one', code], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${code}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = s => s.replace(/&(?!\w+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const italics = s => esc(s).replace(/\*([^*]+)\*/g, '<i>$1</i>');          // the tour's *words in asterisks*
const path = (code, id) => (code === 'en' ? '' : `${code}/`) + FILES[id];
const mjdDate = (mjd, code) => new Intl.DateTimeFormat(code, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date((mjd - 40587) * 864e5));

const first = read('en'), codes = Object.keys(first.LANGS), all = { en: first };
for (const code of codes) if (code !== 'en') all[code] = read(code);

/** The body of each page, its title and description, and the picture that stands for it in a link preview. */
function content(code, id) {
  const { sheets, words: w, nav } = all[code], D = DOC[code];
  if (SHEET_FILES[id]) {
    const body = sheets[id];
    return { body, title: plain((body.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || nav[id]), lead: plain((body.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || ''), image: 'preview.png' };
  }
  const up = code === 'en' ? '' : '../';
  if (id === 'planetx') {
    const rungs = RUNGS.map(([m, k]) => `${k === 'r6' ? `<li class="limit">${esc(w['ladder.limit'])}</li>` : ''}<li><b>${m}</b> ${esc(w[`ladder.${k}`])}</li>`).join('');
    const body = `
    <p class="eyebrow">${esc(w['tour.px.title'])}</p>
    <h1>${esc(D.pxTitle)}</h1>
    <p class="lead">${esc(D.pxLead)}</p>
    <h2>${esc(w['tour.3.title'])}</h2>
    <p>${italics(w['tour.3.text'])}</p>
    <figure class="docfig"><img src="${up}img/pluto-blink.gif" width="360" height="360" alt="${attr(D.plutoAlt)}"><figcaption>${esc(D.plutoCap)}</figcaption></figure>
    <h2>${esc(w['tour.px.title'])}</h2>
    <p>${italics(w['tour.px.text'])}</p>
    <h2>${esc(w['tour.faint.title'])}</h2>
    <p>${italics(w['tour.faint.text'])}</p>
    <h3>${esc(w['ladder.title'])}</h3>
    <ol class="docrungs">${rungs}</ol>
    <p class="fine">${esc(w['ladder.note'])}</p>
    <h2>${esc(w['tour.4.title'])}</h2>
    <p>${italics(w['tour.4.text'])}</p>
    <p class="docgo"><a class="cta" href="${up}?tour${code === 'en' ? '' : `&lang=${code}`}">${esc(w['hero.tour'])}</a></p>
    <p class="fine">${esc(D.sources)}: ${PX_SOURCES.map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>`;
    return { body, title: D.pxTitle, lead: D.pxLead, image: 'img/pluto-blink.jpg' };
  }
  const o = TARGETS.find(t => OBJECT_FILES[t.slug] && t.slug === id), name = NAME(code, o, w);
  const how = o.view.mode === 'trail' ? D.how.stop : o.view.mode === 'bands' ? D.how.det : o.slug === 'rdra' ? D.how.month : D.how.visit;
  const eps = o.summary.epochs, facts = D.facts(new Intl.NumberFormat(code).format(o.summary.total), mjdDate(eps[0][0], code), mjdDate(eps[eps.length - 1][1], code));
  const open = `${up}?target=${o.slug}${code === 'en' ? '' : `&lang=${code}`}`;
  const simbad = `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(o.info?.mainId || o.query)}`;
  const wiki = o.wikiCard?.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(o.wikiCard.title.replace(/ /g, '_'))}` : null;
  const body = `
    <p class="eyebrow">${esc(w[o.type])}${o.sp ? ` · ${esc(o.sp)}` : ''}</p>
    <h1>${esc(name)}</h1>
    <p class="lead">${esc(w[o.blurb])}</p>
    <figure class="docfig"><img src="${up}img/${o.slug}.gif" width="392" height="392" alt="${attr(D.alt(name, how))}"><figcaption>${esc(D.alt(name, how))}</figcaption></figure>
    <p>${italics(w[`tour.${o.slug}`])}</p>
    <h2>${esc(w['What to look for'])}</h2>
    <p>${esc(w[o.look])}</p>
    <p>${esc(facts)}</p>
    <p class="docgo"><a class="cta" href="${open}">${esc(D.openIt(name))}</a></p>
    <p class="fine">${esc(D.sources)}: <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx, NASA/JPL-Caltech, IRSA</a> · ${o.eph
      ? `<a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT, IMCCE</a>`
      : `<a href="${simbad}" target="_blank" rel="noopener">SIMBAD</a> · <a href="https://www.cosmos.esa.int/web/gaia/dr3" target="_blank" rel="noopener">Gaia DR3</a>`}${wiki ? ` · <a href="${wiki}" target="_blank" rel="noopener">Wikipedia</a>` : ''}</p>`;
  return { body, title: D.title(name), lead: `${w[o.blurb]} ${D.alt(name, how)}.`, image: `img/${o.slug}.jpg` };
}

const urls = [SITE];
for (const code of codes) {
  const { nav, words: w, LANGS } = all[code], D = DOC[code], up = code === 'en' ? '' : '../', home = `${up}${code === 'en' ? './' : `?lang=${code}`}`;
  if (code !== 'en') mkdirSync(join(WEB, code), { recursive: true });
  for (const id of Object.keys(FILES)) {
    const { body, title, lead, image } = content(code, id);
    const about = lead.length > 300 ? `${lead.slice(0, 297).replace(/\s+\S*$/, '')}…` : lead;
    const url = SITE + path(code, id);
    urls.push(url);
    const link = o => `<a href="${FILES[o]}"${o === id ? ' aria-current="page"' : ''}>${esc(o === 'planetx' ? w['tour.px.title'] : OBJECT_FILES[o] ? NAME(code, TARGETS.find(t => t.slug === o), w) : nav[o])}</a>`;
    const html = `<!doctype html>
<html lang="${code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a0908">
<title>${attr(title)} · Chronosphere</title>
<meta name="description" content="${attr(about)}">
<link rel="canonical" href="${url}">
${codes.map(c => `<link rel="alternate" hreflang="${c}" href="${SITE}${path(c, id)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE}${path('en', id)}">
<meta property="og:title" content="${attr(title)} · Chronosphere">
<meta property="og:description" content="${attr(about)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}${image}">
<meta property="og:site_name" content="Chronosphere">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${up}favicon.ico">
<link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<link rel="stylesheet" href="${up}css/fonts.css">
<link rel="stylesheet" href="${up}css/style.css">
<style>
  html, body { height: auto; }
  body { display: block; overflow: auto; }
  .doctop { justify-content: space-between; }
  .doctop .cta { text-decoration: none; display: inline-flex; align-items: center; }
  .doc { padding: 5vh 16px 8vh; }
  .docmore { margin-top: 40px; padding-top: 18px; border-top: 1px solid var(--line); display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 14.5px; }
  .docmore a { color: var(--ink-2); text-underline-offset: 3px; }
  .docmore a:hover, .docmore a[aria-current] { color: var(--ink); }
  .docmore span { flex-basis: 100%; height: 0; }
  .docmore em { font-style: normal; color: var(--ink-3); }
</style>
</head>
<body>
<header class="top doctop">
  <a class="brand" href="${home}" aria-label="Chronosphere">
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><circle cx="13" cy="17" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="14" r="8" fill="var(--ember)"/></svg>
    <span>Chronosphere</span>
  </a>
  <a class="cta" href="${home}">${esc(D.open)}</a>
</header>
<main class="doc">
  <article class="sheet">${body}
    <nav class="docmore" aria-label="Chronosphere">
      ${[...Object.keys(SHEET_FILES), 'planetx'].map(link).join('\n      ')}
      <span></span>
      <em>${esc(D.objects)}:</em> ${Object.keys(OBJECT_FILES).map(link).join('\n      ')}
      <span></span>
      ${codes.map(c => `<a href="${up}${path(c, id)}" lang="${c}" hreflang="${c}"${c === code ? ' aria-current="true"' : ''}>${LANGS[c]}</a>`).join('\n      ')}
    </nav>
  </article>
</main>
</body>
</html>
`;
    writeFileSync(join(WEB, path(code, id)), html.replace(/\r\n/g, '\n'));
    console.log(path(code, id).padEnd(28), `${plain(body).split(' ').length} words |`, title);
  }
}
writeFileSync(join(WEB, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`sitemap.xml: ${urls.length} addresses`);
