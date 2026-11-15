// The guided tour: a short, plain-language walk from "what is SPHEREx" to the five test
// objects. Each step may move the map or open an object through the small api it is given.

// What the presenter says while each test object is on screen. Kept short: the panel shows the rest.
const STORY = {
  barnard: 'The dot that moved in the two photographs: the fastest-moving star in the whole sky. The numbers show what the tool makes of it.',
  epsindib: 'Two brown dwarfs, objects too small to shine like stars, orbiting a star 12 light-years away. That star, Epsilon Indi A, is the bright one beside the ring on the map; the pair in the ring is about 4,000 times fainter. SPHEREx sees the pair as one dot sliding south-east. Its spectrum has deep gaps near 1.4, 1.9 and 2.7 microns, where water vapour absorbs the light, and near 3.3 microns, where methane does.',
  wise0855: 'The coldest brown dwarf known, only 7 light-years away and too cold to shine in visible light. The images step through the wavelengths: at first the circle holds only the glow of a neighbouring star. Beyond 4 microns a new dot appears that is not in the Gaia star catalogue. In the colour picture it is the red one.',
  rwaur: 'A newborn star still wrapped in dust. It does not move, and the images stay steady. But look at the spectrum, where each colour is one visit: within a year the star grew brighter below 1.6 microns and lost almost half its brightness beyond 4 microns, while the stars around it did not change.',
  rdra: 'A red giant near the end of its life, swelling and shrinking every 245 days. Each image covers about one month. The star is so bright that it overloads the detectors, so the tool measures its outer glow instead. The brightness curve rises and falls with the pulse.',
};

// The first object is where the audience meets the panel: numbered pointers lead from the card to its
// parts. `at` names the part (a CSS selector), `label` and `text` are what the card says about it; `dx` and `dy` move a pointer a little.
const POINTS = {
  barnard: [
    { at: '.viewer .blocktitle', label: 'Images', text: 'three visits in a loop. The star hops north, along the dotted line that catalogues predict.' },
    { at: '#findings', label: 'What the measurements say', text: 'the hop measured in these images, beside the catalogue’s value.' },
    { at: '.stack .blocktitle', label: 'Spectrum', text: 'the star’s light in 102 colours, one point for each exposure.' },
    { at: '#about .links', dx: -9, dy: 10, label: 'Check it in', text: 'the same spot in other observatories’ tools.' },
  ],
};

export function buildTour(targets) {
  // In the texts of the steps, *words between asterisks* are set in italics.
  const steps = [
    {
      title: 'SPHEREx',
      text: 'The *Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer (SPHEREx)* will survey the entire sky in infrared light. During its planned two-year mission, it will collect data on more than 450 million galaxies and over 100 million stars in the Milky Way to explore the origins of the universe.',
      run: api => { api.closePanel(); api.layer('spherex'); api.slice(25); api.fly(266.4, -29.0, 110); },
    },
    {
      title: 'What is SPHEREx looking for?',
      text: 'SPHEREx maps the sky in 102 infrared bands. By measuring galaxy distances and the light they emit, it helps astronomers investigate the universe’s early expansion. It also studies water and other ices in cold, star-forming clouds across the Milky Way.',
      run: api => { api.closePanel(); api.sweep(true); },                 // the map steps through the bands meanwhile
    },
    {
      title: 'Why look at the same place twice?',
      text: 'Because objects can move or change. In 1930, Clyde Tombaugh discovered Pluto by comparing two photographs of the same patch of sky and spotting a dot that had shifted. SPHEREx repeatedly observes hundreds of millions of stars and galaxies, far too many for one team to inspect. The more people who help compare the images, the more likely we are to spot something interesting.',
      demo: 'blink',                                    // the worked example shown with this step: two real SPHEREx pictures, flipping
      prep: api => api.example(),                       // made ready while the step before is on screen
      run: api => { api.closePanel(); api.sweep(false); api.slice(25); },
    },
    {
      title: 'What does Chronosphere do?',
      text: 'Choose any point in the sky. Chronosphere finds every SPHEREx exposure of that spot in NASA’s open archive, lines up the images, and plays them as a short video. It also identifies the object and builds its spectrum. *Let’s try it with five test objects.*',
      run: api => { api.closePanel(); api.sweep(false); },
    },
  ];
  for (const t of targets) {
    steps.push({
      title: t.label, text: STORY[t.slug] || `${t.blurb} ${t.look || ''}`, points: POINTS[t.slug] || null,
      prep: api => { api.warm(t.ra, t.dec, w => api.viewFov(t.size, w)); api.preload(t); },      // made ready while the previous step is on screen
      run: api => { api.sweep(false); api.open(t); },
    });
  }
  steps.push({
    title: 'Now it is your turn',
    text: 'Every point of the sky works the same way: search a name, type coordinates, or just click. Each object links to independent tools so anyone can check what they see. Nothing here claims a discovery. It helps more people look.',
    // Objects outside the test list on which the tool has been checked: each is read live from NASA's archive,
    // and kept on the device once read. Their year-2000 positions and yearly motions (milliarcseconds) come
    // with the tour, from SIMBAD (Gaia DR3; Luhman 16: Lazorenko & Sahlmann 2018; NGC 7027: UCAC4), so that
    // opening one needs no name service.
    tryNext: [
      { name: 'Proxima Centauri', ra2000: 217.42894222, dec2000: -62.67949019, pmra: -3781.741, pmdec: 769.465, plx: 768.0665 },
      { name: 'Luhman 16', ra2000: 162.328814, dec2000: -53.319466, pmra: -2767.502, pmdec: 356.856, plx: 501.557 },
      { name: "Teegarden's Star", ra2000: 43.25371581, dec2000: 16.88128672, pmra: 3429.083, pmdec: -3805.541, plx: 260.9884 },
      { name: 'NGC 7027', ra2000: 316.7565498, dec2000: 42.236242, pmra: -22.7, pmdec: -4.4, plx: null },
    ],
    prep: api => api.warm(83.82, -5.39, 60, 'wide'),
    run: api => { api.closePanel(); api.fly(83.82, -5.39, 60); },
  });
  return steps;
}
