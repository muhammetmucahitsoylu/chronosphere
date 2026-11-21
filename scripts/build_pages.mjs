// Plain pages with addresses of their own, in all six languages, so that a search engine, a link preview or a
// browser without scripts can read what the site otherwise shows only through its code:
//   - the four information pages ("Asteroid hunt", "What is SPHEREx?", "How it works", "About"), from web/js/pages.js
//     and web/js/pages/<code>.js: the same words the site shows as sheets over the map;
//   - "Planet X, Pluto and SPHEREx", from the guided tour's own words in web/js/lang.js;
//   - one page for each of the five test objects and for Pluto, from web/data/targets.json, the tour and the panel's dictionaries;
//   - one for comet 3I/ATLAS, which stands beside the tour: what it says the exposures show (which gases glow, how
//     well the pictures are centred) is worked out here from the stored exposures, with the site's own code.
// The pictures they show are made by scripts/build_images.py. After changing any of these words, run
//   node scripts/build_pages.mjs
//
// Writes web/<name>.html for English, web/<code>/<name>.html for the other languages, and web/sitemap.xml.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), WEB = join(HERE, '..', 'web');
const SITE = 'https://chronospherex.com/';
const SHEET_FILES = { hunt: 'find-asteroids.html', spherex: 'what-is-spherex.html', how: 'how-it-works.html', about: 'about.html' };
const ENGLISH_NAV = { hunt: 'Asteroid hunt', spherex: 'What is SPHEREx?', how: 'How it works', about: 'About' };
const OBJECT_FILES = { barnard: 'barnards-star.html', epsindib: 'epsilon-indi-b.html', wise0855: 'wise-0855.html', rwaur: 'rw-aurigae.html', rdra: 'r-draconis.html', pluto: 'pluto.html', '3i-atlas': '3i-atlas.html' };
const FILES = { ...SHEET_FILES, planetx: 'planet-x.html', ...OBJECT_FILES };
const TARGETS = JSON.parse(readFileSync(join(WEB, 'data', 'targets.json'), 'utf8'));
// The showcase stars that have the Years view (scripts/build_years.py), with the moving picture of it (scripts/build_images.py --years).
const YEARS = (() => { try { return JSON.parse(readFileSync(join(WEB, 'data', 'years.json'), 'utf8')); } catch { return {}; } })();
const TOUR_KEYS = ['tour.3.title', 'tour.3.text', 'tour.px.title', 'tour.px.text', 'tour.faint.title', 'tour.faint.text', 'tour.4.title', 'tour.4.text',
  'hero.tour', 'ladder.title', 'ladder.note', 'ladder.limit', 'ladder.r1', 'ladder.r2', 'ladder.r3', 'ladder.r4', 'ladder.r5', 'ladder.r6', ...TARGETS.filter(o => !o.extra).map(o => `tour.${o.slug}`)];
// The ladder of brightness, as the tour shows it (see RUNGS in web/js/app.js for the numbers and their sources).
const RUNGS = [['−1.5', 'r1'], ['6', 'r2'], ['9.5', 'r3'], ['15', 'r4'], ['19', 'r5'], ['22–25', 'r6']];

