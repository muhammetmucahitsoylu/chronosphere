// The guided tour: a short, plain-language walk from "what is SPHEREx" to the five test
// objects. Each step may move the map or open an object through the small api it is given.

// What the presenter says while each test object is on screen. Kept short: the panel shows the rest.
const STORY = {
  barnard: 'The fastest-moving star in the whole sky. Three SPHEREx visits play in a loop, and the star hops north by about one pixel each time, along the dotted line that catalogues predict. The table under the images compares the measured hop with the prediction.',
  epsindib: 'Two brown dwarfs, objects too small to shine like stars, orbiting a star 12 light-years away. SPHEREx sees the pair as one dot sliding south-east. Its spectrum has deep gaps near 1.4, 1.9 and 2.7 microns, where water vapour absorbs the light, and near 3.3 microns, where methane does.',
  wise0855: 'The coldest brown dwarf known, only 7 light-years away and too cold to shine in visible light. The images step through the wavelengths: at first the circle holds only the glow of a neighbouring star. Beyond 4 microns a new dot appears that is not in the Gaia star catalogue. In the colour picture it is the red one.',
  rwaur: 'A newborn star still wrapped in dust. It does not move, and the images stay steady. But look at the spectrum, where each colour is one visit: within a year the star grew brighter below 1.6 microns and lost almost half its brightness beyond 4 microns, while the stars around it did not change.',
  rdra: 'A red giant near the end of its life, swelling and shrinking every 245 days. Each image covers about one month. The star is so bright that it overloads the detectors, so the tool measures its outer glow instead. The brightness curve rises and falls with the pulse.',
};

export function buildTour(targets) {
  const steps = [
    {
      title: 'A telescope that sees 102 colours',
      text: 'NASA launched SPHEREx in March 2025. Every six months it maps the entire sky in 102 colours of infrared light, colours our eyes cannot see. This is that map: the whole sky, with our own galaxy, the Milky Way, stretching across it.',
      run: api => { api.closePanel(); api.layer('spherex'); api.slice(25); api.fly(266.4, -29.0, 110); },
    },
    {
      title: 'One sky, 102 different pictures',
      text: 'Each colour shows something different: in some, stars dominate; in others, clouds of dust and gas light up. The map is now stepping through them, from 0.75 to 5 microns. How bright an object is in each colour tells us what it is made of.',
      run: api => { api.closePanel(); api.sweep(true); },
    },
    {
      title: 'Why look at the same place twice?',
      text: 'Because things move and change. In 1930 Clyde Tombaugh discovered Pluto by flipping between two photographs of the same patch of sky and noticing one dot that had jumped. SPHEREx photographs hundreds of millions of stars and galaxies again and again, far too many for any team to check. The more people who can do the flipping, the better.',
      run: api => { api.closePanel(); api.sweep(false); api.slice(25); },
    },
    {
      title: 'What this tool does',
      text: 'Click any point of the sky. Chronosphere reads every SPHEREx exposure of that spot straight from NASA’s open archive, lines them up and plays them like a short video. It also tells you what the object is and builds its spectrum. Let us try it on five test objects.',
      run: api => { api.closePanel(); api.sweep(false); },
    },
  ];
  for (const t of targets) {
    steps.push({
      title: t.label, text: STORY[t.slug] || `${t.blurb} ${t.look || ''}`,
      prep: api => { api.warm(t.ra, t.dec, Math.max(3, t.size / 5)); api.preload(t); },      // made ready while the previous step is on screen
      run: api => { api.sweep(false); api.open(t); },
    });
  }
  steps.push({
    title: 'Now it is your turn',
    text: 'Every point of the sky works the same way: search a name, type coordinates, or just click. Each object links to independent tools so anyone can check what they see. Nothing here claims a discovery. It helps more people look.',
    // Objects outside the test list on which the tool has been checked: each is read live from NASA's archive.
    tryNext: ['Proxima Centauri', 'Luhman 16', "Teegarden's Star", 'NGC 7027'],
    prep: api => api.warm(83.82, -5.39, 60, 'wide'),
    run: api => { api.closePanel(); api.fly(83.82, -5.39, 60); },
  });
  return steps;
}
