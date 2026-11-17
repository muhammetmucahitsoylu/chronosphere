// The three information pages ("What is SPHEREx?", "How it works", "About") as plain pages with their own
// addresses, in all six languages, so that a search engine, a link preview or a browser without scripts can
// read them. The words come from web/js/pages.js and web/js/pages/<code>.js, the same ones the site shows as
// sheets over the map: after changing a page there, run   node scripts/build_pages.mjs
//
// Writes web/<name>.html for English, web/<code>/<name>.html for the other languages, and web/sitemap.xml.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), WEB = join(HERE, '..', 'web');
const SITE = 'https://chronospherex.com/';
const FILES = { spherex: 'what-is-spherex.html', how: 'how-it-works.html', about: 'about.html' };
const ENGLISH_NAV = { spherex: 'What is SPHEREx?', how: 'How it works', about: 'About' };
const OPEN = { en: 'Open the sky map', tr: 'Gökyüzü haritasını aç', es: 'Abrir el mapa del cielo', de: 'Himmelskarte öffnen', fr: 'Ouvrir la carte du ciel', pl: 'Otwórz mapę nieba' };

// One language at a time, each in a process of its own: the site's code fixes its language when it is loaded.
if (process.argv[2] === '--one') {
  const code = process.argv[3];
  globalThis.location = { search: code === 'en' ? '' : `?lang=${code}` };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  const { SHEETS, NAV } = await import(pathToFileURL(join(WEB, 'js', 'pages.js')).href);
  const { LANGS, lang } = await import(pathToFileURL(join(WEB, 'js', 'lang.js')).href);
  if (lang !== code) throw new Error(`asked for ${code}, got ${lang}`);
  if (code !== 'en' && !NAV) throw new Error(`no pages in ${code}`);
  process.stdout.write(JSON.stringify({ LANGS, nav: NAV || ENGLISH_NAV, sheets: Object.fromEntries(Object.keys(FILES).map(id => [id, SHEETS[id]()])) }));
  process.exit(0);
}

const read = code => {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--one', code], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${code}: ${r.stderr}`);
  return JSON.parse(r.stdout);
};
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const attr = s => s.replace(/&(?!\w+;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const path = (code, id) => (code === 'en' ? '' : `${code}/`) + FILES[id];

const first = read('en'), codes = Object.keys(first.LANGS), all = { en: first };
for (const code of codes) if (code !== 'en') all[code] = read(code);

const urls = [SITE];
for (const code of codes) {
  const { nav, sheets, LANGS } = all[code], up = code === 'en' ? '' : '../', home = `${up}${code === 'en' ? './' : `?lang=${code}`}`;
  if (code !== 'en') mkdirSync(join(WEB, code), { recursive: true });
  for (const id of Object.keys(FILES)) {
    const body = sheets[id];
    const title = plain((body.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || nav[id]);
    const lead = plain((body.match(/<p class="lead">([\s\S]*?)<\/p>/) || [])[1] || '');
    const about = lead.length > 300 ? `${lead.slice(0, 297).replace(/\s+\S*$/, '')}…` : lead;
    const url = SITE + path(code, id);
    urls.push(url);
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
<meta property="og:image" content="${SITE}preview.png">
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
</style>
</head>
<body>
<header class="top doctop">
  <a class="brand" href="${home}" aria-label="Chronosphere">
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><circle cx="13" cy="17" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="19" cy="14" r="8" fill="var(--ember)"/></svg>
    <span>Chronosphere</span>
  </a>
  <a class="cta" href="${home}">${OPEN[code] || OPEN.en}</a>
</header>
<main class="doc">
  <article class="sheet">${body}
    <nav class="docmore" aria-label="Chronosphere">
      ${Object.keys(FILES).map(o => `<a href="${FILES[o]}"${o === id ? ' aria-current="page"' : ''}>${nav[o]}</a>`).join('\n      ')}
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
