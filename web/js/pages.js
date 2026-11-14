// Long-form pages shown as sheets over the map: what SPHEREx is, how the tool works, who made it.

export const TEAM = {
  name: 'The Bright Nobles',
  members: [{ name: 'Muhammet Mücahit Soylu' }, { name: 'Serdar Aydın' }, { name: 'Furkan Küpeli' }],
  repo: 'https://github.com/muhammetmucahitsoylu/chronosphere',
};

const filterFigure = `
<figure class="filterfig">
  <svg viewBox="0 0 640 170" role="img" aria-label="A filter whose colour changes from one edge to the other; the same star lands on a different colour in each exposure">
    <defs><linearGradient id="lvf" x1="0" x2="1"><stop offset="0" stop-color="#fff1d0"/><stop offset=".3" stop-color="#ffc56e"/><stop offset=".6" stop-color="#ff7b39"/><stop offset="1" stop-color="#8f1c16"/></linearGradient></defs>
    <rect x="20" y="34" width="600" height="70" rx="6" fill="url(#lvf)"/>
    <g fill="#0a0908" stroke="#0a0908"><circle cx="110" cy="69" r="7"/><circle cx="250" cy="69" r="7"/><circle cx="390" cy="69" r="7"/><circle cx="530" cy="69" r="7"/></g>
    <g fill="none" stroke="#a89f92" stroke-width="1.5" stroke-dasharray="4 4"><path d="M124 69h112M264 69h112M404 69h112"/></g>
    <g fill="#a89f92" font-family="IBM Plex Mono, monospace" font-size="13" text-anchor="middle">
      <text x="110" y="24">exposure 1</text><text x="250" y="24">exposure 2</text><text x="390" y="24">exposure 3</text><text x="530" y="24">exposure 4</text>
      <text x="110" y="128">1.15 µm</text><text x="250" y="128">1.28 µm</text><text x="390" y="128">1.42 µm</text><text x="530" y="128">1.57 µm</text>
      <text x="320" y="158" fill="#7b7368">the telescope steps across the sky; the same star lands on a new colour each time</text>
    </g>
  </svg>
</figure>`;

