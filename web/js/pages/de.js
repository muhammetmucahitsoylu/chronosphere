// The three information pages in German. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { spherex: 'Was ist SPHEREx?', how: 'So funktioniert es', about: 'Über uns' },
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
    </ul>
    <h2>Was es Ihnen nicht sagen kann</h2>
    <ul>
      <li>Ein SPHEREx-Pixel deckt 6,15 Bogensekunden ab. Selbst der schnellste Stern am Himmel bewegt sich weniger als zwei Pixel pro Jahr; Bewegung ist deshalb ein kleiner Sprung zwischen den Besuchen, nie eine Spur.</li>
      <li>Die Messungen verwenden einen einfachen festen Kreis und sind zum Erkunden gedacht, nicht zur Veröffentlichung. Sehr helle Sterne übersteuern den Detektor; bei ihnen wird stattdessen das schwache äußere Leuchten des Sterns gemessen und jeder Detektor an seinen Nachbarn angeschlossen: Die Gesamtform des Spektrums stimmt, sein Niveau und die feinen Einzelheiten sind Näherungen.</li>
      <li>Eine Senke bei der Wellenlänge eines Moleküls ist ein Hinweis, kein Nachweis.</li>
      <li>Positionen wiederholen sich bei gewöhnlichen Sternen auf wenige Zehntel Bogensekunden, aber ein Stern nahe der Übersteuerung der Kamera kann in einem einzelnen Besuch um eine Bogensekunde oder mehr abweichen.</li>
      <li>Nichts hier erhebt den Anspruch einer Entdeckung. Etwas, das neu aussieht, ist ein Grund, es in den anderen Werkzeugen zu prüfen, die bei jedem Objekt verlinkt sind.</li>
    </ul>`,

    about: () => `
    <p class="eyebrow">Über uns</p>
    <h1>An einem Wochenende gemacht, damit mehr Menschen hinsehen können</h1>
    <p class="lead">Chronosphere entstand am 14. und 15. November 2026 bei der NASA Space Apps Challenge, für die Aufgabe <i>Planet X and SPHEREx</i>, gebaut vom Team ${TEAM.name}.</p>
    ${team('Das Team')}
    <h2>Warum wir es gebaut haben</h2>
    <p>Pluto wurde 1930 von einem Menschen gefunden, der zwei Fotografien verglich. Noch heute werden neue Welten auf diese Weise gefunden. Freiwillige haben die meisten der mehr als 5000 Kometen entdeckt, die in Bildern der Raumsonde SOHO gefunden wurden, und rund 3000 Kandidaten für Braune Zwerge in Bildern des NASA-Teleskops WISE. SPHEREx fotografiert nun Hunderte Millionen Objekte, immer wieder: mehr, als irgendeine Gruppe von Fachleuten durchsehen kann.</p>
    <p>Wir wollten ein Werkzeug, mit dem jeder ohne Vorkenntnisse einen Punkt am Himmel wählen und selbst sehen kann, ob sich dort etwas bewegt oder verändert hat, und es dann mit einem Klick an unabhängigen Quellen prüfen kann.</p>
    <p>Die Aufgabe hat ihren Namen von Planet X, dem hypothetischen, noch unentdeckten Planeten im äußeren Sonnensystem. Ob SPHEREx ihn sehen kann oder nicht: Jedes unbekannte nahe Objekt würde sich so verraten wie einst Pluto, als ein Punkt, der sich bewegt.</p>
    <h2>Woher die Daten kommen</h2>
    <ul>
      <li><b>SPHEREx-Bilder und Karte des ganzen Himmels:</b> NASA/JPL-Caltech, bereitgestellt vom NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Andere Himmelskarten:</b> 2MASS, WISE und DSS, als HiPS vom CDS erstellt und von IRSA bereitgestellt.</li>
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
