// The four information pages in French. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { hunt: 'Chasse aux astéroïdes', spherex: 'Qu’est-ce que SPHEREx ?', how: 'Comment ça marche', about: 'À propos' },
  figure: {
    label: 'Un filtre dont la couleur change d’un bord à l’autre ; la même étoile tombe sur une couleur différente à chaque pose',
    exposure: 'pose',
    caption: 'Le télescope avance pas à pas sur le ciel : la même étoile tombe donc sur une nouvelle couleur du filtre à chaque pose.',
  },
  sheets: ({ TEAM, figure, team }) => ({
    spherex: () => `
    <p class="eyebrow">La mission</p>
    <h1>Qu’est-ce que SPHEREx ?</h1>
    <p class="lead">SPHEREx est un télescope spatial de la NASA qui photographie le ciel entier dans 102 couleurs de lumière infrarouge. Puis il recommence, tous les six mois.</p>
    <div class="statgrid">
      <div><b>102</b><span>couleurs, de 0,75 à 5 microns</span></div>
      <div><b>6 mois</b><span>pour cartographier tout le ciel une fois</span></div>
      <div><b>2025</b><span>lancé le 11 mars</span></div>
      <div><b>6,15″</b><span>la portion de ciel que couvre un pixel</span></div>
    </div>
    <h2>Pourquoi l’infrarouge ?</h2>
    <p>L’infrarouge est une lumière de longueur d’onde plus grande que celle que voient nos yeux. Les objets froids y brillent : naines brunes, nuages de poussière, étoiles géantes proches de la fin de leur vie. La lumière des galaxies très lointaines nous arrive étirée jusque dans l’infrarouge. Et des molécules comme l’eau, le dioxyde de carbone et le méthane absorbent chacune la lumière infrarouge à leurs propres longueurs d’onde : les couleurs infrarouges d’un objet révèlent donc de quoi il est fait.</p>
    <h2>102 couleurs sans roue à filtres</h2>
    <p>La plupart des caméras prennent une couleur à la fois. SPHEREx regarde à travers des filtres dont la couleur change progressivement d’un bord à l’autre. À mesure que le télescope avance sur le ciel, chaque étoile tombe sur une partie différente du filtre à chaque pose et est enregistrée dans une couleur différente.</p>
    ${figure}
    <p>Rassemblez assez de poses d’une étoile et vous avez son spectre entier. C’est pourquoi, dans Chronosphere, avancer dans le temps et construire un spectre sont un seul et même geste.</p>
    <h2>Pour quoi il a été construit</h2>
    <ul>
      <li><b>Le premier instant de l’Univers.</b> En cartographiant plus de 450 millions de galaxies en trois dimensions, il met à l’épreuve les idées sur ce qui s’est passé au premier moment après le Big Bang.</li>
      <li><b>L’histoire des galaxies.</b> Il mesure la lueur cumulée de toutes les galaxies, y compris celles qui sont trop faibles pour être vues une à une.</li>
      <li><b>L’eau et les ingrédients de la vie.</b> Il recense la glace d’eau, de dioxyde de carbone et d’autres glaces dans les nuages où se forment les étoiles et les planètes.</li>
    </ul>
    <h2>Et ce qu’il fait au passage</h2>
    <p>Comme SPHEREx revient sans cesse sur chaque point du ciel, il enregistre aussi tout ce qui <b>bouge ou change</b> : astéroïdes, comètes, étoiles proches qui défilent, naines brunes, étoiles qui pulsent ou qui ont des éruptions. Il photographie des centaines de millions d’étoiles et de galaxies, bien plus qu’une seule équipe ne peut en vérifier. Cet outil existe pour que davantage de gens puissent regarder.</p>
    <p class="fine">Sources : <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">page de la mission, NASA/JPL</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx dans les archives NASA/IPAC</a></p>`,

    how: () => `
    <p class="eyebrow">Sous le capot</p>
    <h1>Comment ça marche</h1>
    <p class="lead">Vous cliquez sur un point du ciel. Quelques secondes plus tard, vous regardez toutes les images que SPHEREx en a prises, alignées, avec un spectre en dessous. Voici ce qui se passe entre les deux.</p>
    <ol>
      <li><b>Le chercher dans l’index du ciel.</b> Un index compact de toutes les poses publiques de SPHEREx, environ 1,6 million, indique lesquelles étaient pointées près de votre point. L’index est reconstruit régulièrement à partir des archives de la NASA : les nouvelles publications de données apparaissent sans que personne ne touche au code.</li>
      <li><b>Ne lire que les pixels utiles.</b> Une pose complète est un fichier de plus de 60 mégaoctets. Votre navigateur lit son en-tête et seulement le petit bloc de pixels autour de votre point, quelques centaines de kilooctets, directement dans les données ouvertes de la NASA sur le cloud.</li>
      <li><b>Aligner les images.</b> Chaque pose a été prise sous un angle différent. Chaque bloc est redessiné sur une grille commune, le nord en haut, à l’aide des informations de position enregistrées dans le fichier, et la lueur du fond de ciel est retirée.</li>
      <li><b>Trouver la couleur de chaque pixel.</b> Chaque pose enregistre votre point à une longueur d’onde différente. Cette longueur d’onde est lue dans une table contenue dans chaque fichier.</li>
      <li><b>Calculer sur votre appareil.</b> Luminosité, sommes, soustractions, images en couleur, mesures et graphiques sont calculés dans votre navigateur ; c’est pourquoi chaque commande répond instantanément.</li>
      <li><b>Dire ce que c’est.</b> On demande au catalogue SIMBAD ce qui se trouve à cette position. Les catalogues enregistrent où se trouvait une étoile en l’an 2000 ; les étoiles proches qui se sont déplacées depuis sont donc amenées à la date d’aujourd’hui avant la comparaison.</li>
    </ol>
    <h2>Pas de serveur, et il fonctionne hors ligne</h2>
    <p>Chronosphere n’a pas de serveur à lui. La page est un ensemble de fichiers statiques ; tout le reste, c’est votre navigateur qui parle directement aux données ouvertes de la NASA. Il n’y a donc rien à maintenir en marche et rien qui puisse tomber en panne de notre côté. Tout ce que vous avez ouvert une fois, y compris la visite guidée entière, est enregistré sur votre appareil et continue de fonctionner sans connexion.</p>
    <h2>Comment lire ce que vous voyez</h2>
    <ul>
      <li><b>Visites.</b> SPHEREx revient sur la plupart des régions du ciel environ tous les six mois, et chaque visite dure de quelques jours à quelques semaines. Une image cumulée par visite, montrées l’une après l’autre, rend un petit déplacement facile à voir. Près des pôles du plan du Système solaire, il regarde presque à chaque orbite : là, les images sont regroupées par mois.</li>
      <li><b>La table des déplacements.</b> Pour un objet en mouvement, la position mesurée à chaque visite est comparée à ce que prédit le catalogue : son mouvement régulier sur le ciel plus, pour les étoiles les plus proches, l’oscillation annuelle due à l’orbite de la Terre elle-même. Le mouvement est mesuré séparément dans chaque détecteur qui voit l’objet, et les détecteurs sont comparés entre eux.</li>
      <li><b>Le spectre.</b> Chaque point est une pose : sa longueur d’onde et la luminosité du point entouré. Les points sont colorés selon la visite.</li>
      <li><b>Bandes moléculaires.</b> Des bandes ombrées marquent les endroits où les molécules courantes absorbent la lumière. Le tableau indique la profondeur du creux mesuré à cet endroit.</li>
      <li><b>Comparé à ses voisines.</b> Sous la courbe de luminosité, le changement du point entouré entre les visites est comparé à celui des étoiles ordinaires des mêmes images. Si elles sont restées stables et pas le point, le changement est réel et non un caprice de la caméra. On fait de même pour sa position.</li>
      <li><b>Chaque étoile, vérifiée.</b> Sous les images, chaque étoile nette du champ est testée en mouvement et en variation de luminosité, sans utiliser aucun catalogue. Les quelques-unes qui ressortent sont listées et marquées d’un losange. Un signalement est une raison de regarder, pas un résultat.</li>
      <li><b>Corps de passage.</b> Sous les images, chaque pose est examinée à la recherche de points qui restent quelques minutes au même endroit et n’y sont plus les autres jours : astéroïdes, comètes, planètes naines. SPHEREx s’arrête, prend jusqu’à quatre poses à deux minutes d’intervalle, et deux de ses six détecteurs regardent toujours la même région du ciel au même instant. Un corps réel apparaît donc sur plusieurs images indépendantes à la fois ; l’impact d’un rayon cosmique, sur une seule. Chaque corps trouvé est nommé par SkyBoT, un service de l’Observatoire de Paris qui sait où se trouvait chaque corps catalogué à cet instant, et peut être suivi d’arrêt en arrêt, avec son propre spectre.</li>
      <li><b>Années.</b> SPHEREx n’observe le ciel que depuis un an et demi : trop peu pour que la plupart des étoiles bougent. La vue Années ajoute des télescopes plus anciens : 2MASS, qui a observé chaque lieu une nuit entre 1997 et 2001, WISE en 2010 puis, sous le nom de NEOWISE, tous les six mois de 2014 à 2024. Pour les cinq objets de test, leurs propres poses sont posées sur la grille des images de SPHEREx ; ailleurs, ce sont les cartes du ciel de 2MASS et d’AllWISE. Une étoile du catalogue est retrouvée sur chaque image et son mouvement mesuré sur toute la période : l’étoile de Barnard, 10,42 secondes d’arc par an, contre 10,39 dans le catalogue. Un objet qui n’apparaît qu’aux plus grandes longueurs d’onde, comme WISE 0855, est froid : c’est ainsi que l’on trouve de tels mondes.</li>
    </ul>
    <h2>Ce qu’il ne peut pas vous dire</h2>
    <ul>
      <li>Un pixel de SPHEREx couvre 6,15 secondes d’arc. Même l’étoile dont la position dans le ciel change le plus vite se déplace de moins de deux pixels par an : le mouvement est donc un petit saut entre les visites, jamais une traînée.</li>
      <li>Les mesures utilisent un simple cercle fixe et servent à explorer, pas à publier. Les étoiles très brillantes saturent le détecteur ; pour elles, on mesure à la place la faible lueur extérieure de l’étoile et chaque détecteur est raccordé à son voisin : la forme générale du spectre est juste, son niveau et le détail fin sont approximatifs.</li>
      <li>Un creux à la longueur d’onde d’une molécule est un indice, pas une détection.</li>
      <li>Les positions se répètent à quelques dixièmes de seconde d’arc pour les étoiles ordinaires, mais une étoile proche de la saturation de la caméra peut s’écarter d’une seconde d’arc ou plus lors d’une seule visite.</li>
      <li>La recherche de corps de passage atteint environ la magnitude 18. Dans huit champs d’essai le long du plan du système solaire, elle a signalé vingt corps, de magnitude 14 à 18,8, et SkyBoT les connaissait tous ; dans huit champs éloignés de ce plan ou autour d’étoiles, elle n’en a signalé aucun. Un point qu’aucun catalogue ne connaît peut malgré tout être un défaut de l’image : c’est une raison de regarder à nouveau.</li>
      <li>Rien ici ne prétend à une découverte. Quelque chose qui paraît nouveau est une raison de le vérifier dans les autres outils proposés pour chaque objet.</li>
    </ul>`,

    hunt: () => `
    <p class="eyebrow">Chasse aux astéroïdes</p>
    <h1>Trouver un astéroïde sur les images SPHEREx</h1>
    <p class="lead">Astéroïdes, comètes et planètes naines traversent sans cesse les images de SPHEREx : des points qui restent quelques minutes au même endroit et n’y sont plus le lendemain. Voici comment en trouver un, ce que l’on obtient alors, et où une trouvaille se signale.</p>
    <p class="docgo"><a class="cta" href="./?hunt" data-do="hunt">Lancer une chasse</a></p>
    <h2>Trois façons d’en trouver un</h2>
    <ul>
      <li><b>Laisser l’outil choisir un champ.</b> « Trouver un astéroïde » prend au hasard l’un des trois mille premiers astéroïdes numérotés et ouvre une région du ciel qu’il a traversée pendant que SPHEREx regardait. La recherche ne sait ni de quel astéroïde il s’agit ni où il se trouvait. Elle lit toutes les poses de cette région, environ trois cents, et indique ce qui y est passé. Cela prend de deux à quatre minutes.</li>
      <li><b>Le demander par son nom.</b> Tapez un nom ou un numéro dans la case de recherche : Cérès, 433 Eros, Pluton, Uranus, 2P/Encke. L’outil consulte l’orbite, trouve les jours où SPHEREx a eu ce corps en vue et ouvre cette région du ciel, l’anneau déjà posé sur lui.</li>
      <li><b>Regarder n’importe où.</b> Quel que soit l’endroit ouvert, ses poses sont fouillées à la recherche de corps de passage, et ce qui a été trouvé est énuméré sous les images. La plupart des corps circulent près de l’écliptique, la bande du ciel que suivent les planètes.</li>
    </ul>
    <h2>Comment distinguer un corps d’un défaut</h2>
    <p>SPHEREx s’arrête, prend jusqu’à quatre poses à deux minutes d’intervalle, et deux de ses six détecteurs regardent toujours le même ciel au même instant. Un corps figure donc sur plusieurs images indépendantes au même endroit, et n’y est plus quand le télescope revient quelques heures plus tard. Une étoile est là à chaque fois. L’impact d’un rayon cosmique n’apparaît que sur une seule image.</p>
    <p>La recherche a été essayée sur des champs dont la réponse est connue. Dans huit champs le long de l’écliptique, elle a signalé vingt corps, et chacun était un corps catalogué au bon endroit. Dans huit autres champs, loin de l’écliptique ou autour d’étoiles, elle n’en a signalé aucun. Elle atteint à peu près la magnitude 18.</p>
    <h2>Ce que l’on obtient</h2>
    <ul>
      <li><b>Un nom.</b> Chaque corps trouvé est recherché dans SkyBoT, un service de l’Observatoire de Paris qui sait où se trouvait chaque corps catalogué à cet instant.</li>
      <li><b>Son mouvement.</b> Appuyez sur un corps pour le suivre : une image pour chaque arrêt du télescope, l’anneau qui l’accompagne, et la distance et la vitesse de son déplacement.</li>
      <li><b>Son spectre.</b> Chaque pose l’a saisi dans une couleur infrarouge différente, de 0,75 à 5 microns. Les relevés des couleurs des astéroïdes faits depuis le sol s’arrêtent vers 2,5 microns ; SPHEREx va au-delà, là où les minéraux hydratés et les glaces laissent leur marque. Le spectre de Pluton montre de la glace de méthane.</li>
      <li><b>Des fichiers à garder.</b> Son éclat à chaque longueur d’onde sous forme de tableau (CSV), et ses positions mesurées au format du Minor Planet Center (ADES), avec la position du satellite à chaque pose.</li>
    </ul>
    <h2>Est-il nouveau ?</h2>
    <p>Presque certainement pas, et mieux vaut le savoir avant la chasse qu’après. Une seule pose de SPHEREx atteint les astéroïdes de magnitude 18 environ. Les relevés qui cherchent chaque nuit de nouveaux astéroïdes ont catalogué la ceinture principale jusqu’à des corps bien plus faibles : ceux que SPHEREx peut voir ont donc été trouvés depuis longtemps. Dans nos essais, tous les corps signalés par la recherche étaient connus.</p>
    <p>Un point que SkyBoT ne sait pas nommer est le plus souvent un défaut d’une image. Avant d’y croire :</p>
    <ol>
      <li><b>Suivez-le.</b> Un vrai corps est trouvé à trois arrêts ou plus, sur une ligne droite, à une allure régulière.</li>
      <li><b>Regardez-le.</b> Dans « Poses », il doit ressembler aux étoiles qui l’entourent et figurer sur chaque image d’un arrêt.</li>
      <li><b>Interrogez le Minor Planet Center.</b> L’encadré d’un point sans nom renvoie vers MPChecker, le contrôle du Centre, avec l’endroit et l’instant déjà remplis. Il énumère tous les corps connus à proximité, y compris ceux trouvés la semaine dernière.</li>
    </ol>
    <h2>Où une trouvaille se signale</h2>
    <p>Les nouveaux astéroïdes et comètes se signalent au Centre des planètes mineures (Minor Planet Center, MPC). Il reçoit les positions mesurées par les observatoires du monde entier et calcule les orbites, sous l’égide de l’Union astronomique internationale. Ce qu’il faut :</p>
    <ul>
      <li><b>Des positions dans son format.</b> Au moins deux positions du corps pour une même nuit, dans le format appelé ADES. « Positions (ADES) » écrit ce fichier : les instants, les positions, leur précision et, pour chaque pose, l’endroit où se trouvait SPHEREx, car un télescope en orbite voit un corps proche sous un angle légèrement différent de celui du centre de la Terre. SPHEREx est l’observatoire 288 dans la liste du MPC.</li>
      <li><b>D’abord un mot au MPC.</b> Les images de SPHEREx sont des données d’archives provenant du télescope de quelqu’un d’autre. Pour de telles données, le MPC demande à être contacté, par son service d’assistance, avant tout envoi. Le fichier est la pièce à joindre.</li>
      <li><b>De la patience.</b> Un corps vu une seule nuit attend dans un fichier de traces non confirmées jusqu’à ce que d’autres observations lui soient rattachées. Une fois son orbite connue, il reçoit une désignation provisoire. Un numéro suit lorsque l’orbite est sûre, pour un astéroïde de la ceinture principale après environ quatre retours. C’est alors que la découverte est attribuée, et alors seulement que le découvreur peut proposer un nom, dont décide un groupe de travail de l’Union astronomique internationale.</li>
    </ul>
    <p>Si c’est découvrir un nouvel astéroïde qui vous attire : l’International Astronomical Search Collaboration (IASC) de la NASA confie à des volontaires des images récentes du télescope Pan-STARRS à examiner, et signale leurs trouvailles au MPC.</p>
    <h2>Ce qu’apporte SPHEREx</h2>
    <p>Ce qui est nouveau sur ces images, ce n’est pas l’astéroïde, c’est sa lumière. SPHEREx devrait enregistrer plus de cent mille astéroïdes et comètes dans 102 couleurs infrarouges, et une collaboration autour de la mission prépare un catalogue de leurs spectres. Avec cet outil, vous pouvez regarder n’importe lequel d’entre eux dès aujourd’hui, arrêt après arrêt.</p>
    <p class="fine">Sources: <a href="https://www.minorplanetcenter.net/about" target="_blank" rel="noopener">Minor Planet Center</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/" target="_blank" rel="noopener">MPC: guide pour signaler des positions</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/data-and-services/sarc/" target="_blank" rel="noopener">MPC: observations d’archives</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/discoveries-and-credit/" target="_blank" rel="noopener">MPC: découvertes, attribution et noms</a> · <a href="https://minorplanetcenter.net/cgi-bin/checkmp.cgi" target="_blank" rel="noopener">MPChecker</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT</a>, <a href="https://ssp.imcce.fr/webservices/miriade/" target="_blank" rel="noopener">Miriade</a> (IMCCE, Observatoire de Paris) · <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf" target="_blank" rel="noopener">SPHEREx Explanatory Supplement</a> · <a href="https://meetingorganizer.copernicus.org/EPSC2026/EPSC2026-797.html" target="_blank" rel="noopener">Mahlke et al. 2026</a> · <a href="https://arxiv.org/abs/2010.07822" target="_blank" rel="noopener">Hendler &amp; Malhotra 2020</a> · <a href="https://science.nasa.gov/get-involved/citizen-science/new-way-you-can-discover-asteroids/" target="_blank" rel="noopener">NASA: IASC</a></p>`,

    about: () => `
    <p class="eyebrow">À propos</p>
    <h1>Fait pour que davantage de gens puissent regarder</h1>
    <p class="lead">Chronosphere a commencé les 14 et 15 novembre 2026 au NASA Space Apps Challenge, pour le défi <i>Planet X and SPHEREx</i>, avec l’équipe ${TEAM.name}, et nous continuons à le construire depuis. La semaine suivante sont arrivés la recherche des astéroïdes et des comètes qui traversent un champ, la chasse aux astéroïdes avec un rapport prêt pour le Minor Planet Center, la comète 3I/ATLAS et la vue « Années », qui réunit 27 ans d’images de 2MASS, WISE et SPHEREx sur une même grille.</p>
    ${team('L’équipe')}
    <h2>Pourquoi nous l’avons fait</h2>
    <p>Pluton a été trouvée en 1930 par une personne qui comparait deux photographies. On trouve encore de nouveaux mondes de cette façon. Des bénévoles ont repéré la plupart des plus de 5 000 comètes découvertes dans les images de la sonde SOHO, et environ 3 000 candidates naines brunes dans les images du télescope WISE de la NASA. SPHEREx photographie maintenant des centaines de millions d’objets, encore et encore : plus que n’importe quel groupe de professionnels ne peut en inspecter.</p>
    <p>Nous voulions un outil où chacun, sans formation, puisse choisir un point du ciel et voir par lui-même si quelque chose y a bougé ou changé, puis le vérifier auprès de sources indépendantes en un clic.</p>
    <p>Le défi tient son nom de la Planète X, la planète hypothétique encore non découverte du Système solaire externe. Que SPHEREx puisse la voir ou non, tout objet proche inconnu se trahirait comme Pluton l’a fait : par un point qui bouge.</p>
    <h2>À qui il s’adresse</h2>
    <ul>
      <li><b>À tous les curieux.</b> Sans compte et sans formation : la visite guidée dure deux minutes, et chaque objet s’ouvre sur quelques phrases simples qui disent ce que montrent les mesures.</li>
      <li><b>Aux enseignants et aux élèves.</b> Une classe peut trouver une étoile qui se déplace comme on a trouvé Pluton, sur de vraies images de la NASA. La visite guidée est conservée sur l’appareil et fonctionne sans connexion, en six langues.</li>
      <li><b>Aux astronomes amateurs et aux chercheurs.</b> Les mesures de n’importe quel point se téléchargent sous forme de tableau (CSV), chaque pose renvoie à son fichier d’origine dans l’archive de la NASA, et chaque vue se partage par un lien ou s’intègre dans une autre page.</li>
    </ul>
    <h2>D’où viennent les données</h2>
    <ul>
      <li><b>Images et carte du ciel entier de SPHEREx :</b> NASA/JPL-Caltech, servies par le NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Autres cartes du ciel :</b> 2MASS, WISE et DSS, en HiPS construits par le CDS et servis par l’IRSA.</li>
      <li><b>Images plus anciennes du même ciel (la vue Années) :</b> images de l’atlas de 2MASS (de 1997 à 2001), poses individuelles de WISE et NEOWISE (de 2010 à 2024), diffusées par l’IRSA.</li>
      <li><b>Catalogues :</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Strasbourg).</li>
      <li><b>Composant d’atlas du ciel :</b> Aladin Lite (CDS).</li>
      <li><b>Fiches d’encyclopédie :</b> Wikipédia, affichées avec un lien vers l’article.</li>
    </ul>
    <h2>Code ouvert</h2>
    <p>Le code est public : <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. Il n’a ni étape de compilation ni serveur : la page peut être hébergée partout où l’on sert des fichiers.</p>
    <h2>Usage de l’IA</h2>
    <p>Le logiciel a été écrit avec un assistant de programmation IA pendant l’événement. L’équipe a choisi l’approche, vérifié les résultats par rapport aux valeurs des catalogues et à des outils indépendants, et est responsable du contenu. Aucune image, aucun son ni aucune vidéo générés par IA ne sont utilisés : chaque image montrée est une donnée de télescope.</p>
    <p class="fine">Sources des chiffres ci-dessus : <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">la NASA sur la 5 000e comète de SOHO</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};