export const SHEETS = {
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
    <p>Infrared is light with a longer wavelength than our eyes can see. Cool things glow in it: brown dwarfs, dust clouds, the oldest and most distant galaxies. And molecules such as water, carbon dioxide and methane each absorb infrared light at their own wavelengths, so an object's infrared colours reveal what it is made of.</p>
    <h2>102 colours without a filter wheel</h2>
    <p>Most cameras take one colour at a time. SPHEREx looks through filters whose colour changes smoothly from one edge to the other. As the telescope steps across the sky, each star lands on a different part of the filter in every exposure, and is recorded in a different colour.</p>
    ${filterFigure}
    <p>Collect enough exposures of one star and you have its whole spectrum. That is why, in Chronosphere, stepping through time and building a spectrum are the same act.</p>
    <h2>What it was built for</h2>
    <ul>
      <li><b>The first instant of the universe.</b> By mapping hundreds of millions of galaxies in three dimensions, it tests ideas about what happened in the first moment after the Big Bang.</li>
      <li><b>The history of galaxies.</b> It measures the combined glow of all galaxies, including ones too faint to see one by one.</li>
      <li><b>Water and the ingredients of life.</b> It surveys frozen water, carbon dioxide and other ices in the clouds where stars and planets form.</li>
    </ul>
    <h2>And what it does along the way</h2>
    <p>Because SPHEREx returns to every spot of the sky again and again, it also records everything that <b>moves or changes</b>: asteroids, comets, nearby stars drifting past, brown dwarfs, stars that pulse or flare. No one team can check images of more than a billion objects. This tool exists so that more people can look.</p>
    <p class="fine">More: <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA's SPHEREx mission page</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx at the NASA/IPAC archive</a></p>`,

  how: () => `
    <p class="eyebrow">Under the hood</p>
    <h1>How it works</h1>
    <p class="lead">You click a point of the sky. A few seconds later you are watching every picture SPHEREx has taken of it, lined up, with a spectrum underneath. Here is what happens in between.</p>
    <ol>
      <li><b>Ask the archive.</b> NASA's infrared archive (IRSA) is asked for every SPHEREx exposure that covers the spot, across every public data release. Nothing about releases is written into the code, so a new release simply shows up.</li>
      <li><b>Read only the pixels that matter.</b> A full exposure is a 60-megabyte file. Chronosphere reads its header and just the small block of pixels around your spot, a few hundred kilobytes, straight from NASA's open data on the cloud.</li>
      <li><b>Line the images up.</b> Each exposure was taken at a different angle. Every block is redrawn on one common grid, north up, using the position information stored in the file, and the glow of the sky background is removed.</li>
      <li><b>Find the colour of each pixel.</b> Each exposure records your spot at a different wavelength. That wavelength is read from a table inside every file.</li>
      <li><b>Compute on your device.</b> The aligned images travel to your browser as raw numbers. Brightness, stacking, subtracting, colour pictures, measurements and plots are all computed there, which is why every control answers instantly.</li>
      <li><b>Say what it is.</b> The SIMBAD catalogue is asked what lies at that position. Catalogues store where a star was in the year 2000, so nearby stars that have drifted since are moved to today's date before matching.</li>
    </ol>
    <h2>How to read what you see</h2>
    <ul>
      <li><b>Seasons.</b> SPHEREx visits each spot for about two weeks, twice a year. One stacked image per visit, shown in turn, makes a small shift easy to see.</li>
      <li><b>The shift table.</b> For a moving object, the position measured in each season is compared with what its catalogued motion predicts.</li>
      <li><b>The spectrum.</b> Each dot is one exposure: its wavelength, and how bright the circled spot was. Dots are coloured by season.</li>
      <li><b>Molecule bands.</b> Shaded strips mark where common molecules absorb light. The table reports how deep a dip was measured there.</li>
    </ul>
    <h2>What it cannot tell you</h2>
    <ul>
      <li>One SPHEREx pixel covers 6.15 arcseconds. Even the fastest star in the sky moves less than two pixels a year, so motion is a small hop between seasons, never a streak.</li>
      <li>Measurements use a simple fixed circle and are meant for exploring, not for publication. Very bright stars overload the detector; for those the outer halo is measured, which gives relative brightness only.</li>
      <li>A dip at a molecule's wavelength is a hint, not a detection.</li>
      <li>Predicted positions use catalogued motion only, without the yearly wobble caused by Earth's orbit.</li>
      <li>Nothing here claims a discovery. Something that looks new is a reason to check it in the other tools linked from every object.</li>
    </ul>`,

  about: () => `
    <p class="eyebrow">About</p>
    <h1>Made in a weekend, to help more people look</h1>
    <p class="lead">Chronosphere was built on 14 and 15 November 2026 at the NASA Space Apps Challenge, for the challenge <i>Planet X and SPHEREx</i>, by the team ${TEAM.name}.</p>
    ${TEAM.members.length ? `<h2>The team</h2><ul class="team">${TEAM.members.map(m => `<li><b>${m.name}</b><span>${m.role || ''}</span></li>`).join('')}</ul>` : ''}
    <h2>Why we built it</h2>
    <p>Pluto was found by a person comparing two photographs. Most known comets and brown dwarfs were found the same way, many of them by volunteers. SPHEREx is now producing more images than any group of professionals can inspect. We wanted a tool where anyone, with no training, can pick a point in the sky and see for themselves whether something there has moved or changed, and then check it against independent sources in one click.</p>
    <h2>Where the data comes from</h2>
    <ul>
      <li><b>SPHEREx images and all-sky map:</b> NASA/JPL-Caltech, served by the NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Other sky maps:</b> 2MASS, WISE and DSS, as HiPS built by CDS and served by IRSA.</li>
      <li><b>Catalogues:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Strasbourg).</li>
      <li><b>Sky atlas component:</b> Aladin Lite (CDS).</li>
      <li><b>Encyclopedia cards:</b> Wikipedia, shown with a link to the article.</li>
    </ul>
    <h2>Open source</h2>
    <p>The code is public: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. It has no build step and the page can be hosted anywhere.</p>
    <h2>Use of AI</h2>
    <p>The software was written with an AI coding assistant during the event. The team chose the approach, checked the results against catalogue values and independent tools, and is responsible for the content. No AI-generated images, audio or video are used: every image shown is telescope data.</p>`,
};
