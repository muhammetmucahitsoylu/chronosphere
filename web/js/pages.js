// Long-form pages shown as sheets over the map: what SPHEREx is, how the tool works, who made it.
// Every figure quoted here was checked against its source; the sources are linked at the end of each page.
// This file holds the English text. The same pages in another language are in pages/<code>.js, in the same shape;
// a language without such a file gets the English pages.
import { lang } from './lang.js';

export const TEAM = {
  name: 'The Bright Nobles',
  members: [{ name: 'Muhammet Mücahit Soylu' }, { name: 'Serdar Aydın' }, { name: 'Furkan Küpeli' }],
  repo: 'https://github.com/muhammetmucahitsoylu/chronosphere',
};

const figure = w => `
<figure class="filterfig">
  <svg viewBox="0 0 640 170" role="img" aria-label="${w.label}">
    <defs><linearGradient id="lvf" x1="0" x2="1"><stop offset="0" stop-color="#fff1d0"/><stop offset=".3" stop-color="#ffc56e"/><stop offset=".6" stop-color="#ff7b39"/><stop offset="1" stop-color="#8f1c16"/></linearGradient></defs>
    <rect x="20" y="34" width="600" height="70" rx="6" fill="url(#lvf)"/>
    <g fill="#0a0908" stroke="#0a0908"><circle cx="110" cy="69" r="7"/><circle cx="250" cy="69" r="7"/><circle cx="390" cy="69" r="7"/><circle cx="530" cy="69" r="7"/></g>
    <g fill="none" stroke="#a89f92" stroke-width="1.5" stroke-dasharray="4 4"><path d="M124 69h112M264 69h112M404 69h112"/></g>
    <g fill="#a89f92" font-family="IBM Plex Mono, monospace" font-size="13" text-anchor="middle">
      <text x="110" y="24">${w.exposure} 1</text><text x="250" y="24">${w.exposure} 2</text><text x="390" y="24">${w.exposure} 3</text><text x="530" y="24">${w.exposure} 4</text>
      <text x="110" y="128">1.15 µm</text><text x="250" y="128">1.28 µm</text><text x="390" y="128">1.42 µm</text><text x="530" y="128">1.57 µm</text>
    </g>
  </svg>
  <figcaption>${w.caption}</figcaption>
</figure>`;