// Words these pages need that the site itself does not say anywhere.
const DOC = {
  en: {
    open: 'Open the sky map', sources: 'Sources', objects: 'Objects to open',
    comet: {
      how: 'one picture for each visit, centred on the comet',
      story: v => `It was reported on 1 July 2025 by the ATLAS survey telescope in Río Hurtado, Chile. It moves too fast for the Sun to hold it, which is how astronomers know that it came from outside: the third such body ever found, after ʻOumuamua and Borisov. It passed closest to the Sun on ${v.peri}, at ${v.periAu} times the Earth’s distance from the Sun, and closest to the Earth on ${v.near}, at ${v.nearAu} times that distance. SPHEREx had it in view twice: on its way in (${v.a}) and on its way out (${v.b}).`,
      shows: 'What the exposures show', gas: 'Gas', band: 'Band (µm)',
      intro: 'A gas around a comet takes up sunlight and gives it back at its own wavelengths. The table says how many times as bright the comet is inside the band of each gas as in the plain spectrum beside it. It is worked out from the exposures themselves, by the code this site runs when the comet is opened.',
      team: 'The SPHEREx team, with a far more careful analysis of the same exposures, reports carbon dioxide and water vapour for August and, for December, a comet much more active than before, with water vapour, organic molecules, carbon dioxide and carbon monoxide, and cyanide (CN) besides.',
      really: 'Is it really the comet?',
      check: v => `Each exposure is cut out around the place that NASA’s JPL Horizons gives for the comet at the middle of that exposure, seen from where the satellite was at that moment. In ${v.n} exposures of December in which the comet is bright, its light lies typically ${v.mid} arcseconds from that place, and ${v.worst} at the worst; one SPHEREx pixel is 6.15 arcseconds. IRSA, the archive that keeps the SPHEREx images, publishes its own list of the exposures that contain the comet: of its 259, this site has 258, and six more (compared on 21 November 2026).`,
      facts: (k, n1, a, n2, b) => `SPHEREx has ${k} exposures of it: ${n1} (${a}) and ${n2} (${b}).`,
    },
    pxCold: { h: 'How cold worlds are found today', text: 'A world beyond Neptune, or a cold brown dwarf near the Sun, gives itself away as Pluto did: it moves. Today the search runs on infrared images taken years apart. WISE 0855, the coldest brown dwarf known, was found in 2014 by its motion in the images of WISE; in the image 2MASS took of its place in 1998 nothing shows, as it is too cold to shine at 2.2 microns. Chronosphere’s Years view finds it again without being told where to look: 8.10 arcseconds a year, in all 23 visits of WISE and NEOWISE (the catalogue gives 8.15). Luhman 16, the nearest pair of brown dwarfs, found in 2013 the same way, is found again too.', cap: 'WISE 0855 in the image of 2MASS (December 1998), where nothing shows at its place, and in that of SPHEREx (April 2026), 3.7 arcminutes to the west.', open: 'Open WISE 0855 over 27 years' },
    pxTitle: 'Planet X, Pluto and SPHEREx',
    pxLead: 'The search for a planet beyond Neptune found Pluto in 1930. How it was found, what astronomers predict today, and whether NASA’s SPHEREx could see it.',
    plutoAlt: 'Two SPHEREx exposures of the same patch of sky, taken six days apart in October 2025 and shown in turn. One dot moves: Pluto.',
    plutoCap: 'Pluto in SPHEREx images of 6 and 12 October 2025, shown in turn: the one dot that moves, 50 arcseconds in six days. Tombaugh’s two plates were also six days apart, taken on 23 and 29 January 1930.',
    title: n => `${n} in SPHEREx images`, alt: (n, how) => `SPHEREx images of ${n}: ${how}`,
    how: { visit: 'one picture per visit', month: 'one picture per month', det: 'one picture per detector, from 0.75 to 5 microns', stop: 'one picture for every stop of the telescope that caught it' },
    years: { h: 'Over a quarter of a century', cap: (n, a, b) => `Images of 2MASS (${a}), of WISE and NEOWISE (every half year) and of SPHEREx (${b}): the ring marks where the catalogue places ${n} on each date.`, open: 'Open the Years view' },
    openIt: n => `Open ${n} in Chronosphere`, facts: (k, a, b) => `SPHEREx has ${k} exposures of this spot, from ${a} to ${b}.`,
  },
  tr: {
    open: 'Gökyüzü haritasını aç', sources: 'Kaynaklar', objects: 'Açılabilecek nesneler',
    comet: {
      how: 'her ziyaret için bir resim, kuyrukluyıldız ortada',
      story: v => `1 Temmuz 2025’te Şili’nin Río Hurtado bölgesindeki ATLAS tarama teleskobu tarafından bildirildi. Güneş’in tutamayacağı kadar hızlı gidiyor; gökbilimciler dışarıdan geldiğini buradan biliyor: ʻOumuamua ve Borisov’dan sonra bulunan bu türden üçüncü cisim. Güneş’e en yakın konumundan ${v.peri} tarihinde, Dünya–Güneş uzaklığının ${v.periAu} katı uzaklıkta geçti; Dünya’ya en yakın konumundan ise ${v.near} tarihinde, o uzaklığın ${v.nearAu} katında. SPHEREx onu iki kez görüş alanına aldı: içeri doğru gelirken (${v.a}) ve dışarı doğru giderken (${v.b}).`,
      shows: 'Pozlar ne gösteriyor', gas: 'Gaz', band: 'Bant (µm)',
      intro: 'Bir kuyrukluyıldızın çevresindeki gaz Güneş ışığını soğurur ve kendi dalga boylarında geri verir. Tablo, kuyrukluyıldızın her gazın bandı içinde, bandın yanındaki düz tayfa göre kaç kat parlak olduğunu söylüyor. Değerler pozların kendisinden, bu sitenin kuyrukluyıldız açıldığında çalıştırdığı kodla hesaplanır.',
      team: 'SPHEREx ekibi aynı pozları çok daha özenli bir çözümlemeyle inceledi: Ağustos için karbon dioksit ve su buharı, Aralık için ise öncekinden çok daha etkin bir kuyrukluyıldız ve su buharı, organik moleküller, karbon dioksit, karbon monoksit, ayrıca siyanür (CN) bildiriyor.',
      really: 'Bu gerçekten kuyrukluyıldız mı?',
      check: v => `Her poz, NASA’nın JPL Horizons hizmetinin kuyrukluyıldız için o pozun ortasındaki ana verdiği konumun çevresinden kesildi; konum, uydunun o anda bulunduğu yerden görüldüğü gibi alındı. Aralık ayının, kuyrukluyıldızın parlak olduğu ${v.n} pozunda ışığı o konumdan tipik olarak ${v.mid} yay saniyesi, en kötü durumda ${v.worst} yay saniyesi uzakta; bir SPHEREx pikseli 6,15 yay saniyesidir. SPHEREx görüntülerini saklayan arşiv IRSA, kuyrukluyıldızı içeren pozların kendi listesini yayımlıyor: listedeki 259 pozun 258’i bu sitede var, ayrıca altı poz daha (21 Kasım 2026’da karşılaştırıldı).`,
      facts: (k, n1, a, n2, b) => `SPHEREx’in ona ait ${k} pozu var: ${n1} (${a}) ve ${n2} (${b}).`,
    },
    pxCold: { h: 'Soğuk dünyalar bugün nasıl bulunuyor', text: 'Neptün’ün ötesindeki bir dünya ya da Güneş’in yakınındaki soğuk bir kahverengi cüce, kendini Plüton gibi ele verir: hareket eder. Bugün bu arama, yıllar arayla çekilmiş kızılötesi görüntülerde yapılıyor. Bilinen en soğuk kahverengi cüce WISE 0855, 2014’te WISE görüntülerindeki hareketinden bulundu; 2MASS’ın 1998’de onun yerini çektiği görüntüde hiçbir şey görünmüyor, çünkü 2,2 mikronda parlayamayacak kadar soğuk. Chronosphere’in Yıllar görünümü, nereye bakacağı söylenmeden onu yeniden buluyor: WISE ve NEOWISE’ın 23 ziyaretinin hepsinde yılda 8,10 yay saniyesi (katalog: 8,15). Güneş’e en yakın kahverengi cüce çifti Luhman 16 da 2013’te aynı yolla bulunmuştu; o da yeniden bulunuyor.', cap: 'WISE 0855: 2MASS’ın görüntüsünde (Aralık 1998) yerinde hiçbir şey yok; SPHEREx’in görüntüsünde (Nisan 2026) ise 3,7 yay dakikası batıda.', open: 'WISE 0855’i 27 yıl boyunca aç' },
    pxTitle: 'X Gezegeni, Plüton ve SPHEREx',
    pxLead: 'Neptün’ün ötesindeki bir gezegeni arayanlar 1930’da Plüton’u buldu. Plüton nasıl bulundu, gökbilimciler bugün neyi öngörüyor ve NASA’nın SPHEREx teleskobu onu görebilir mi?',
    plutoAlt: 'Aynı gökyüzü parçasının Ekim 2025’te altı gün arayla çekilmiş iki SPHEREx pozu, sırayla gösteriliyor. Bir nokta yer değiştiriyor: Plüton.',
    plutoCap: '6 ve 12 Ekim 2025 tarihli SPHEREx görüntülerinde Plüton, sırayla gösteriliyor: yeri değişen tek nokta, altı günde 50 yay saniyesi. Tombaugh’un iki fotoğraf plakası da altı gün arayla, 23 ve 29 Ocak 1930’da çekilmişti.',
    title: n => `SPHEREx görüntülerinde ${n}`, alt: (n, how) => `${n}, SPHEREx görüntüleri: ${how}`,
    how: { visit: 'her ziyaret için bir resim', month: 'her ay için bir resim', det: '0,75 ile 5 mikron arasında her dedektör için bir resim', stop: 'teleskobun onu yakaladığı her durak için bir resim' },
    years: { h: 'Çeyrek yüzyıl boyunca', cap: (n, a, b) => `2MASS (${a}), WISE ve NEOWISE (altı ayda bir) ve SPHEREx (${b}) görüntüleri: halka, kataloğun her tarihte ${n} için verdiği yeri gösterir.`, open: 'Yıllar görünümünü aç' },
    openIt: n => `Chronosphere’de aç: ${n}`, facts: (k, a, b) => `SPHEREx’in bu noktaya ait ${k} pozu var: ${a} ile ${b} arasında.`,
  },
  es: {
    open: 'Abrir el mapa del cielo', sources: 'Fuentes', objects: 'Objetos para abrir',
    comet: {
      how: 'una imagen por cada visita, centrada en el cometa',
      story: v => `Lo comunicó el 1 de julio de 2025 el telescopio de rastreo ATLAS de Río Hurtado, en Chile. Va demasiado rápido para que el Sol lo retenga, y por eso los astrónomos saben que vino de fuera: es el tercer cuerpo de este tipo que se ha encontrado, después de ʻOumuamua y Borisov. Pasó por su punto más cercano al Sol el ${v.peri}, a ${v.periAu} veces la distancia de la Tierra al Sol, y por el más cercano a la Tierra el ${v.near}, a ${v.nearAu} veces esa distancia. SPHEREx lo tuvo a la vista dos veces: cuando se acercaba (${v.a}) y cuando se alejaba (${v.b}).`,
      shows: 'Lo que muestran las exposiciones', gas: 'Gas', band: 'Banda (µm)',
      intro: 'Un gas alrededor de un cometa absorbe la luz del Sol y la devuelve en sus propias longitudes de onda. La tabla dice cuántas veces más brillante es el cometa dentro de la banda de cada gas que en el espectro liso de al lado. Se calcula a partir de las propias exposiciones, con el código que este sitio ejecuta al abrir el cometa.',
      team: 'El equipo de SPHEREx, con un análisis mucho más cuidadoso de las mismas exposiciones, describe dióxido de carbono y vapor de agua en agosto y, en diciembre, un cometa mucho más activo que antes, con vapor de agua, moléculas orgánicas, dióxido de carbono y monóxido de carbono, y además cianuro (CN).',
      really: '¿Es de verdad el cometa?',
      check: v => `Cada exposición se recorta alrededor del lugar que JPL Horizons, de la NASA, da para el cometa en la mitad de esa exposición, visto desde donde estaba el satélite en ese momento. En ${v.n} exposiciones de diciembre en las que el cometa es brillante, su luz queda normalmente a ${v.mid} segundos de arco de ese lugar y, en el peor caso, a ${v.worst}; un píxel de SPHEREx mide 6,15 segundos de arco. IRSA, el archivo que guarda las imágenes de SPHEREx, publica su propia lista de las exposiciones que contienen el cometa: de sus 259, este sitio tiene 258, y seis más (comparado el 21 de noviembre de 2026).`,
      facts: (k, n1, a, n2, b) => `SPHEREx tiene ${k} exposiciones suyas: ${n1} (${a}) y ${n2} (${b}).`,
    },
    pxCold: { h: 'Cómo se encuentran hoy los mundos fríos', text: 'Un mundo más allá de Neptuno, o una enana marrón fría cerca del Sol, se delata como Plutón: se mueve. Hoy la búsqueda se hace en imágenes infrarrojas tomadas con años de diferencia. WISE 0855, la enana marrón más fría que se conoce, se encontró en 2014 por su movimiento en las imágenes de WISE; en la imagen que 2MASS tomó de su lugar en 1998 no se ve nada, porque es demasiado fría para brillar a 2,2 micras. La vista Años de Chronosphere la vuelve a encontrar sin que nadie le diga dónde mirar: 8,10 segundos de arco al año, en las 23 visitas de WISE y NEOWISE (el catálogo da 8,15). Luhman 16, la pareja de enanas marrones más cercana, hallada en 2013 del mismo modo, también vuelve a aparecer.', cap: 'WISE 0855 en la imagen de 2MASS (diciembre de 1998), donde no se ve nada en su lugar, y en la de SPHEREx (abril de 2026), 3,7 minutos de arco al oeste.', open: 'Abrir WISE 0855 a lo largo de 27 años' },
    pxTitle: 'El Planeta X, Plutón y SPHEREx',
    pxLead: 'La búsqueda de un planeta más allá de Neptuno encontró a Plutón en 1930. Cómo se encontró, qué predicen hoy los astrónomos y si SPHEREx, de la NASA, podría verlo.',
    plutoAlt: 'Dos exposiciones de SPHEREx de la misma zona del cielo, tomadas con seis días de diferencia en octubre de 2025 y mostradas por turnos. Un punto se mueve: Plutón.',
    plutoCap: 'Plutón en imágenes de SPHEREx del 6 y el 12 de octubre de 2025, mostradas por turnos: el único punto que se mueve, 50 segundos de arco en seis días. Las dos placas de Tombaugh también se tomaron con seis días de diferencia, el 23 y el 29 de enero de 1930.',
    title: n => `${n} en imágenes de SPHEREx`, alt: (n, how) => `Imágenes de SPHEREx de ${n}: ${how}`,
    how: { visit: 'una imagen por visita', month: 'una imagen por mes', det: 'una imagen por detector, de 0,75 a 5 micras', stop: 'una imagen por cada parada del telescopio que lo captó' },
    years: { h: 'A lo largo de un cuarto de siglo', cap: (n, a, b) => `Imágenes de 2MASS (${a}), de WISE y NEOWISE (cada medio año) y de SPHEREx (${b}): el anillo marca dónde sitúa el catálogo a ${n} en cada fecha.`, open: 'Abrir la vista Años' },
    openIt: n => `Abrir ${n} en Chronosphere`, facts: (k, a, b) => `SPHEREx tiene ${k} exposiciones de este punto, del ${a} al ${b}.`,
  },
  de: {
    open: 'Himmelskarte öffnen', sources: 'Quellen', objects: 'Objekte zum Öffnen',
    comet: {
      how: 'ein Bild je Besuch, auf den Kometen zentriert',
      story: v => `Gemeldet wurde er am 1. Juli 2025 vom Durchmusterungsteleskop ATLAS in Río Hurtado, Chile. Er ist zu schnell, als dass die Sonne ihn halten könnte; daran erkennen Astronomen, dass er von außen kam: der dritte Körper dieser Art, der je gefunden wurde, nach ʻOumuamua und Borisov. Der Sonne am nächsten kam er am ${v.peri}, im ${v.periAu}-fachen Abstand der Erde von der Sonne, der Erde am nächsten am ${v.near}, im ${v.nearAu}-fachen dieses Abstands. SPHEREx hatte ihn zweimal im Blick: auf dem Weg nach innen (${v.a}) und auf dem Weg nach außen (${v.b}).`,
      shows: 'Was die Aufnahmen zeigen', gas: 'Gas', band: 'Band (µm)',
      intro: 'Ein Gas um einen Kometen nimmt Sonnenlicht auf und gibt es bei seinen eigenen Wellenlängen wieder ab. Die Tabelle sagt, wievielmal so hell der Komet im Band jedes Gases ist wie im glatten Spektrum daneben. Berechnet wird das aus den Aufnahmen selbst, mit dem Code, den diese Seite ausführt, wenn der Komet geöffnet wird.',
      team: 'Das SPHEREx-Team berichtet nach einer weit sorgfältigeren Auswertung derselben Aufnahmen von Kohlendioxid und Wasserdampf im August und für Dezember von einem viel aktiveren Kometen mit Wasserdampf, organischen Molekülen, Kohlendioxid und Kohlenmonoxid, dazu Cyanid (CN).',
      really: 'Ist es wirklich der Komet?',
      check: v => `Jede Aufnahme ist um den Ort herum ausgeschnitten, den JPL Horizons der NASA für den Kometen zur Mitte dieser Aufnahme angibt, gesehen von dort, wo der Satellit in diesem Moment war. In ${v.n} Aufnahmen vom Dezember, in denen der Komet hell ist, liegt sein Licht typischerweise ${v.mid} Bogensekunden von diesem Ort entfernt, im ungünstigsten Fall ${v.worst}; ein SPHEREx-Pixel misst 6,15 Bogensekunden. IRSA, das Archiv der SPHEREx-Bilder, veröffentlicht eine eigene Liste der Aufnahmen, die den Kometen enthalten: Von ihren 259 hat diese Seite 258 und sechs weitere (verglichen am 21. November 2026).`,
      facts: (k, n1, a, n2, b) => `SPHEREx hat ${k} Aufnahmen von ihm: ${n1} (${a}) und ${n2} (${b}).`,
    },
    pxCold: { h: 'Wie man kalte Welten heute findet', text: 'Eine Welt jenseits des Neptun oder ein kalter Brauner Zwerg nahe der Sonne verrät sich wie Pluto: Sie bewegt sich. Heute läuft die Suche über Infrarotbilder, die Jahre auseinanderliegen. WISE 0855, der kälteste bekannte Braune Zwerg, wurde 2014 an seiner Bewegung in den Bildern von WISE gefunden; im Bild, das 2MASS 1998 von seiner Stelle aufnahm, ist nichts zu sehen, denn er ist zu kalt, um bei 2,2 Mikrometern zu leuchten. Die Ansicht „Jahre“ von Chronosphere findet ihn wieder, ohne dass man ihr sagt, wo sie suchen soll: 8,10 Bogensekunden im Jahr, in allen 23 Besuchen von WISE und NEOWISE (der Katalog gibt 8,15 an). Auch Luhman 16, das nächste Paar Brauner Zwerge, 2013 auf dieselbe Weise entdeckt, wird wiedergefunden.', cap: 'WISE 0855 im Bild von 2MASS (Dezember 1998), wo an seiner Stelle nichts zu sehen ist, und in dem von SPHEREx (April 2026), 3,7 Bogenminuten weiter westlich.', open: 'WISE 0855 über 27 Jahre öffnen' },
    pxTitle: 'Planet X, Pluto und SPHEREx',
    pxLead: 'Die Suche nach einem Planeten jenseits des Neptun fand 1930 Pluto. Wie er gefunden wurde, was Astronomen heute vorhersagen und ob SPHEREx, das Teleskop der NASA, ihn sehen könnte.',
    plutoAlt: 'Zwei SPHEREx-Aufnahmen derselben Himmelsgegend, im Oktober 2025 im Abstand von sechs Tagen aufgenommen und abwechselnd gezeigt. Ein Punkt wandert: Pluto.',
    plutoCap: 'Pluto auf SPHEREx-Aufnahmen vom 6. und 12. Oktober 2025, abwechselnd gezeigt: der einzige Punkt, der wandert, 50 Bogensekunden in sechs Tagen. Auch Tombaughs zwei Fotoplatten lagen sechs Tage auseinander, aufgenommen am 23. und 29. Januar 1930.',
    title: n => `${n} auf SPHEREx-Aufnahmen`, alt: (n, how) => `SPHEREx-Aufnahmen von ${n}: ${how}`,
    how: { visit: 'eine Aufnahme pro Besuch', month: 'eine Aufnahme pro Monat', det: 'eine Aufnahme pro Detektor, von 0,75 bis 5 Mikrometer', stop: 'ein Bild für jeden Halt des Teleskops, bei dem er erfasst wurde' },
    years: { h: 'Über ein Vierteljahrhundert', cap: (n, a, b) => `Bilder von 2MASS (${a}), von WISE und NEOWISE (jedes halbe Jahr) und von SPHEREx (${b}): Der Ring steht für jedes Datum dort, wo der Katalog ${n} verortet.`, open: 'Ansicht „Jahre“ öffnen' },
    openIt: n => `${n} in Chronosphere öffnen`, facts: (k, a, b) => `SPHEREx hat ${k} Aufnahmen dieser Stelle, vom ${a} bis zum ${b}.`,
  },
  fr: {
    open: 'Ouvrir la carte du ciel', sources: 'Sources', objects: 'Objets à ouvrir',
    comet: {
      how: 'une image par visite, centrée sur la comète',
      story: v => `Elle a été signalée le 1er juillet 2025 par le télescope de relevé ATLAS de Río Hurtado, au Chili. Elle va trop vite pour que le Soleil la retienne : c’est ainsi que les astronomes savent qu’elle vient de l’extérieur, troisième corps de ce genre jamais trouvé, après ʻOumuamua et Borisov. Elle est passée au plus près du Soleil le ${v.peri}, à ${v.periAu} fois la distance de la Terre au Soleil, et au plus près de la Terre le ${v.near}, à ${v.nearAu} fois cette distance. SPHEREx l’a eue en vue deux fois : à l’aller (${v.a}) et au retour (${v.b}).`,
      shows: 'Ce que montrent les poses', gas: 'Gaz', band: 'Bande (µm)',
      intro: 'Un gaz autour d’une comète absorbe la lumière du Soleil et la restitue à ses propres longueurs d’onde. Le tableau dit combien de fois la comète est plus brillante dans la bande de chaque gaz que dans le spectre lisse d’à côté. Le calcul est fait à partir des poses elles-mêmes, par le code que ce site exécute quand on ouvre la comète.',
      team: 'L’équipe de SPHEREx, par une analyse bien plus soignée des mêmes poses, décrit du dioxyde de carbone et de la vapeur d’eau en août et, en décembre, une comète beaucoup plus active qu’avant, avec de la vapeur d’eau, des molécules organiques, du dioxyde de carbone et du monoxyde de carbone, ainsi que du cyanure (CN).',
      really: 'Est-ce vraiment la comète ?',
      check: v => `Chaque pose est découpée autour de l’endroit que JPL Horizons, de la NASA, donne pour la comète au milieu de cette pose, vu depuis l’endroit où se trouvait le satellite à cet instant. Dans ${v.n} poses de décembre où la comète est brillante, sa lumière se trouve typiquement à ${v.mid} secondes d’arc de cet endroit, au pire à ${v.worst} ; un pixel SPHEREx mesure 6,15 secondes d’arc. L’IRSA, l’archive qui conserve les images SPHEREx, publie sa propre liste des poses qui contiennent la comète : sur ses 259, ce site en a 258, et six de plus (comparaison du 21 novembre 2026).`,
      facts: (k, n1, a, n2, b) => `SPHEREx a ${k} poses d’elle : ${n1} (${a}) et ${n2} (${b}).`,
    },
    pxCold: { h: 'Comment on trouve aujourd’hui les mondes froids', text: 'Un monde au-delà de Neptune, ou une naine brune froide proche du Soleil, se trahit comme Pluton : il se déplace. Aujourd’hui, la recherche se fait sur des images infrarouges prises à des années d’intervalle. WISE 0855, la naine brune la plus froide connue, a été trouvée en 2014 grâce à son mouvement sur les images de WISE ; sur l’image que 2MASS a prise de sa position en 1998, rien n’apparaît, car elle est trop froide pour briller à 2,2 microns. La vue Années de Chronosphere la retrouve sans qu’on lui dise où regarder : 8,10 secondes d’arc par an, sur les 23 visites de WISE et NEOWISE (le catalogue donne 8,15). Luhman 16, le couple de naines brunes le plus proche, découvert en 2013 de la même façon, est lui aussi retrouvé.', cap: 'WISE 0855 sur l’image de 2MASS (décembre 1998), où rien n’apparaît à sa place, et sur celle de SPHEREx (avril 2026), 3,7 minutes d’arc plus à l’ouest.', open: 'Ouvrir WISE 0855 sur 27 ans' },
    pxTitle: 'La planète X, Pluton et SPHEREx',
    pxLead: 'La recherche d’une planète au-delà de Neptune a trouvé Pluton en 1930. Comment elle a été trouvée, ce que prédisent aujourd’hui les astronomes, et si SPHEREx, le télescope de la NASA, pourrait la voir.',
    plutoAlt: 'Deux poses SPHEREx de la même région du ciel, prises à six jours d’intervalle en octobre 2025 et montrées tour à tour. Un point se déplace : Pluton.',
    plutoCap: 'Pluton sur des images SPHEREx des 6 et 12 octobre 2025, montrées tour à tour : le seul point qui se déplace, 50 secondes d’arc en six jours. Les deux plaques de Tombaugh avaient elles aussi été prises à six jours d’intervalle, les 23 et 29 janvier 1930.',
    title: n => `${n} sur les images SPHEREx`, alt: (n, how) => `Images SPHEREx de ${n} : ${how}`,
    how: { visit: 'une image par visite', month: 'une image par mois', det: 'une image par détecteur, de 0,75 à 5 microns', stop: 'une image pour chaque arrêt du télescope qui l’a saisie' },
    years: { h: 'Sur un quart de siècle', cap: (n, a, b) => `Images de 2MASS (${a}), de WISE et NEOWISE (tous les six mois) et de SPHEREx (${b}) : l’anneau marque l’endroit où le catalogue situe ${n} à chaque date.`, open: 'Ouvrir la vue Années' },
    openIt: n => `Ouvrir ${n} dans Chronosphere`, facts: (k, a, b) => `SPHEREx a ${k} poses de ce point, du ${a} au ${b}.`,
  },
  pl: {
    open: 'Otwórz mapę nieba', sources: 'Źródła', objects: 'Obiekty do otwarcia',
    comet: {
      how: 'jedno zdjęcie na wizytę, wyśrodkowane na komecie',
      story: v => `Zgłosił ją 1 lipca 2025 roku teleskop przeglądowy ATLAS w Río Hurtado w Chile. Leci zbyt szybko, by Słońce mogło ją zatrzymać; stąd astronomowie wiedzą, że przybyła z zewnątrz: to trzecie takie ciało, jakie znaleziono, po ʻOumuamua i Borisovie. Najbliżej Słońca była ${v.peri}, w odległości ${v.periAu} razy większej niż odległość Ziemi od Słońca, a najbliżej Ziemi ${v.near}, w odległości ${v.nearAu} razy większej niż tamta. SPHEREx miał ją w polu widzenia dwa razy: gdy się zbliżała (${v.a}) i gdy się oddalała (${v.b}).`,
      shows: 'Co pokazują ekspozycje', gas: 'Gaz', band: 'Pasmo (µm)',
      intro: 'Gaz wokół komety pochłania światło Słońca i oddaje je we własnych długościach fali. Tabela mówi, ile razy kometa jest jaśniejsza w paśmie każdego gazu niż w gładkim widmie obok. Wynik jest liczony z samych ekspozycji, kodem, który ta strona uruchamia po otwarciu komety.',
      team: 'Zespół SPHEREx, po znacznie staranniejszej analizie tych samych ekspozycji, opisuje dwutlenek węgla i parę wodną w sierpniu, a w grudniu kometę dużo aktywniejszą niż wcześniej, z parą wodną, cząsteczkami organicznymi, dwutlenkiem węgla i tlenkiem węgla, a także cyjankiem (CN).',
      really: 'Czy to na pewno kometa?',
      check: v => `Każda ekspozycja jest wycięta wokół miejsca, które JPL Horizons (NASA) podaje dla komety na środek tej ekspozycji, widzianego stamtąd, gdzie w tej chwili był satelita. W ${v.n} grudniowych ekspozycjach, w których kometa jest jasna, jej światło leży zwykle ${v.mid} sekundy łuku od tego miejsca, w najgorszym razie ${v.worst}; jeden piksel SPHEREx to 6,15 sekundy łuku. IRSA, archiwum przechowujące zdjęcia SPHEREx, publikuje własną listę ekspozycji zawierających kometę: z jej 259 ta strona ma 258 i sześć dodatkowych (porównano 21 listopada 2026 roku).`,
      facts: (k, n1, a, n2, b) => `SPHEREx ma ${k} jej ekspozycji: ${n1} (${a}) i ${n2} (${b}).`,
    },
    pxCold: { h: 'Jak dziś znajduje się zimne światy', text: 'Świat za Neptunem albo zimny brązowy karzeł blisko Słońca zdradza się tak jak Pluton: porusza się. Dziś szuka się ich na obrazach w podczerwieni wykonanych w odstępie lat. WISE 0855, najzimniejszy znany brązowy karzeł, został odkryty w 2014 roku dzięki ruchowi na obrazach WISE; na obrazie jego miejsca wykonanym przez 2MASS w 1998 roku nic nie widać, bo jest zbyt zimny, by świecić przy 2,2 mikrona. Widok Lata w Chronosphere odnajduje go ponownie bez wskazówki, gdzie szukać: 8,10 sekundy kątowej na rok, we wszystkich 23 wizytach WISE i NEOWISE (katalog podaje 8,15). Luhman 16, najbliższa para brązowych karłów, odkryta w 2013 roku w ten sam sposób, również zostaje odnaleziona.', cap: 'WISE 0855 na obrazie 2MASS (grudzień 1998), gdzie w jego miejscu nic nie widać, i na obrazie SPHEREx (kwiecień 2026), 3,7 minuty kątowej dalej na zachód.', open: 'Otwórz WISE 0855 na przestrzeni 27 lat' },
    pxTitle: 'Planeta X, Pluton i SPHEREx',
    pxLead: 'Poszukiwania planety za Neptunem doprowadziły w 1930 roku do odkrycia Plutona. Jak go znaleziono, co przewidują dziś astronomowie i czy teleskop SPHEREx należący do NASA mógłby ją zobaczyć.',
    plutoAlt: 'Dwie ekspozycje SPHEREx tego samego fragmentu nieba, wykonane w październiku 2025 roku w odstępie sześciu dni i pokazywane na zmianę. Jeden punkt się przesuwa: to Pluton.',
    plutoCap: 'Pluton na zdjęciach SPHEREx z 6 i 12 października 2025 roku, pokazywanych na zmianę: jedyny punkt, który się przesuwa, o 50 sekund łuku w sześć dni. Dwie klisze Tombaugha również dzieliło sześć dni: wykonano je 23 i 29 stycznia 1930 roku.',
    title: n => `${n} na zdjęciach SPHEREx`, alt: (n, how) => `Zdjęcia SPHEREx: ${n}, ${how}`,
    how: { visit: 'jedno zdjęcie na wizytę', month: 'jedno zdjęcie na miesiąc', det: 'jedno zdjęcie na detektor, od 0,75 do 5 mikrometrów', stop: 'jedno zdjęcie na każdy postój teleskopu, który go uchwycił' },
    years: { h: 'Na przestrzeni ćwierć wieku', cap: (n, a, b) => `Obrazy z 2MASS (${a}), z WISE i NEOWISE (co pół roku) i z SPHEREx (${b}): pierścień pokazuje, gdzie katalog umieszcza obiekt ${n} w danym dniu.`, open: 'Otwórz widok Lata' },
    openIt: n => `Otwórz w Chronosphere: ${n}`, facts: (k, a, b) => `SPHEREx ma ${k} ekspozycji tego miejsca, od ${a} do ${b}.`,
  },
};
// Object names as each language writes them (the tour's ladder already names Barnard's Star in every language).
const NAME = (code, o, words) => (o.slug === 'barnard' ? words['ladder.r3'] : o.slug === 'pluto' ? words['ladder.r4'] : o.label);
// The sources of the Planet X page. Titles of pages and papers stay as they are; the words that say what a source is follow the language.
const PX_WORDS = {
  en: { pluto: 'NASA: Pluto', plates: 'Lowell Observatory: the Pluto discovery plates', sim: 'Crill et al. 2025, the SPHEREx sky simulator', where: 'JPL Horizons: where Pluto was' },
  tr: { pluto: 'NASA: Plüton', plates: 'Lowell Gözlemevi: Plüton’un keşif plakaları', sim: 'Crill vd. 2025, SPHEREx gökyüzü simülatörü', where: 'JPL Horizons: Plüton’un bulunduğu yer' },
  es: { pluto: 'NASA: Plutón', plates: 'Observatorio Lowell: las placas del descubrimiento de Plutón', sim: 'Crill et al. 2025, el simulador del cielo de SPHEREx', where: 'JPL Horizons: dónde estaba Plutón' },
  de: { pluto: 'NASA: Pluto', plates: 'Lowell-Observatorium: die Entdeckungsplatten von Pluto', sim: 'Crill et al. 2025, der Himmelssimulator von SPHEREx', where: 'JPL Horizons: wo Pluto stand' },
  fr: { pluto: 'NASA : Pluton', plates: 'Observatoire Lowell : les plaques de la découverte de Pluton', sim: 'Crill et al. 2025, le simulateur de ciel de SPHEREx', where: 'JPL Horizons : où se trouvait Pluton' },
  pl: { pluto: 'NASA: Pluton', plates: 'Obserwatorium Lowella: płyty, na których odkryto Plutona', sim: 'Crill i in. 2025, symulator nieba SPHEREx', where: 'JPL Horizons: gdzie był Pluton' },
};
const pxSources = code => { const w = PX_WORDS[code] || PX_WORDS.en; return [
  ['NASA: Hypothetical Planet X', 'https://science.nasa.gov/solar-system/planet-x/'],
  [w.pluto, 'https://science.nasa.gov/dwarf-planets/pluto/'],
  [w.plates, 'https://collectionslowellobservatory.omeka.net/items/show/1247'],
  ['Batygin & Brown 2016', 'https://doi.org/10.3847/0004-6256/151/2/22'],
  ['Brown & Batygin 2016', 'https://doi.org/10.3847/2041-8205/824/2/L23'],
  ['Brown, Holman & Batygin 2024', 'https://arxiv.org/abs/2401.17977'],
  ['Luhman 2014: WISE 0855', 'https://doi.org/10.1088/2041-8205/786/2/L18'],
  ['Luhman 2013: Luhman 16', 'https://doi.org/10.1088/2041-8205/767/1/L1'],
  [w.sim, 'https://arxiv.org/abs/2505.24856'],
  [w.where, 'https://ssd.jpl.nasa.gov/horizons/'],
]; };

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
  for (const s of ['What to look for', 'no clear glow', 'more than ×100']) words[s] = L.G(s);
  const C = await import(pathToFileURL(join(WEB, 'js', 'core.js')).href);
  for (const g of C.GASES) words[g.name] = L.G(g.name);
  process.stdout.write(JSON.stringify({ LANGS: L.LANGS, nav: NAV || ENGLISH_NAV, words, sheets: Object.fromEntries(Object.keys(SHEET_FILES).map(id => [id, SHEETS[id]()])),
    ...(code === 'en' ? { followed: Object.fromEntries(TARGETS.filter(o => o.follow).map(o => [o.slug, measureFollowed(o, C)])) } : {}) }));
  process.exit(0);
}

