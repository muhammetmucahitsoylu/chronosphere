// The four information pages in German. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { hunt: 'Asteroidenjagd', spherex: 'Was ist SPHEREx?', how: 'So funktioniert es', about: 'Über uns' },
  figure: {
    label: 'Ein Filter, dessen Farbe sich von einem Rand zum anderen ändert; derselbe Stern fällt in jeder Aufnahme auf eine andere Farbe',
    exposure: 'Aufnahme',
    caption: 'Das Teleskop rückt schrittweise über den Himmel, sodass derselbe Stern in jeder Aufnahme auf eine neue Farbe des Filters fällt.',
  },
  sheets: ({ TEAM, figure, team }) => ({
    spherex: () => `
    <p class="eyebrow">Die Mission</p>
    <h1>Was ist SPHEREx?</h1>
    <p class="lead">SPHEREx ist ein Weltraumteleskop der NASA, das den gesamten Himmel in 102 Farben des infraroten Lichts fotografiert. Und dann wieder, alle sechs Monate.</p>
    <div class="statgrid">
      <div><b>102</b><span>Farben, von 0,75 bis 5 Mikrometer</span></div>
      <div><b>6 Monate</b><span>für eine Karte des ganzen Himmels</span></div>
      <div><b>2025</b><span>gestartet am 11. März</span></div>
      <div><b>6,15″</b><span>das Himmelsstück, das ein Pixel abdeckt</span></div>
    </div>
    <h2>Warum Infrarot?</h2>
    <p>Infrarot ist Licht mit einer längeren Wellenlänge, als unsere Augen sehen können. Kühle Dinge leuchten darin: Braune Zwerge, Staubwolken, Riesensterne kurz vor dem Ende ihres Lebens. Das Licht sehr ferner Galaxien kommt bis ins Infrarote gedehnt bei uns an. Und Moleküle wie Wasser, Kohlendioxid und Methan absorbieren infrarotes Licht jeweils bei ihren eigenen Wellenlängen, sodass die infraroten Farben eines Objekts verraten, woraus es besteht.</p>
    <h2>102 Farben ohne Filterrad</h2>
    <p>Die meisten Kameras nehmen eine Farbe nach der anderen auf. SPHEREx blickt durch Filter, deren Farbe sich von einem Rand zum anderen gleichmäßig ändert. Während das Teleskop über den Himmel rückt, fällt jeder Stern in jeder Aufnahme auf eine andere Stelle des Filters und wird in einer anderen Farbe aufgezeichnet.</p>
    ${figure}
    <p>Wer genug Aufnahmen eines Sterns sammelt, hat sein ganzes Spektrum. Deshalb sind in Chronosphere das Voranschreiten in der Zeit und der Aufbau eines Spektrums ein und derselbe Vorgang.</p>
    <h2>Wofür es gebaut wurde</h2>
    <ul>
      <li><b>Der erste Augenblick des Universums.</b> Mit einer dreidimensionalen Karte von mehr als 450 Millionen Galaxien prüft es Vorstellungen davon, was im ersten Moment nach dem Urknall geschah.</li>
      <li><b>Die Geschichte der Galaxien.</b> Es misst das gemeinsame Leuchten aller Galaxien, auch jener, die zu schwach sind, um einzeln gesehen zu werden.</li>
      <li><b>Wasser und die Zutaten des Lebens.</b> Es erfasst gefrorenes Wasser, Kohlendioxid und andere Eise in den Wolken, in denen Sterne und Planeten entstehen.</li>
    </ul>
    <h2>Und was es nebenbei tut</h2>
    <p>Weil SPHEREx immer wieder zu jeder Stelle des Himmels zurückkehrt, zeichnet es auch alles auf, was sich <b>bewegt oder verändert</b>: Asteroiden, Kometen, vorbeiziehende nahe Sterne, Braune Zwerge, Sterne, die pulsieren oder aufflackern. Es fotografiert Hunderte Millionen Sterne und Galaxien, weit mehr, als ein einzelnes Team prüfen kann. Dieses Werkzeug gibt es, damit mehr Menschen hinsehen können.</p>
    <p class="fine">Quellen: <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">Missionsseite von NASA/JPL</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx im Archiv von NASA/IPAC</a></p>`,

    how: () => `
    <p class="eyebrow">Unter der Haube</p>
    <h1>So funktioniert es</h1>
    <p class="lead">Sie klicken auf einen Punkt am Himmel. Wenige Sekunden später sehen Sie jedes Bild, das SPHEREx von ihm aufgenommen hat, ausgerichtet und mit einem Spektrum darunter. Das geschieht dazwischen.</p>
    <ol>
      <li><b>Im Himmelsindex nachschlagen.</b> Ein kompakter Index aller öffentlichen SPHEREx-Aufnahmen, rund 1,6 Millionen, sagt, welche davon in die Nähe Ihrer Stelle gerichtet waren. Der Index wird regelmäßig aus dem Archiv der NASA neu aufgebaut, sodass neue Datenveröffentlichungen erscheinen, ohne dass jemand den Code anfasst.</li>
      <li><b>Nur die Pixel lesen, auf die es ankommt.</b> Eine vollständige Aufnahme ist eine Datei von mehr als 60 Megabyte. Ihr Browser liest ihren Kopf und nur den kleinen Pixelblock um Ihre Stelle, einige Hundert Kilobyte, direkt aus den offenen Daten der NASA in der Cloud.</li>
      <li><b>Die Bilder ausrichten.</b> Jede Aufnahme entstand unter einem anderen Winkel. Jeder Block wird mithilfe der in der Datei gespeicherten Positionsangaben auf ein gemeinsames Raster neu gezeichnet, Norden oben, und das Leuchten des Himmelshintergrunds wird abgezogen.</li>
      <li><b>Die Farbe jedes Pixels bestimmen.</b> Jede Aufnahme zeichnet Ihre Stelle bei einer anderen Wellenlänge auf. Diese Wellenlänge wird aus einer Tabelle in jeder Datei gelesen.</li>
      <li><b>Auf Ihrem Gerät rechnen.</b> Helligkeit, Aufsummieren, Abziehen, Farbbilder, Messungen und Diagramme werden in Ihrem Browser berechnet; deshalb reagiert jedes Bedienelement sofort.</li>
      <li><b>Sagen, was es ist.</b> Der SIMBAD-Katalog wird gefragt, was an dieser Position liegt. Kataloge speichern, wo ein Stern im Jahr 2000 stand; nahe Sterne, die seitdem weitergewandert sind, werden deshalb vor dem Abgleich auf das heutige Datum gebracht.</li>
    </ol>
    <h2>Kein Server, und es funktioniert offline</h2>
    <p>Chronosphere hat keinen eigenen Server. Die Seite ist ein Satz statischer Dateien; alles andere ist Ihr Browser, der direkt mit den offenen Daten der NASA spricht. Auf unserer Seite gibt es also nichts, was laufen muss, und nichts, was ausfallen kann. Was Sie einmal geöffnet haben, einschließlich der gesamten Führung, wird auf Ihrem Gerät gespeichert und funktioniert auch ohne Verbindung weiter.</p>
    <h2>Wie man liest, was man sieht</h2>
    <ul>
      <li><b>Besuche.</b> SPHEREx kehrt zu den meisten Teilen des Himmels etwa alle sechs Monate zurück, und jeder Besuch dauert einige Tage bis einige Wochen. Ein aufsummiertes Bild pro Besuch, nacheinander gezeigt, macht eine kleine Verschiebung leicht sichtbar. Nahe den Polen der Ebene des Sonnensystems schaut es fast bei jedem Umlauf hin; dort werden die Bilder deshalb nach Monaten gruppiert.</li>
      <li><b>Die Verschiebungstabelle.</b> Bei einem bewegten Objekt wird die in jedem Besuch gemessene Position mit der Vorhersage des Katalogs verglichen: seine gleichmäßige Bewegung über den Himmel und, bei den nächsten Sternen, das jährliche Schwanken durch die Bahn der Erde selbst. Die Bewegung wird in jedem Detektor, der das Objekt sieht, getrennt gemessen, und die Detektoren werden miteinander verglichen.</li>
      <li><b>Das Spektrum.</b> Jeder Punkt ist eine Aufnahme: ihre Wellenlänge und wie hell die eingekreiste Stelle war. Die Punkte sind nach Besuch gefärbt.</li>
      <li><b>Molekülbänder.</b> Schattierte Streifen zeigen, wo häufige Moleküle Licht absorbieren. Die Tabelle gibt an, wie tief die dort gemessene Senke ist.</li>
      <li><b>Mit den Nachbarn verglichen.</b> Unter der Helligkeitskurve wird die Änderung der eingekreisten Stelle zwischen den Besuchen gewöhnlichen Sternen in denselben Bildern gegenübergestellt. Blieben sie konstant und die Stelle nicht, ist die Änderung echt und keine Eigenheit der Kamera. Dasselbe geschieht für ihre Position.</li>
      <li><b>Jeder Stern, geprüft.</b> Unter den Bildern wird jeder klare Stern des Feldes auf Bewegung und auf Helligkeitsänderungen getestet, ohne irgendeinen Katalog zu benutzen. Die wenigen, die auffallen, werden aufgelistet und mit einer Raute markiert. Eine Markierung ist ein Grund hinzusehen, kein Befund.</li>
      <li><b>Durchziehende Körper.</b> Unter den Bildern wird jede Aufnahme nach Punkten durchsucht, die ein paar Minuten lang an einer Stelle stehen und dort an anderen Tagen fehlen: Asteroiden, Kometen, Zwergplaneten. SPHEREx hält an, macht bis zu vier Aufnahmen im Abstand von zwei Minuten, und zwei seiner sechs Detektoren blicken stets im selben Moment auf dieselbe Himmelsstelle. Ein echter Körper zeigt sich deshalb in mehreren unabhängigen Bildern zugleich, der Treffer eines kosmischen Strahls nur in einem. Jeden gefundenen Körper benennt SkyBoT, ein Dienst des Pariser Observatoriums, der weiß, wo jeder katalogisierte Körper in diesem Moment stand; man kann ihm von Halt zu Halt folgen, mit eigenem Spektrum.</li>
    </ul>
    <h2>Was es Ihnen nicht sagen kann</h2>
    <ul>
      <li>Ein SPHEREx-Pixel deckt 6,15 Bogensekunden ab. Selbst der Stern, dessen Ort am Himmel sich am schnellsten ändert, bewegt sich weniger als zwei Pixel pro Jahr; Bewegung ist deshalb ein kleiner Sprung zwischen den Besuchen, nie eine Spur.</li>
      <li>Die Messungen verwenden einen einfachen festen Kreis und sind zum Erkunden gedacht, nicht zur Veröffentlichung. Sehr helle Sterne übersteuern den Detektor; bei ihnen wird stattdessen das schwache äußere Leuchten des Sterns gemessen und jeder Detektor an seinen Nachbarn angeschlossen: Die Gesamtform des Spektrums stimmt, sein Niveau und die feinen Einzelheiten sind Näherungen.</li>
      <li>Eine Senke bei der Wellenlänge eines Moleküls ist ein Hinweis, kein Nachweis.</li>
      <li>Positionen wiederholen sich bei gewöhnlichen Sternen auf wenige Zehntel Bogensekunden, aber ein Stern nahe der Übersteuerung der Kamera kann in einem einzelnen Besuch um eine Bogensekunde oder mehr abweichen.</li>
      <li>Die Suche nach durchziehenden Körpern reicht bis etwa zur 18. Magnitude. In acht Testfeldern entlang der Ebene des Sonnensystems meldete sie zwanzig Körper der Magnituden 14 bis 18,8, und SkyBoT kannte jeden davon; in acht Feldern fern dieser Ebene oder rund um Sterne meldete sie keinen. Ein Punkt, den kein Katalog kennt, kann trotzdem ein Bildfehler sein: Er ist ein Grund, noch einmal hinzusehen.</li>
      <li>Nichts hier erhebt den Anspruch einer Entdeckung. Etwas, das neu aussieht, ist ein Grund, es in den anderen Werkzeugen zu prüfen, die bei jedem Objekt verlinkt sind.</li>
    </ul>`,

    hunt: () => `
    <p class="eyebrow">Asteroidenjagd</p>
    <h1>Einen Asteroiden auf SPHEREx-Aufnahmen finden</h1>
    <p class="lead">Asteroiden, Kometen und Zwergplaneten ziehen ständig durch die Aufnahmen von SPHEREx: Punkte, die ein paar Minuten an einer Stelle stehen und am nächsten Tag fort sind. Hier steht, wie man einen findet, was man dann in der Hand hat und wo ein Fund gemeldet wird.</p>
    <p class="docgo"><a class="cta" href="./?hunt" data-do="hunt">Jagd beginnen</a></p>
    <h2>Drei Wege, einen zu finden</h2>
    <ul>
      <li><b>Das Werkzeug ein Feld wählen lassen.</b> „Einen Asteroiden finden“ nimmt zufällig einen der ersten dreitausend nummerierten Asteroiden und öffnet eine Himmelsgegend, die er durchquert hat, während SPHEREx hinsah. Der Suche wird weder gesagt, welcher Asteroid es ist, noch wo er war. Sie liest jede Aufnahme dieser Gegend, etwa dreihundert, und meldet, was durchgezogen ist. Das dauert zwei bis vier Minuten.</li>
      <li><b>Nach dem Namen fragen.</b> Tippen Sie einen Namen oder eine Nummer in das Suchfeld: Ceres, 433 Eros, Pluto, Uranus, 2P/Encke. Das Werkzeug schlägt die Bahn nach, findet die Tage, an denen SPHEREx den Körper im Blick hatte, und öffnet diese Himmelsgegend, mit dem Ring schon auf ihm.</li>
      <li><b>Irgendwo hinsehen.</b> Welche Stelle Sie auch öffnen: Ihre Aufnahmen werden nach durchziehenden Körpern durchsucht, und was gefunden wurde, steht unter den Bildern. Die meisten Körper ziehen nahe der Ekliptik, dem Band am Himmel, auf dem auch die Planeten wandern.</li>
    </ul>
    <h2>Woran ein Körper von einem Bildfehler zu unterscheiden ist</h2>
    <p>SPHEREx hält an, macht bis zu vier Aufnahmen im Abstand von zwei Minuten, und zwei seiner sechs Detektoren sehen immer im selben Moment auf dieselbe Stelle des Himmels. Ein Körper ist deshalb auf mehreren unabhängigen Bildern an einer Stelle und von dort verschwunden, wenn das Teleskop Stunden später zurückkehrt. Ein Stern ist jedes Mal da. Der Treffer eines kosmischen Strahls ist nur auf einem Bild.</p>
    <p>Die Suche wurde an Feldern erprobt, deren Antwort bekannt ist. In acht Feldern entlang der Ekliptik meldete sie zwanzig Körper, und jeder davon war ein katalogisierter Körper an der richtigen Stelle. In acht weiteren Feldern, abseits der Ekliptik oder rund um Sterne, meldete sie keinen. Sie reicht bis etwa zur 18. Magnitude.</p>
    <h2>Was man bekommt</h2>
    <ul>
      <li><b>Einen Namen.</b> Jeder gefundene Körper wird bei SkyBoT nachgeschlagen, einem Dienst des Pariser Observatoriums, der weiß, wo jeder katalogisierte Körper in diesem Moment war.</li>
      <li><b>Seine Bewegung.</b> Drücken Sie auf einen Körper, um ihm zu folgen: ein Bild für jeden Halt des Teleskops, der Ring wandert mit, dazu wie weit und wie schnell er gezogen ist.</li>
      <li><b>Sein Spektrum.</b> Jede Aufnahme hat ihn in einer anderen Infrarotfarbe erfasst, von 0,75 bis 5 Mikrometer. Durchmusterungen der Asteroidenfarben vom Boden aus enden bei etwa 2,5 Mikrometer; SPHEREx reicht weiter, dorthin, wo wasserhaltige Minerale und Eise ihre Spuren hinterlassen. Plutos Spektrum zeigt Methaneis.</li>
      <li><b>Dateien zum Aufbewahren.</b> Seine Helligkeit bei jeder Wellenlänge als Tabelle (CSV) und seine gemessenen Positionen im Format des Minor Planet Center (ADES), jeweils mit dem Ort des Satelliten bei der Aufnahme.</li>
    </ul>
    <h2>Ist er neu?</h2>
    <p>Mit ziemlicher Sicherheit nicht, und das weiß man besser vor der Jagd als danach. Eine einzelne SPHEREx-Aufnahme reicht bis zu Asteroiden von etwa 18. Magnitude. Die Durchmusterungen, die jede Nacht nach neuen Asteroiden suchen, haben den Hauptgürtel bis zu vielfach schwächeren Körpern katalogisiert; was SPHEREx sehen kann, wurde also längst gefunden. In unseren Tests war jeder Körper, den die Suche meldete, ein bekannter.</p>
    <p>Ein Punkt, den SkyBoT nicht benennen kann, ist meist ein Bildfehler. Bevor man ihm glaubt:</p>
    <ol>
      <li><b>Ihm folgen.</b> Ein echter Körper wird bei drei oder mehr Halten gefunden, auf einer geraden Linie, mit gleichbleibendem Tempo.</li>
      <li><b>Ihn ansehen.</b> Unter „Aufnahmen“ sollte er aussehen wie die Sterne um ihn herum und auf jedem Bild eines Halts zu sehen sein.</li>
      <li><b>Das Minor Planet Center fragen.</b> Im Kasten eines namenlosen Punktes führt ein Link zum MPChecker des Zentrums, Ort und Zeitpunkt sind schon eingetragen. Er listet jeden bekannten Körper in der Nähe auf, auch die der letzten Woche.</li>
    </ol>
    <h2>Wo ein Fund gemeldet wird</h2>
    <p>Neue Asteroiden und Kometen werden dem Minor Planet Center (MPC) gemeldet. Es nimmt die Positionen entgegen, die Sternwarten in aller Welt messen, und berechnet die Bahnen, unter dem Dach der Internationalen Astronomischen Union. Was dazu nötig ist:</p>
    <ul>
      <li><b>Positionen in seinem Format.</b> Mindestens zwei Positionen des Körpers aus einer Nacht, im Format ADES. „Positionen (ADES)“ schreibt diese Datei: die Zeiten, die Positionen, wie genau sie bekannt sind, und für jede Aufnahme den Ort von SPHEREx, denn ein Teleskop in der Umlaufbahn sieht einen nahen Körper aus einem etwas anderen Winkel als der Erdmittelpunkt. SPHEREx ist in der Liste des MPC die Sternwarte 288.</li>
      <li><b>Zuerst mit dem MPC sprechen.</b> SPHEREx-Aufnahmen sind Archivdaten vom Teleskop anderer. Für solche Daten bittet das MPC darum, über seinen Helpdesk angeschrieben zu werden, bevor etwas eingereicht wird. Die Datei ist das, was man anhängt.</li>
      <li><b>Geduld.</b> Ein Körper, der nur in einer Nacht gesehen wurde, wartet in einer Datei unbestätigter Spuren, bis weitere Beobachtungen mit ihm verknüpft werden. Mit einer Bahn erhält er eine vorläufige Bezeichnung. Eine Nummer folgt, sobald die Bahn gesichert ist, bei einem Hauptgürtel-Asteroiden nach etwa vier Wiederkehren. Dann wird auch entschieden, wem die Entdeckung zugeschrieben wird, und erst dann darf der Entdecker einen Namen vorschlagen, über den eine Arbeitsgruppe der Internationalen Astronomischen Union entscheidet.</li>
    </ul>
    <p>Wer einen neuen Asteroiden entdecken möchte: Die International Astronomical Search Collaboration (IASC) der NASA gibt Freiwilligen frische Aufnahmen des Pan-STARRS-Teleskops zum Durchsuchen und meldet ihre Funde dem MPC.</p>
    <h2>Was SPHEREx beiträgt</h2>
    <p>Neu ist auf diesen Aufnahmen nicht der Asteroid, sondern sein Licht. SPHEREx soll mehr als hunderttausend Asteroiden und Kometen in 102 Infrarotfarben erfassen, und eine Kollaboration rund um die Mission bereitet einen Katalog ihrer Spektren vor. Mit diesem Werkzeug können Sie jeden von ihnen schon heute ansehen, Halt für Halt.</p>
    <p class="fine">Quellen: <a href="https://www.minorplanetcenter.net/about" target="_blank" rel="noopener">Minor Planet Center</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/" target="_blank" rel="noopener">MPC: Leitfaden zum Melden von Positionen</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/data-and-services/sarc/" target="_blank" rel="noopener">MPC: Archivbeobachtungen</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/discoveries-and-credit/" target="_blank" rel="noopener">MPC: Entdeckungen, Zuschreibung und Namen</a> · <a href="https://minorplanetcenter.net/cgi-bin/checkmp.cgi" target="_blank" rel="noopener">MPChecker</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT</a>, <a href="https://ssp.imcce.fr/webservices/miriade/" target="_blank" rel="noopener">Miriade</a> (IMCCE, Pariser Observatorium) · <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf" target="_blank" rel="noopener">SPHEREx Explanatory Supplement</a> · <a href="https://meetingorganizer.copernicus.org/EPSC2026/EPSC2026-797.html" target="_blank" rel="noopener">Mahlke et al. 2026</a> · <a href="https://arxiv.org/abs/2010.07822" target="_blank" rel="noopener">Hendler &amp; Malhotra 2020</a> · <a href="https://science.nasa.gov/get-involved/citizen-science/new-way-you-can-discover-asteroids/" target="_blank" rel="noopener">NASA: IASC</a></p>`,

    about: () => `
    <p class="eyebrow">Über uns</p>
    <h1>An einem Wochenende gemacht, damit mehr Menschen hinsehen können</h1>
    <p class="lead">Chronosphere entstand am 14. und 15. November 2026 bei der NASA Space Apps Challenge, für die Aufgabe <i>Planet X and SPHEREx</i>, gebaut vom Team ${TEAM.name}.</p>
    ${team('Das Team')}
    <h2>Warum wir es gebaut haben</h2>
    <p>Pluto wurde 1930 von einem Menschen gefunden, der zwei Fotografien verglich. Noch heute werden neue Welten auf diese Weise gefunden. Freiwillige haben die meisten der mehr als 5000 Kometen entdeckt, die in Bildern der Raumsonde SOHO gefunden wurden, und rund 3000 Kandidaten für Braune Zwerge in Bildern des NASA-Teleskops WISE. SPHEREx fotografiert nun Hunderte Millionen Objekte, immer wieder: mehr, als irgendeine Gruppe von Fachleuten durchsehen kann.</p>
    <p>Wir wollten ein Werkzeug, mit dem jeder ohne Vorkenntnisse einen Punkt am Himmel wählen und selbst sehen kann, ob sich dort etwas bewegt oder verändert hat, und es dann mit einem Klick an unabhängigen Quellen prüfen kann.</p>
    <p>Die Aufgabe hat ihren Namen von Planet X, dem hypothetischen, noch unentdeckten Planeten im äußeren Sonnensystem. Ob SPHEREx ihn sehen kann oder nicht: Jedes unbekannte nahe Objekt würde sich so verraten wie einst Pluto, als ein Punkt, der sich bewegt.</p>
    <h2>Für wen es gedacht ist</h2>
    <ul>
      <li><b>Alle, die neugierig sind.</b> Ohne Konto und ohne Vorkenntnisse: Die Tour dauert zwei Minuten, und jedes Objekt öffnet sich mit ein paar einfachen Sätzen darüber, was die Messungen zeigen.</li>
      <li><b>Lehrkräfte und Lernende.</b> Eine Klasse kann einen wandernden Stern so finden, wie Pluto gefunden wurde, auf echten NASA-Bildern. Die Tour wird auf dem Gerät gespeichert und läuft ohne Verbindung, in sechs Sprachen.</li>
      <li><b>Amateurastronomen und Forschende.</b> Die Messungen jeder Stelle lassen sich als Tabelle (CSV) herunterladen, jede Aufnahme führt zu ihrer Originaldatei im NASA-Archiv, und jede Ansicht lässt sich als Link teilen oder in eine andere Seite einbetten.</li>
    </ul>
    <h2>Woher die Daten kommen</h2>
    <ul>
      <li><b>SPHEREx-Bilder und Karte des ganzen Himmels:</b> NASA/JPL-Caltech, bereitgestellt vom NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Andere Himmelskarten:</b> 2MASS, WISE und DSS, als HiPS vom CDS erstellt und von IRSA bereitgestellt.</li>
      <li><b>Ältere Bilder desselben Himmels (die Ansicht Jahre):</b> Atlasbilder von 2MASS (1997 bis 2001) sowie Einzelaufnahmen von WISE und NEOWISE (2010 bis 2024), bereitgestellt von IRSA.</li>
      <li><b>Kataloge:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Straßburg).</li>
      <li><b>Himmelsatlas-Komponente:</b> Aladin Lite (CDS).</li>
      <li><b>Lexikonkarten:</b> Wikipedia, mit einem Link zum Artikel gezeigt.</li>
    </ul>
    <h2>Offener Quellcode</h2>
    <p>Der Code ist öffentlich: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. Es gibt keinen Build-Schritt und keinen Server: Die Seite kann überall liegen, wo Dateien ausgeliefert werden.</p>
    <h2>Einsatz von KI</h2>
    <p>Die Software wurde während der Veranstaltung mit einem KI-Programmierassistenten geschrieben. Das Team hat den Ansatz gewählt, die Ergebnisse an Katalogwerten und unabhängigen Werkzeugen geprüft und ist für den Inhalt verantwortlich. Es werden keine KI-erzeugten Bilder, Töne oder Videos verwendet: Jedes gezeigte Bild sind Teleskopdaten.</p>
    <p class="fine">Quellen für die Zahlen oben: <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">NASA zum 5000. Kometen von SOHO</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};
