// The guided tour: a short, plain-language walk from "what is SPHEREx" to the five test
// objects. Each step may move the map or open an object through the small api it is given.
// The words of the steps live in lang.js, one block per language; this file is the order of the
// steps and what the map does at each.

// The first object is where the audience meets the panel: numbered pointers lead from the card to its
// parts. `at` names the part (a CSS selector), `key` the words the card says about it; `dx` and `dy` move a pointer a little.
const POINTS = {
  barnard: [
    { at: '.viewer .blocktitle', key: 'tour.p1' },
    { at: '#findings', key: 'tour.p2' },
    { at: '.stack .blocktitle', key: 'tour.p3' },
    { at: '#factsbtn', dx: 1, dy: 10, key: 'tour.p4' },
  ],
};
// What the presenter says while each test object is on screen is under `tour.<object>` in lang.js.
const STORIES = ['barnard', 'epsindib', 'wise0855', 'rwaur', 'rdra', 'pluto'];

/**
 * `t(key)` gives the words for a key in the language in use, `name(object)` what an object is called in it;
 * `years(slug)` whether the object has the Years view built for it (then Barnard's Star gets a second step: its 26 years).
 */
export function buildTour(targets, t, name = o => o.label, years = () => false) {
  // In the texts of the steps, *words between asterisks* are set in italics.
  const steps = [
    {
      title: t('tour.1.title'), text: t('tour.1.text'),
      run: api => { api.closePanel(); api.layer('spherex'); api.slice(25); api.fly(266.4, -29.0, 110); },
    },
    {
      title: t('tour.2.title'), text: t('tour.2.text'),
      run: api => { api.closePanel(); api.sweep(true); },                 // the map steps through the bands meanwhile
    },
    {
      title: t('tour.3.title'), text: t('tour.3.text'),
      demo: 'blink',                                    // the worked example shown with this step: two real SPHEREx pictures of Pluto, flipping
      prep: api => api.example(),                       // made ready while the step before is on screen
      run: api => { api.closePanel(); api.sweep(false); api.slice(25); },
    },
    {
      // Planet X: what is predicted and why (NASA's "Hypothetical Planet X" page; Batygin & Brown 2016).
      title: t('tour.px.title'), text: t('tour.px.text'),
      run: api => { api.closePanel(); api.sweep(false); api.slice(25); },
    },
    {
      // How faint it would be, on a ladder of magnitudes (see RUNGS in app.js for the numbers and their sources).
      title: t('tour.faint.title'), text: t('tour.faint.text'),
      demo: 'ladder',
      run: api => { api.closePanel(); api.sweep(false); },
    },
    {
      title: t('tour.4.title'), text: t('tour.4.text'),
      run: api => { api.closePanel(); api.sweep(false); },
    },
  ];
  for (const o of targets) {
    steps.push({
      object: true,                                     // an object is open at this step: the card docks under the map on every screen
      title: name(o), text: STORIES.includes(o.slug) ? t(`tour.${o.slug}`) : `${o.blurb} ${o.look || ''}`,
      points: (POINTS[o.slug] || []).map(p => ({ ...p, label: t(`${p.key}.label`), text: t(`${p.key}.text`) })),
      prep: api => { api.warm(o.ra, o.dec, w => api.viewFov(o.size, w)); api.preload(o); },      // made ready while the previous step is on screen
      run: api => { api.sweep(false); api.open(o); },
    });
    if (o.slug === 'barnard' && years(o.slug)) steps.push({
      // the same star in the images of 2MASS, WISE and NEOWISE, and SPHEREx: the Years view, without opening it again
      object: true, title: t('tour.years.title'), text: t('tour.years.text'),
      prep: api => api.preloadYears(o),
      run: api => { api.sweep(false); api.years(o); },
    });
  }
  steps.push({
    title: t('tour.last.title'), text: t('tour.last.text'),
    // Objects outside the test list on which the tool has been checked: each is read live from NASA's archive,
    // and kept on the device once read. Their year-2000 positions and yearly motions (milliarcseconds) come
    // with the tour, from SIMBAD (Gaia DR3; Luhman 16: Lazorenko & Sahlmann 2018; NGC 7027: UCAC4), so that
    // opening one needs no name service.
    tryNext: [
      { name: 'Proxima Centauri', ra2000: 217.42894222, dec2000: -62.67949019, pmra: -3781.741, pmdec: 769.465, plx: 768.0665 },
      { name: 'Luhman 16', ra2000: 162.328814, dec2000: -53.319466, pmra: -2767.502, pmdec: 356.856, plx: 501.557 },
      { name: "Teegarden's Star", shown: t('name.teegarden'), ra2000: 43.25371581, dec2000: 16.88128672, pmra: 3429.083, pmdec: -3805.541, plx: 260.9884 },
      { name: 'NGC 7027', ra2000: 316.7565498, dec2000: 42.236242, pmra: -22.7, pmdec: -4.4, plx: null },
    ],
    prep: api => api.warm(83.82, -5.39, 60, 'wide'),
    run: api => { api.closePanel(); api.fly(83.82, -5.39, 60); },
  });
  return steps;
}
