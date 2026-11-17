// The three information pages in French. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { spherex: 'Qu’est-ce que SPHEREx ?', how: 'Comment ça marche', about: 'À propos' },
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
    </ul>
    <h2>Ce qu’il ne peut pas vous dire</h2>
    <ul>
      <li>Un pixel de SPHEREx couvre 6,15 secondes d’arc. Même l’étoile dont la position dans le ciel change le plus vite se déplace de moins de deux pixels par an : le mouvement est donc un petit saut entre les visites, jamais une traînée.</li>
      <li>Les mesures utilisent un simple cercle fixe et servent à explorer, pas à publier. Les étoiles très brillantes saturent le détecteur ; pour elles, on mesure à la place la faible lueur extérieure de l’étoile et chaque détecteur est raccordé à son voisin : la forme générale du spectre est juste, son niveau et le détail fin sont approximatifs.</li>
      <li>Un creux à la longueur d’onde d’une molécule est un indice, pas une détection.</li>
      <li>Les positions se répètent à quelques dixièmes de seconde d’arc pour les étoiles ordinaires, mais une étoile proche de la saturation de la caméra peut s’écarter d’une seconde d’arc ou plus lors d’une seule visite.</li>
      <li>Rien ici ne prétend à une découverte. Quelque chose qui paraît nouveau est une raison de le vérifier dans les autres outils proposés pour chaque objet.</li>
    </ul>`,

    about: () => `
    <p class="eyebrow">À propos</p>
    <h1>Fait en un week-end, pour que davantage de gens puissent regarder</h1>
    <p class="lead">Chronosphere a été construit les 14 et 15 novembre 2026 au NASA Space Apps Challenge, pour le défi <i>Planet X and SPHEREx</i>, par l’équipe ${TEAM.name}.</p>
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