/**
 * What the stored exposures of a followed body show, measured as the page measures them when the body is opened
 * (app.js: the light within 9.2 arcseconds of the centre, the sky from a ring at 100 to 140; measurements that a star
 * or faulty pixels have a part in are left out): which gases glow at each visit and how many times as bright, and how
 * far the body's light lies from the centre the exposures were cut out around.
 */
function measureFollowed(t, C) {
  const frames = []; let grid = null;
  for (let d = 1; d <= 6; d++) for (const line of readFileSync(join(WEB, 'data', t.slug, `d${d}.ndjson`), 'utf8').split('\n')) {
    if (!line) continue;
    const o = JSON.parse(line);
    if (o.t === 'head') grid = o.grid; else if (o.t === 'frame') { o.data = C.decodeF16(o.b64); delete o.b64; frames.push(o); }
  }
  const n = grid.n, c = (n - 1) / 2, eps = t.summary.epochs, visit = mjd => eps.findIndex(e => mjd >= e[0] - 1 && mjd <= e[1] + 1), pts = [];
  for (const f of frames) {
    const a = C.aperture(f.data, n, grid.scale, c, c, f.sig, 9.2, 100, 140);
    if (a && !f.fault && !(f.star >= 0.25 * Math.max(a.flux, 3 * a.err))) pts.push({ lam: f.lam, flux: a.flux, err: a.err, mjd: f.mjd });
  }
  const visits = eps.map((e, k) => ({ t0: e[0], t1: e[1], exposures: frames.filter(f => visit(f.mjd) === k).length,
    gases: C.glowBands(pts.filter(p => visit(p.mjd) === k)).map(m => ({ name: m.name, f: m.f, band: m.band, glows: m.glows, times: m.times })) }));
  // the check on the centring: the exposures of the last visit in the three short-wave detectors in which the body is bright and alone in the circle
  const off = [];
  for (const f of frames) {
    if (f.det > 3 || visit(f.mjd) !== eps.length - 1 || f.fault || f.star) continue;
    const m = C.centroid(f.data, n, c, c, 2);
    if (m && m.peak > 12 * f.sig) off.push(Math.hypot(m.x - c, m.y - c) * grid.scale);
  }
  off.sort((p, q) => p - q);
  return { visits, centred: { n: off.length, mid: off[off.length >> 1], worst: off[off.length - 1] } };
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
    // a sheet's invitation into the site itself (href="./?hunt") leads there from the plain page, in its language
    const body = sheets[id].replace(/href="\.\/\?(\w+)"/g, (m, what) => `href="${code === 'en' ? './' : '../'}?${what}${code === 'en' ? '' : `&lang=${code}`}"`);
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
    <h2>${esc(D.pxCold.h)}</h2>
    <p>${esc(D.pxCold.text)}</p>
    <figure class="docfig"><img src="${up}img/wise0855-years.jpg" width="600" height="315" loading="lazy" alt="${attr(D.pxCold.cap)}"><figcaption>${esc(D.pxCold.cap)}</figcaption></figure>
    <p class="docgo"><a href="${up}?target=wise0855&mode=years${code === 'en' ? '' : `&lang=${code}`}">${esc(D.pxCold.open)}</a></p>
    <h2>${esc(w['tour.4.title'])}</h2>
    <p>${italics(w['tour.4.text'])}</p>
    <p class="docgo"><a class="cta" href="${up}?tour${code === 'en' ? '' : `&lang=${code}`}">${esc(w['hero.tour'])}</a></p>
    <p class="fine">${esc(D.sources)}: ${pxSources(code).map(([t, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>`;
    return { body, title: D.pxTitle, lead: D.pxLead, image: 'img/pluto-blink.jpg' };
  }
  const o = TARGETS.find(t => OBJECT_FILES[t.slug] && t.slug === id), name = NAME(code, o, w);
  if (o.follow) return followedPage(code, o, name, up);
  const how = o.view.mode === 'trail' ? D.how.stop : o.view.mode === 'bands' ? D.how.det : o.slug === 'rdra' ? D.how.month : D.how.visit;
  const eps = o.summary.epochs, facts = D.facts(new Intl.NumberFormat(code).format(o.summary.total), mjdDate(eps[0][0], code), mjdDate(eps[eps.length - 1][1], code));
  const open = `${up}?target=${o.slug}${code === 'en' ? '' : `&lang=${code}`}`;
  const simbad = `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(o.info?.mainId || o.query)}`;
  const wiki = o.wikiCard?.title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(o.wikiCard.title.replace(/ /g, '_'))}` : null;
  // the same spot over a quarter of a century, where it was built: 2MASS, WISE and NEOWISE, SPHEREx
  const Y = YEARS[o.slug], month = mjd => new Intl.DateTimeFormat(code, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date((mjd - 40587) * 864e5));
  const years = Y && existsSync(join(WEB, 'img', `${o.slug}-years.webp`)) ? `
    <h2>${esc(D.years.h)}</h2>
    <figure class="docfig"><img src="${up}img/${o.slug}-years.webp" width="392" height="392" loading="lazy" alt="${attr(D.years.cap(name, month(Y.span[0]), month(Y.span[1])))}"><figcaption>${esc(D.years.cap(name, month(Y.span[0]), month(Y.span[1])))}</figcaption></figure>
    <p class="docgo"><a href="${open}&mode=years">${esc(D.years.open)}</a></p>` : '';
  const body = `
    <p class="eyebrow">${esc(w[o.type])}${o.sp ? ` · ${esc(o.sp)}` : ''}</p>
    <h1>${esc(name)}</h1>
    <p class="lead">${esc(w[o.blurb])}</p>
    <figure class="docfig"><img src="${up}img/${o.slug}.gif" width="392" height="392" alt="${attr(D.alt(name, how))}"><figcaption>${esc(D.alt(name, how))}</figcaption></figure>
    <p>${italics(w[`tour.${o.slug}`])}</p>
    <h2>${esc(w['What to look for'])}</h2>
    <p>${esc(w[o.look])}</p>
    <p>${esc(facts)}</p>
    <p class="docgo"><a class="cta" href="${open}">${esc(D.openIt(name))}</a></p>${years}
    <p class="fine">${esc(D.sources)}: <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx, NASA/JPL-Caltech, IRSA</a> · ${o.eph
      ? `<a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT, IMCCE</a>`
      : `<a href="${simbad}" target="_blank" rel="noopener">SIMBAD</a> · <a href="https://www.cosmos.esa.int/web/gaia/dr3" target="_blank" rel="noopener">Gaia DR3</a>`}${years ? ` · <a href="https://irsa.ipac.caltech.edu/Missions/2mass.html" target="_blank" rel="noopener">2MASS</a> · <a href="https://irsa.ipac.caltech.edu/Missions/wise.html" target="_blank" rel="noopener">WISE, NEOWISE</a>` : ''}${wiki ? ` · <a href="${wiki}" target="_blank" rel="noopener">Wikipedia</a>` : ''}</p>`;
  // a link to the page shows the star's oldest and newest image side by side, where the Years view was built for it
  return { body, title: D.title(name), lead: `${w[o.blurb]} ${D.alt(name, how)}.`, image: years ? `img/${o.slug}-years.jpg` : `img/${o.slug}.jpg` };
}

/** The page of a body that is followed (comet 3I/ATLAS): its story, what the exposures show, and how the pictures are known to be centred on it. */
function followedPage(code, o, name, up) {
  const { words: w } = all[code], D = DOC[code], K = D.comet, M = all.en.followed[o.slug], b = o.body;
  const num = (v, d = 2) => new Intl.NumberFormat(code, { maximumFractionDigits: d }).format(v), band = v => new Intl.NumberFormat(code, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  const span = (a, z) => new Intl.DateTimeFormat(code, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).formatRange(new Date((a - 40587) * 864e5), new Date((z - 40587) * 864e5));
  const month = mjd => new Intl.DateTimeFormat(code, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date((mjd - 40587) * 864e5));
  const [first, last] = [M.visits[0], M.visits[M.visits.length - 1]];
  const story = K.story({ peri: mjdDate(b.peri.mjd, code), periAu: num(b.peri.au), near: mjdDate(b.near.mjd, code), nearAu: num(b.near.au), a: span(first.t0, first.t1), b: span(last.t0, last.t1) });
  const cell = g => (g.times === null ? '–' : !g.glows ? esc(w['no clear glow']) : g.times > 100 ? esc(w['more than ×100']) : `×${num(g.times, g.times >= 10 ? 0 : 1)}`);
  const table = `<table class="doctable"><thead><tr><th>${esc(K.gas)}</th><th>${esc(K.band)}</th>${M.visits.map(v => `<th>${esc(month((v.t0 + v.t1) / 2))}</th>`).join('')}</tr></thead><tbody>${
    M.visits[0].gases.map((g, i) => `<tr><td>${esc(w[g.name])} <small>${g.f}</small></td><td>${band(g.band[0])}–${band(g.band[1])}</td>${M.visits.map(v => `<td>${cell(v.gases[i])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const check = K.check({ n: M.centred.n, mid: num(M.centred.mid, 1), worst: num(M.centred.worst, 1) });
  const facts = K.facts(num(o.summary.total), num(first.exposures), span(first.t0, first.t1), num(last.exposures), span(last.t0, last.t1));
  const open = `${up}?target=${o.slug}${code === 'en' ? '' : `&lang=${code}`}`, alt = D.alt(name, K.how);
  const body = `
    <p class="eyebrow">${esc(w[o.type])}</p>
    <h1>${esc(name)}</h1>
    <p class="lead">${esc(w[o.blurb])}</p>
    <figure class="docfig"><img src="${up}img/${o.slug}.gif" width="392" height="392" alt="${attr(alt)}"><figcaption>${esc(alt)}</figcaption></figure>
    <p>${esc(story)}</p>
    <h2>${esc(w['What to look for'])}</h2>
    <p>${esc(w[o.look])}</p>
    <h2>${esc(K.shows)}</h2>
    <p>${esc(K.intro)}</p>
    ${table}
    <p>${esc(K.team)}</p>
    <h2>${esc(K.really)}</h2>
    <p>${esc(check)}</p>
    <p>${esc(facts)}</p>
    <p class="docgo"><a class="cta" href="${open}">${esc(D.openIt(name))}</a></p>
    <p class="fine">${esc(D.sources)}: <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/comet3iatlas/index.html" target="_blank" rel="noopener">IRSA: SPHEREx observations of Comet 3I/ATLAS</a> · <a href="https://science.nasa.gov/solar-system/comets/3i-atlas/3i-atlas-facts-and-faqs/" target="_blank" rel="noopener">NASA: Quick Facts about 3I/ATLAS</a> · <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener">JPL Horizons</a> · <a href="https://arxiv.org/abs/2512.07318" target="_blank" rel="noopener">Lisse et al., arXiv:2512.07318</a> · <a href="https://arxiv.org/abs/2601.06759" target="_blank" rel="noopener">Lisse et al., arXiv:2601.06759</a> · <a href="https://en.wikipedia.org/wiki/3I/ATLAS" target="_blank" rel="noopener">Wikipedia</a></p>`;
  return { body, title: D.title(name), lead: `${w[o.blurb]} ${alt}.`, image: `img/${o.slug}.jpg` };
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
  .doctable { border-collapse: collapse; margin: 14px 0 18px; font-size: 15px; }
  .doctable th, .doctable td { text-align: left; padding: 7px 18px 7px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .doctable th { font-weight: 500; color: var(--ink-3); font-size: 13px; }
  .doctable small { color: var(--ink-3); }
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
