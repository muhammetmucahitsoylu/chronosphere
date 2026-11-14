// The guided tour: a short, plain-language walk from "what is SPHEREx" to the five test
// objects. Each step may move the map or open an object through the small api it is given.

export function buildTour(targets) {
  const steps = [
    {
      title: 'A telescope that sees 102 colours',
      text: 'NASA launched SPHEREx in March 2025. Every six months it maps the entire sky in 102 colours of infrared light, colours our eyes cannot see. This is that map: the whole sky, with our own galaxy, the Milky Way, stretching across it.',
      run: api => { api.closePanel(); api.layer('spherex'); api.slice(25); api.fly(266.4, -29.0, 110); },
    },
    {
      title: 'One sky, 102 different pictures',
      text: 'Each colour shows something different: in some, stars dominate; in others, cold dust and gas light up. The map is now sweeping through all 102. How bright an object is in each colour tells us what it is made of.',
      run: api => { api.closePanel(); api.sweep(true); },
    },
    {
      title: 'Why look at the same place twice?',
      text: 'Because things move and change. In 1930 Clyde Tombaugh discovered Pluto by flipping between two photographs of the same patch of sky and noticing one dot that had jumped. SPHEREx returns images of more than a billion objects, far too many for any team to check. So the more people who can do the flipping, the better.',
      run: api => { api.sweep(false); api.slice(25); },
    },
    {
      title: 'What this tool does',
      text: 'Click any point of the sky. Chronosphere fetches every SPHEREx exposure of that spot straight from NASA’s archive, lines them up and plays them like a short video. It also tells you what the object is and builds its spectrum. Let us try it on five test objects.',
      run: api => { api.sweep(false); },
    },
  ];
  for (const t of targets) {
    steps.push({ title: t.label, text: `${t.blurb} ${t.look || ''}`, run: api => { api.sweep(false); api.open(t); } });
  }
  steps.push({
    title: 'Now it is your turn',
    text: 'Every point of the sky works the same way: search a name, type coordinates, or just click. Each object links to independent tools so anyone can check what they see. Nothing here claims a discovery. It helps more people look.',
    run: api => { api.closePanel(); api.fly(83.82, -5.39, 60); },
  });
  return steps;
}