const ENGLISH = {
  figure: {
    label: 'A filter whose colour changes from one edge to the other; the same star lands on a different colour in each exposure',
    exposure: 'exposure',
    caption: 'The telescope steps across the sky, so the same star lands on a new colour of the filter in each exposure.',
  },
  sheets: ({ TEAM, figure, team }) => ({
  spherex: () => `
    <p class="eyebrow">The mission</p>
    <h1>What is SPHEREx?</h1>
    <p class="lead">SPHEREx is a NASA space telescope that photographs the entire sky in 102 colours of infrared light. Then it does it again, every six months.</p>
    <div class="statgrid">
      <div><b>102</b><span>colours, from 0.75 to 5 microns</span></div>
      <div><b>6 months</b><span>to map the whole sky once</span></div>
      <div><b>2025</b><span>launched on 11 March</span></div>
      <div><b>6.15″</b><span>the patch of sky one pixel covers</span></div>
    </div>
    <h2>Why infrared?</h2>
    <p>Infrared is light with a longer wavelength than our eyes can see. Cool things glow in it: brown dwarfs, clouds of dust, giant stars near the end of their lives. The light of very distant galaxies arrives stretched into it. And molecules such as water, carbon dioxide and methane each absorb infrared light at their own wavelengths, so an object's infrared colours reveal what it is made of.</p>
    <h2>102 colours without a filter wheel</h2>
    <p>Most cameras take one colour at a time. SPHEREx looks through filters whose colour changes smoothly from one edge to the other. As the telescope steps across the sky, each star lands on a different part of the filter in every exposure, and is recorded in a different colour.</p>
    ${figure}
    <p>Collect enough exposures of one star and you have its whole spectrum. That is why, in Chronosphere, stepping through time and building a spectrum are the same act.</p>
    <h2>What it was built for</h2>
    <ul>
      <li><b>The first instant of the universe.</b> By mapping more than 450 million galaxies in three dimensions, it tests ideas about what happened in the first moment after the Big Bang.</li>
      <li><b>The history of galaxies.</b> It measures the combined glow of all galaxies, including ones too faint to see one by one.</li>
      <li><b>Water and the ingredients of life.</b> It surveys frozen water, carbon dioxide and other ices in the clouds where stars and planets form.</li>
    </ul>
    <h2>And what it does along the way</h2>
    <p>Because SPHEREx returns to every spot of the sky again and again, it also records everything that <b>moves or changes</b>: asteroids, comets, nearby stars drifting past, brown dwarfs, stars that pulse or flare. It photographs hundreds of millions of stars and galaxies, far more than any one team can check. This tool exists so that more people can look.</p>
    <p class="fine">Sources: <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">NASA/JPL mission page</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx at the NASA/IPAC archive</a></p>`,

  how: () => `
    <p class="eyebrow">Under the hood</p>
    <h1>How it works</h1>
    <p class="lead">You click a point of the sky. A few seconds later you are watching every picture SPHEREx has taken of it, lined up, with a spectrum underneath. Here is what happens in between.</p>
    <ol>
      <li><b>Look it up in the sky index.</b> A compact index of every public SPHEREx exposure, about 1.6 million of them, says which ones were pointed near your spot. The index is rebuilt from NASA's archive on a schedule, so new data releases appear without anyone touching the code.</li>
      <li><b>Read only the pixels that matter.</b> A full exposure is a file of more than 60 megabytes. Your browser reads its header and just the small block of pixels around your spot, a few hundred kilobytes, straight from NASA's open data on the cloud.</li>
      <li><b>Line the images up.</b> Each exposure was taken at a different angle. Every block is redrawn on one common grid, north up, using the position information stored in the file, and the glow of the sky background is removed.</li>
      <li><b>Find the colour of each pixel.</b> Each exposure records your spot at a different wavelength. That wavelength is read from a table inside every file.</li>
      <li><b>Compute on your device.</b> Brightness, stacking, subtracting, colour pictures, measurements and plots are all computed in your browser, which is why every control answers instantly.</li>
      <li><b>Say what it is.</b> The SIMBAD catalogue is asked what lies at that position. Catalogues store where a star was in the year 2000, so nearby stars that have drifted since are moved to today's date before matching.</li>
    </ol>
    <h2>No server, and it works offline</h2>
    <p>Chronosphere has no server of its own. The page is a set of static files; everything else is your browser talking directly to NASA's open data. That means there is nothing to keep running and nothing that can go down on our side. Whatever you have opened once, including the whole guided tour, is saved on your device and keeps working without a connection.</p>
    <h2>How to read what you see</h2>
    <ul>
      <li><b>Visits.</b> SPHEREx comes back to most parts of the sky about every six months, and each visit lasts from a few days to a few weeks. One stacked image per visit, shown in turn, makes a small shift easy to see. Near the poles of the solar system's plane it looks almost every orbit, so there the images are grouped by month instead.</li>
      <li><b>The shift table.</b> For a moving object, the position measured in each visit is compared with what the catalogue predicts: its steady motion across the sky plus, for the nearest stars, the yearly wobble caused by Earth's own orbit. The motion is measured separately in every detector that sees the object, and the detectors are compared with each other.</li>
      <li><b>The spectrum.</b> Each dot is one exposure: its wavelength, and how bright the circled spot was. Dots are coloured by visit.</li>
      <li><b>Molecule bands.</b> Shaded strips mark where common molecules absorb light. The table reports how deep a dip was measured there.</li>
      <li><b>Checked against its neighbours.</b> Under the brightness curve, the change of the circled spot between visits is set against ordinary stars in the same images. If they stayed steady and the spot did not, the change is real and not a quirk of the camera. The same is done for its position.</li>
      <li><b>Every star, checked.</b> Under the images, every clear star of the field is tested for motion and for brightness changes, without using any catalogue. The few that stand out are listed and marked with a diamond. A flag is a reason to look, not a finding.</li>
    </ul>
    <h2>What it cannot tell you</h2>
    <ul>
      <li>One SPHEREx pixel covers 6.15 arcseconds. Even the star whose place in the sky changes fastest moves less than two pixels a year, so motion is a small hop between visits, never a streak.</li>
      <li>Measurements use a simple fixed circle and are meant for exploring, not for publication. Very bright stars overload the detector; for those, the star's faint outer glow is measured instead and each detector is joined to its neighbour: the overall shape of the spectrum is right, its level and fine detail are approximate.</li>
      <li>A dip at a molecule's wavelength is a hint, not a detection.</li>
      <li>Positions repeat to a few tenths of an arcsecond for ordinary stars, but a star close to overloading the camera can be off by an arcsecond or more in a single visit.</li>
      <li>Nothing here claims a discovery. Something that looks new is a reason to check it in the other tools linked from every object.</li>
    </ul>`,

  about: () => `
    <p class="eyebrow">About</p>
    <h1>Made in a weekend, to help more people look</h1>
    <p class="lead">Chronosphere was built on 14 and 15 November 2026 at the NASA Space Apps Challenge, for the challenge <i>Planet X and SPHEREx</i>, by the team ${TEAM.name}.</p>
    ${team('The team')}
    <h2>Why we built it</h2>
    <p>Pluto was found in 1930 by a person comparing two photographs. People still find new worlds that way. Volunteers have spotted most of the more than 5,000 comets discovered in images from the SOHO spacecraft, and about 3,000 candidate brown dwarfs in images from NASA's WISE telescope. SPHEREx is now photographing hundreds of millions of objects, again and again: more than any group of professionals can inspect.</p>
    <p>We wanted a tool where anyone, with no training, can pick a point in the sky and see for themselves whether something there has moved or changed, and then check it against independent sources in one click.</p>
    <p>The challenge takes its name from Planet X, the hypothetical undiscovered planet in the outer solar system. Whether or not SPHEREx can see it, any unknown nearby object would give itself away the same way Pluto did: as a dot that moves.</p>
    <h2>Where the data comes from</h2>
    <ul>
      <li><b>SPHEREx images and all-sky map:</b> NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Other sky maps:</b> 2MASS, WISE and DSS, as HiPS built by CDS and served by IRSA.</li>
      <li><b>Catalogues:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Strasbourg).</li>
      <li><b>Sky atlas component:</b> Aladin Lite (CDS).</li>
      <li><b>Encyclopedia cards:</b> Wikipedia, shown with a link to the article.</li>
    </ul>
    <h2>Open source</h2>
    <p>The code is public: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. It has no build step and no server: the page can be hosted anywhere that serves files.</p>
    <h2>Use of AI</h2>
    <p>The software was written with an AI coding assistant during the event. The team chose the approach, checked the results against catalogue values and independent tools, and is responsible for the content. No AI-generated images, audio or video are used: every image shown is telescope data.</p>
    <p class="fine">Sources for the figures above: <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">NASA on SOHO's 5,000th comet</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};

// The pages in the language in use.
let local = null;
if (lang !== 'en') { try { local = (await import(`./pages/${lang}.js`)).default || null; } catch { local = null; } }
const team = title => (TEAM.members.length ? `<h2>${title}</h2><ul class="team">${TEAM.members.map(m => `<li><b>${m.name}</b><span>${m.role || ''}</span></li>`).join('')}</ul>` : '');
const from = local?.sheets ? local : ENGLISH;
export const SHEETS = from.sheets({ TEAM, figure: figure(from.figure || ENGLISH.figure), team });
/** What the top bar calls the three pages in this language; null when the pages are the English ones. */
export const NAV = local?.sheets ? local.nav || null : null;
