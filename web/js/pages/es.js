// The four information pages in Spanish. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { hunt: 'Caza de asteroides', spherex: '¿Qué es SPHEREx?', how: 'Cómo funciona', about: 'Acerca de' },
  figure: {
    label: 'Un filtro cuyo color cambia de un borde al otro; la misma estrella cae sobre un color distinto en cada exposición',
    exposure: 'exposición',
    caption: 'El telescopio avanza paso a paso por el cielo, de modo que la misma estrella cae sobre un color nuevo del filtro en cada exposición.',
  },
  sheets: ({ TEAM, figure, team }) => ({
    spherex: () => `
    <p class="eyebrow">La misión</p>
    <h1>¿Qué es SPHEREx?</h1>
    <p class="lead">SPHEREx es un telescopio espacial de la NASA que fotografía todo el cielo en 102 colores de luz infrarroja. Y después lo vuelve a hacer, cada seis meses.</p>
    <div class="statgrid">
      <div><b>102</b><span>colores, de 0,75 a 5 micras</span></div>
      <div><b>6 meses</b><span>para cartografiar todo el cielo una vez</span></div>
      <div><b>2025</b><span>lanzado el 11 de marzo</span></div>
      <div><b>6,15″</b><span>el trozo de cielo que cubre un píxel</span></div>
    </div>
    <h2>¿Por qué infrarrojo?</h2>
    <p>El infrarrojo es luz de una longitud de onda mayor que la que ven nuestros ojos. Las cosas frías brillan en él: enanas marrones, nubes de polvo, estrellas gigantes cerca del final de su vida. La luz de las galaxias muy lejanas nos llega estirada hasta el infrarrojo. Y moléculas como el agua, el dióxido de carbono y el metano absorben luz infrarroja cada una en sus propias longitudes de onda, de modo que los colores infrarrojos de un objeto revelan de qué está hecho.</p>
    <h2>102 colores sin rueda de filtros</h2>
    <p>La mayoría de las cámaras toman un color cada vez. SPHEREx mira a través de filtros cuyo color cambia suavemente de un borde al otro. A medida que el telescopio avanza por el cielo, cada estrella cae en una parte distinta del filtro en cada exposición y queda registrada en un color distinto.</p>
    ${figure}
    <p>Reúne suficientes exposiciones de una estrella y tendrás su espectro completo. Por eso, en Chronosphere, avanzar en el tiempo y construir un espectro son el mismo acto.</p>
    <h2>Para qué se construyó</h2>
    <ul>
      <li><b>El primer instante del universo.</b> Al cartografiar más de 450 millones de galaxias en tres dimensiones, pone a prueba las ideas sobre lo que ocurrió en el primer momento después del Big Bang.</li>
      <li><b>La historia de las galaxias.</b> Mide el resplandor conjunto de todas las galaxias, incluidas las que son demasiado débiles para verse una a una.</li>
      <li><b>El agua y los ingredientes de la vida.</b> Estudia el agua helada, el dióxido de carbono y otros hielos en las nubes donde se forman estrellas y planetas.</li>
    </ul>
    <h2>Y lo que hace de paso</h2>
    <p>Como SPHEREx vuelve una y otra vez a cada punto del cielo, también registra todo lo que <b>se mueve o cambia</b>: asteroides, cometas, estrellas cercanas que pasan, enanas marrones, estrellas que laten o tienen fulguraciones. Fotografía cientos de millones de estrellas y galaxias, muchas más de las que ningún equipo puede revisar. Esta herramienta existe para que más gente pueda mirar.</p>
    <p class="fine">Fuentes: <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">página de la misión de NASA/JPL</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx en el archivo de NASA/IPAC</a></p>`,

    how: () => `
    <p class="eyebrow">Por dentro</p>
    <h1>Cómo funciona</h1>
    <p class="lead">Haces clic en un punto del cielo. Unos segundos después estás viendo todas las imágenes que SPHEREx ha tomado de él, alineadas, con un espectro debajo. Esto es lo que ocurre entre medias.</p>
    <ol>
      <li><b>Buscarlo en el índice del cielo.</b> Un índice compacto de todas las exposiciones públicas de SPHEREx, alrededor de 1,6 millones, indica cuáles apuntaron cerca de tu punto. El índice se reconstruye periódicamente a partir del archivo de la NASA, así que las nuevas versiones de datos aparecen sin que nadie toque el código.</li>
      <li><b>Leer solo los píxeles que importan.</b> Una exposición completa es un archivo de más de 60 megabytes. Tu navegador lee su cabecera y solo el pequeño bloque de píxeles que rodea tu punto, unos cientos de kilobytes, directamente de los datos abiertos de la NASA en la nube.</li>
      <li><b>Alinear las imágenes.</b> Cada exposición se tomó con un ángulo distinto. Cada bloque se vuelve a dibujar sobre una cuadrícula común, con el norte arriba, usando la información de posición guardada en el archivo, y se resta el resplandor del fondo del cielo.</li>
      <li><b>Hallar el color de cada píxel.</b> Cada exposición registra tu punto en una longitud de onda distinta. Esa longitud de onda se lee de una tabla que va dentro de cada archivo.</li>
      <li><b>Calcular en tu dispositivo.</b> El brillo, las sumas, las restas, las imágenes en color, las medidas y los gráficos se calculan en tu navegador; por eso cada control responde al instante.</li>
      <li><b>Decir qué es.</b> Se pregunta al catálogo SIMBAD qué hay en esa posición. Los catálogos guardan dónde estaba una estrella en el año 2000, así que las estrellas cercanas que se han desplazado desde entonces se llevan a la fecha de hoy antes de compararlas.</li>
    </ol>
    <h2>Sin servidor, y funciona sin conexión</h2>
    <p>Chronosphere no tiene servidor propio. La página es un conjunto de archivos estáticos; todo lo demás es tu navegador hablando directamente con los datos abiertos de la NASA. Eso significa que no hay nada que mantener en marcha ni nada que pueda caerse por nuestra parte. Todo lo que hayas abierto una vez, incluida la visita guiada completa, queda guardado en tu dispositivo y sigue funcionando sin conexión.</p>
    <h2>Cómo leer lo que ves</h2>
    <ul>
      <li><b>Visitas.</b> SPHEREx vuelve a la mayor parte del cielo cada seis meses aproximadamente, y cada visita dura de unos días a unas semanas. Una imagen sumada por visita, mostradas una tras otra, hace que un pequeño desplazamiento sea fácil de ver. Cerca de los polos del plano del sistema solar mira casi en cada órbita, así que allí las imágenes se agrupan por meses.</li>
      <li><b>La tabla de desplazamientos.</b> Para un objeto en movimiento, la posición medida en cada visita se compara con lo que predice el catálogo: su movimiento uniforme por el cielo más, en las estrellas más cercanas, la oscilación anual causada por la órbita de la propia Tierra. El movimiento se mide por separado en cada detector que ve el objeto, y los detectores se comparan entre sí.</li>
      <li><b>El espectro.</b> Cada punto es una exposición: su longitud de onda y el brillo que tenía el punto rodeado. Los puntos se colorean según la visita.</li>
      <li><b>Bandas moleculares.</b> Las franjas sombreadas marcan dónde absorben luz las moléculas comunes. La tabla indica qué profundidad tiene la caída medida allí.</li>
      <li><b>Comparado con sus vecinas.</b> Bajo la curva de brillo, el cambio del punto rodeado entre visitas se compara con las estrellas corrientes de las mismas imágenes. Si ellas se mantuvieron constantes y el punto no, el cambio es real y no una rareza de la cámara. Lo mismo se hace con su posición.</li>
      <li><b>Cada estrella, comprobada.</b> Bajo las imágenes, cada estrella nítida del campo se pone a prueba en movimiento y en cambios de brillo, sin usar ningún catálogo. Las pocas que destacan se listan y se marcan con un rombo. Una marca es un motivo para mirar, no un hallazgo.</li>
      <li><b>Cuerpos de paso.</b> Bajo las imágenes, cada exposición se examina en busca de puntos que están unos minutos en un mismo lugar y que otros días ya no están allí: asteroides, cometas, planetas enanos. SPHEREx se detiene, toma hasta cuatro exposiciones separadas por dos minutos, y dos de sus seis detectores miran siempre la misma zona del cielo en el mismo instante. Por eso un cuerpo real aparece a la vez en varias imágenes independientes; el impacto de un rayo cósmico, solo en una. A cada cuerpo encontrado le pone nombre SkyBoT, un servicio del Observatorio de París que sabe dónde estaba cada cuerpo catalogado en ese momento, y se le puede seguir de parada en parada, con su propio espectro.</li>
    </ul>
    <h2>Lo que no puede decirte</h2>
    <ul>
      <li>Un píxel de SPHEREx cubre 6,15 segundos de arco. Incluso la estrella que cambia de posición en el cielo más deprisa se mueve menos de dos píxeles al año, así que el movimiento es un pequeño salto entre visitas, nunca un trazo.</li>
      <li>Las medidas usan un círculo fijo sencillo y sirven para explorar, no para publicar. Las estrellas muy brillantes saturan el detector; en ellas se mide en su lugar el débil resplandor exterior de la estrella y cada detector se une a su vecino: la forma general del espectro es correcta, su nivel y el detalle fino son aproximados.</li>
      <li>Una caída en la longitud de onda de una molécula es un indicio, no una detección.</li>
      <li>Las posiciones se repiten con una precisión de unas décimas de segundo de arco en las estrellas corrientes, pero una estrella cerca de saturar la cámara puede desviarse un segundo de arco o más en una sola visita.</li>
      <li>La búsqueda de cuerpos de paso llega hasta la magnitud 18 aproximadamente. En ocho campos de prueba a lo largo del plano del sistema solar señaló veinte cuerpos, de magnitud 14 a 18,8, y SkyBoT los conocía todos; en ocho campos alejados de ese plano o alrededor de estrellas no señaló ninguno. Un punto que ningún catálogo conoce puede ser aun así un defecto de la imagen: es un motivo para volver a mirar.</li>
      <li>Nada de lo que hay aquí pretende ser un descubrimiento. Algo que parece nuevo es un motivo para comprobarlo en las otras herramientas enlazadas desde cada objeto.</li>
    </ul>`,

    hunt: () => `
    <p class="eyebrow">Caza de asteroides</p>
    <h1>Encuentra un asteroide en las imágenes de SPHEREx</h1>
    <p class="lead">Asteroides, cometas y planetas enanos cruzan sin cesar las imágenes de SPHEREx: puntos que están unos minutos en un mismo lugar y al día siguiente ya no. Aquí se explica cómo encontrar uno, qué obtienes al hacerlo y dónde se comunica un hallazgo.</p>
    <p class="docgo"><a class="cta" href="./?hunt" data-do="hunt">Empezar una caza</a></p>
    <h2>Tres maneras de encontrar uno</h2>
    <ul>
      <li><b>Deja que la herramienta elija el campo.</b> «Buscar un asteroide» toma al azar uno de los tres mil primeros asteroides numerados y abre una zona del cielo que cruzó mientras SPHEREx miraba. A la búsqueda no se le dice ni qué asteroide es ni dónde estaba. Lee todas las exposiciones de esa zona, unas trescientas, e indica qué pasó por allí. Tarda de dos a cuatro minutos.</li>
      <li><b>Pídelo por su nombre.</b> Escribe un nombre o un número en la casilla de búsqueda: Ceres, 433 Eros, Plutón, Urano, 2P/Encke. La herramienta consulta la órbita, encuentra los días en que SPHEREx tuvo el cuerpo a la vista y abre esa zona del cielo con el anillo ya sobre él.</li>
      <li><b>Mira en cualquier parte.</b> Abras el lugar que abras, en sus exposiciones se buscan cuerpos de paso, y lo encontrado se enumera bajo las imágenes. La mayoría de los cuerpos viaja cerca de la eclíptica, la franja del cielo por la que se mueven los planetas.</li>
    </ul>
    <h2>Cómo se distingue un cuerpo de un defecto</h2>
    <p>SPHEREx se detiene, toma hasta cuatro exposiciones con dos minutos de diferencia, y dos de sus seis detectores miran siempre la misma zona del cielo en el mismo momento. Por eso un cuerpo aparece en varias imágenes independientes en un mismo lugar, y ya no está allí cuando el telescopio vuelve horas después. Una estrella está siempre. El impacto de un rayo cósmico aparece en una sola imagen.</p>
    <p>La búsqueda se probó en campos cuya respuesta se conoce. En ocho campos a lo largo de la eclíptica señaló veinte cuerpos, y cada uno era un cuerpo catalogado en el lugar correcto. En otros ocho campos, lejos de la eclíptica o alrededor de estrellas, no señaló ninguno. Llega hasta la magnitud 18, aproximadamente.</p>
    <h2>Qué obtienes</h2>
    <ul>
      <li><b>Un nombre.</b> Cada cuerpo encontrado se consulta en SkyBoT, un servicio del Observatorio de París que sabe dónde estaba cada cuerpo catalogado en ese momento.</li>
      <li><b>Su movimiento.</b> Pulsa un cuerpo para seguirlo: una imagen por cada parada del telescopio, el anillo moviéndose con él, y cuánto y con qué rapidez se desplazó.</li>
      <li><b>Su espectro.</b> Cada exposición lo captó en un color infrarrojo distinto, de 0,75 a 5 micras. Los estudios de los colores de los asteroides hechos desde tierra terminan cerca de las 2,5 micras; SPHEREx sigue hasta donde dejan su huella los minerales con agua y los hielos. El espectro de Plutón muestra hielo de metano.</li>
      <li><b>Archivos para guardar.</b> Su brillo en cada longitud de onda en forma de tabla (CSV) y sus posiciones medidas en el formato del Minor Planet Center (ADES), con el lugar donde estaba el satélite en cada exposición.</li>
    </ul>
    <h2>¿Es nuevo?</h2>
    <p>Casi seguro que no, y es mejor saberlo antes de la caza que después. Una sola exposición de SPHEREx alcanza asteroides de magnitud 18, aproximadamente. Los sondeos que buscan asteroides nuevos cada noche han catalogado el cinturón principal hasta cuerpos muchas veces más débiles, de modo que los que SPHEREx puede ver se encontraron hace tiempo. En nuestras pruebas, todos los cuerpos que señaló la búsqueda eran conocidos.</p>
    <p>Un punto al que SkyBoT no puede poner nombre es, casi siempre, un defecto de una imagen. Antes de creerlo:</p>
    <ol>
      <li><b>Síguelo.</b> Un cuerpo real se encuentra en tres paradas o más, en línea recta y a un ritmo constante.</li>
      <li><b>Míralo.</b> En «Exposiciones» debería parecerse a las estrellas que lo rodean y estar en todas las imágenes de una parada.</li>
      <li><b>Pregunta al Minor Planet Center.</b> El recuadro de un punto sin nombre enlaza con MPChecker, la comprobación del Centro, con el lugar y el momento ya rellenados. Enumera todos los cuerpos conocidos cerca de allí, también los hallados la semana pasada.</li>
    </ol>
    <h2>Dónde se comunica un hallazgo</h2>
    <p>Los asteroides y cometas nuevos se comunican al Centro de Planetas Menores (Minor Planet Center, MPC). Recibe las posiciones que miden los observatorios de todo el mundo y calcula las órbitas, bajo los auspicios de la Unión Astronómica Internacional. Lo que hace falta:</p>
    <ul>
      <li><b>Posiciones en su formato.</b> Al menos dos posiciones del cuerpo de una misma noche, en el formato llamado ADES. «Posiciones (ADES)» escribe ese archivo: las horas, las posiciones, con qué precisión se conocen y, para cada exposición, dónde estaba SPHEREx, porque un telescopio en órbita ve un cuerpo cercano desde un ángulo algo distinto del que tendría el centro de la Tierra. SPHEREx es el observatorio 288 de la lista del MPC.</li>
      <li><b>Hablar antes con el MPC.</b> Las imágenes de SPHEREx son datos de archivo del telescopio de otros. Para esos datos, el MPC pide que se le escriba, a través de su servicio de ayuda, antes de enviar nada. El archivo es lo que hay que adjuntar.</li>
      <li><b>Paciencia.</b> Un cuerpo visto una sola noche espera en un fichero de trazas sin confirmar hasta que se le enlazan otras observaciones. Con una órbita recibe una designación provisional. El número llega cuando la órbita es segura; para un asteroide del cinturón principal, tras unos cuatro retornos. Entonces se decide a quién corresponde el descubrimiento, y solo entonces puede el descubridor proponer un nombre, que decide un grupo de trabajo de la Unión Astronómica Internacional.</li>
    </ul>
    <p>Si lo que buscas es descubrir un asteroide nuevo: la International Astronomical Search Collaboration (IASC), de la NASA, da a los voluntarios imágenes recientes del telescopio Pan-STARRS para que las examinen, y comunica sus hallazgos al MPC.</p>
    <h2>Lo que aporta SPHEREx</h2>
    <p>Lo nuevo en estas imágenes no es el asteroide, sino su luz. Se espera que SPHEREx registre más de cien mil asteroides y cometas en 102 colores infrarrojos, y una colaboración en torno a la misión prepara un catálogo de sus espectros. Con esta herramienta puedes mirar cualquiera de ellos hoy mismo, parada a parada del telescopio.</p>
    <p class="fine">Fuentes: <a href="https://www.minorplanetcenter.net/about" target="_blank" rel="noopener">Minor Planet Center</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/" target="_blank" rel="noopener">MPC: guía para comunicar posiciones</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/data-and-services/sarc/" target="_blank" rel="noopener">MPC: observaciones de archivo</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/discoveries-and-credit/" target="_blank" rel="noopener">MPC: descubrimientos, autoría y nombres</a> · <a href="https://minorplanetcenter.net/cgi-bin/checkmp.cgi" target="_blank" rel="noopener">MPChecker</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT</a>, <a href="https://ssp.imcce.fr/webservices/miriade/" target="_blank" rel="noopener">Miriade</a> (IMCCE, Observatorio de París) · <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf" target="_blank" rel="noopener">SPHEREx Explanatory Supplement</a> · <a href="https://meetingorganizer.copernicus.org/EPSC2026/EPSC2026-797.html" target="_blank" rel="noopener">Mahlke et al. 2026</a> · <a href="https://arxiv.org/abs/2010.07822" target="_blank" rel="noopener">Hendler &amp; Malhotra 2020</a> · <a href="https://science.nasa.gov/get-involved/citizen-science/new-way-you-can-discover-asteroids/" target="_blank" rel="noopener">NASA: IASC</a></p>`,

    about: () => `
    <p class="eyebrow">Acerca de</p>
    <h1>Hecho en un fin de semana, para que más gente pueda mirar</h1>
    <p class="lead">Chronosphere se construyó el 14 y el 15 de noviembre de 2026 en el NASA Space Apps Challenge, para el reto <i>Planet X and SPHEREx</i>, por el equipo ${TEAM.name}.</p>
    ${team('El equipo')}
    <h2>Por qué lo hicimos</h2>
    <p>Plutón fue encontrado en 1930 por una persona que comparaba dos fotografías. Todavía hoy se encuentran mundos nuevos de esa manera. Voluntarios han localizado la mayoría de los más de 5000 cometas descubiertos en las imágenes de la nave SOHO, y unas 3000 candidatas a enana marrón en las imágenes del telescopio WISE de la NASA. SPHEREx está fotografiando ahora cientos de millones de objetos, una y otra vez: más de lo que cualquier grupo de profesionales puede inspeccionar.</p>
    <p>Queríamos una herramienta con la que cualquiera, sin formación previa, pudiera elegir un punto del cielo y ver por sí mismo si algo allí se ha movido o ha cambiado, y después comprobarlo con fuentes independientes en un clic.</p>
    <p>El reto toma su nombre del Planeta X, el hipotético planeta aún no descubierto del sistema solar exterior. Pueda verlo SPHEREx o no, cualquier objeto cercano desconocido se delataría igual que lo hizo Plutón: como un punto que se mueve.</p>
    <h2>Para quién es</h2>
    <ul>
      <li><b>Cualquier persona curiosa.</b> Sin cuenta y sin formación previa: la visita guiada dura dos minutos y cada objeto se abre con unas frases sencillas sobre lo que muestran las mediciones.</li>
      <li><b>Docentes y estudiantes.</b> Una clase puede encontrar una estrella que se mueve tal como se encontró Plutón, en imágenes reales de la NASA. La visita guiada se guarda en el dispositivo y funciona sin conexión, en seis idiomas.</li>
      <li><b>Aficionados a la astronomía e investigadores.</b> Las mediciones de cualquier punto se pueden descargar como tabla (CSV), cada exposición enlaza con su archivo original en el archivo de la NASA, y cualquier vista se puede compartir como enlace o insertar en otra página.</li>
    </ul>
    <h2>De dónde vienen los datos</h2>
    <ul>
      <li><b>Imágenes y mapa de todo el cielo de SPHEREx:</b> NASA/JPL-Caltech, servidos por el Archivo de Ciencia Infrarroja de NASA/IPAC (IRSA).</li>
      <li><b>Otros mapas del cielo:</b> 2MASS, WISE y DSS, como HiPS elaborados por el CDS y servidos por IRSA.</li>
      <li><b>Catálogos:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Estrasburgo).</li>
      <li><b>Componente de atlas del cielo:</b> Aladin Lite (CDS).</li>
      <li><b>Fichas de enciclopedia:</b> Wikipedia, mostradas con un enlace al artículo.</li>
    </ul>
    <h2>Código abierto</h2>
    <p>El código es público: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. No tiene paso de compilación ni servidor: la página puede alojarse en cualquier sitio que sirva archivos.</p>
    <h2>Uso de IA</h2>
    <p>El software se escribió con un asistente de programación de IA durante el evento. El equipo eligió el enfoque, comprobó los resultados con valores de catálogo y con herramientas independientes, y es responsable del contenido. No se usan imágenes, audio ni vídeo generados por IA: cada imagen mostrada son datos de telescopio.</p>
    <p class="fine">Fuentes de las cifras anteriores: <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">la NASA sobre el cometa número 5000 de SOHO</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};
