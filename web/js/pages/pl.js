// The four information pages in Polish. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { hunt: 'Polowanie na planetoidy', spherex: 'Czym jest SPHEREx?', how: 'Jak to działa', about: 'O projekcie' },
  figure: {
    label: 'Filtr, którego kolor zmienia się od jednej krawędzi do drugiej; ta sama gwiazda trafia w każdej ekspozycji na inny kolor',
    exposure: 'ekspozycja',
    caption: 'Teleskop przesuwa się krok po kroku po niebie, więc ta sama gwiazda w każdej ekspozycji trafia na nowy kolor filtra.',
  },
  sheets: ({ TEAM, figure, team }) => ({
    spherex: () => `
    <p class="eyebrow">Misja</p>
    <h1>Czym jest SPHEREx?</h1>
    <p class="lead">SPHEREx to kosmiczny teleskop NASA, który fotografuje całe niebo w 102 kolorach światła podczerwonego. A potem robi to ponownie, co sześć miesięcy.</p>
    <div class="statgrid">
      <div><b>102</b><span>kolory, od 0,75 do 5 mikronów</span></div>
      <div><b>6 miesięcy</b><span>na jedną mapę całego nieba</span></div>
      <div><b>2025</b><span>start 11 marca</span></div>
      <div><b>6,15″</b><span>fragment nieba przypadający na jeden piksel</span></div>
    </div>
    <h2>Dlaczego podczerwień?</h2>
    <p>Podczerwień to światło o fali dłuższej niż ta, którą widzą nasze oczy. Świecą w niej chłodne obiekty: brązowe karły, obłoki pyłu, gwiazdy olbrzymy u schyłku życia. Światło bardzo odległych galaktyk dociera do nas rozciągnięte aż do podczerwieni. A cząsteczki takie jak woda, dwutlenek węgla i metan pochłaniają światło podczerwone, każda na własnych długościach fali, więc podczerwone kolory obiektu zdradzają, z czego jest zbudowany.</p>
    <h2>102 kolory bez koła filtrów</h2>
    <p>Większość kamer rejestruje jeden kolor naraz. SPHEREx patrzy przez filtry, których kolor zmienia się płynnie od jednej krawędzi do drugiej. Gdy teleskop przesuwa się po niebie, każda gwiazda w każdej ekspozycji trafia na inną część filtra i zostaje zapisana w innym kolorze.</p>
    ${figure}
    <p>Wystarczy zebrać dość ekspozycji jednej gwiazdy, by mieć całe jej widmo. Dlatego w Chronosphere przechodzenie przez czas i budowanie widma to ta sama czynność.</p>
    <h2>Do czego go zbudowano</h2>
    <ul>
      <li><b>Pierwsza chwila Wszechświata.</b> Tworząc trójwymiarową mapę ponad 450 milionów galaktyk, sprawdza hipotezy o tym, co wydarzyło się w pierwszym momencie po Wielkim Wybuchu.</li>
      <li><b>Historia galaktyk.</b> Mierzy łączną poświatę wszystkich galaktyk, także tych zbyt słabych, by zobaczyć je pojedynczo.</li>
      <li><b>Woda i składniki życia.</b> Bada zamarzniętą wodę, dwutlenek węgla i inne lody w obłokach, w których powstają gwiazdy i planety.</li>
    </ul>
    <h2>I co robi przy okazji</h2>
    <p>Ponieważ SPHEREx wciąż wraca w każde miejsce nieba, zapisuje też wszystko, co się <b>porusza lub zmienia</b>: planetoidy, komety, przesuwające się bliskie gwiazdy, brązowe karły, gwiazdy pulsujące lub rozbłyskujące. Fotografuje setki milionów gwiazd i galaktyk, znacznie więcej, niż jeden zespół zdoła sprawdzić. To narzędzie istnieje po to, by mogło patrzeć więcej osób.</p>
    <p class="fine">Źródła: <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">strona misji NASA/JPL</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">SPHEREx w archiwum NASA/IPAC</a></p>`,

    how: () => `
    <p class="eyebrow">Pod maską</p>
    <h1>Jak to działa</h1>
    <p class="lead">Klikasz punkt na niebie. Kilka sekund później oglądasz wszystkie zdjęcia, jakie zrobił mu SPHEREx, wyrównane, z widmem pod spodem. Oto co dzieje się pomiędzy.</p>
    <ol>
      <li><b>Wyszukanie w indeksie nieba.</b> Zwarty indeks wszystkich publicznych ekspozycji SPHEREx, około 1,6 miliona, podaje, które z nich były skierowane w pobliże twojego punktu. Indeks jest okresowo odbudowywany z archiwum NASA, więc nowe wydania danych pojawiają się bez dotykania kodu.</li>
      <li><b>Odczyt tylko potrzebnych pikseli.</b> Pełna ekspozycja to plik większy niż 60 megabajtów. Przeglądarka odczytuje jego nagłówek i tylko mały blok pikseli wokół twojego punktu, kilkaset kilobajtów, prosto z otwartych danych NASA w chmurze.</li>
      <li><b>Wyrównanie obrazów.</b> Każdą ekspozycję wykonano pod innym kątem. Każdy blok jest przerysowywany na wspólną siatkę, północą do góry, na podstawie informacji o położeniu zapisanych w pliku, a poświata tła nieba jest odejmowana.</li>
      <li><b>Ustalenie koloru każdego piksela.</b> Każda ekspozycja zapisuje twój punkt na innej długości fali. Tę długość fali odczytuje się z tabeli zawartej w każdym pliku.</li>
      <li><b>Obliczenia na twoim urządzeniu.</b> Jasność, sumowanie, odejmowanie, obrazy barwne, pomiary i wykresy są liczone w przeglądarce, dlatego każdy przycisk reaguje natychmiast.</li>
      <li><b>Powiedzenie, co to jest.</b> Katalog SIMBAD jest pytany, co leży w tym położeniu. Katalogi przechowują miejsce, w którym gwiazda była w roku 2000, więc bliskie gwiazdy, które od tamtej pory się przesunęły, są przed dopasowaniem przenoszone na dzisiejszą datę.</li>
    </ol>
    <h2>Bez serwera, działa też offline</h2>
    <p>Chronosphere nie ma własnego serwera. Strona to zestaw statycznych plików; cała reszta to twoja przeglądarka rozmawiająca bezpośrednio z otwartymi danymi NASA. Po naszej stronie nie ma więc niczego, co trzeba utrzymywać w ruchu, ani niczego, co mogłoby przestać działać. Wszystko, co raz otworzysz, łącznie z całą wycieczką, zapisuje się na twoim urządzeniu i działa dalej bez połączenia.</p>
    <h2>Jak czytać to, co widzisz</h2>
    <ul>
      <li><b>Wizyty.</b> SPHEREx wraca do większości obszarów nieba mniej więcej co sześć miesięcy, a każda wizyta trwa od kilku dni do kilku tygodni. Jeden zsumowany obraz na wizytę, pokazywane po kolei, sprawiają, że małe przesunięcie łatwo dostrzec. W pobliżu biegunów płaszczyzny Układu Słonecznego patrzy niemal przy każdym okrążeniu, więc tam obrazy są grupowane według miesięcy.</li>
      <li><b>Tabela przesunięć.</b> Dla obiektu w ruchu położenie zmierzone w każdej wizycie porównuje się z tym, co przewiduje katalog: jego jednostajnym ruchem po niebie oraz, dla najbliższych gwiazd, rocznym wahaniem wywołanym przez orbitę samej Ziemi. Ruch jest mierzony osobno w każdym detektorze, który widzi obiekt, a detektory są ze sobą porównywane.</li>
      <li><b>Widmo.</b> Każdy punkt to jedna ekspozycja: jej długość fali i jasność zakreślonego miejsca. Punkty są pokolorowane według wizyty.</li>
      <li><b>Pasma cząsteczek.</b> Zacieniowane paski pokazują, gdzie pospolite cząsteczki pochłaniają światło. Tabela podaje, jak głęboki spadek tam zmierzono.</li>
      <li><b>Porównanie z sąsiadami.</b> Pod krzywą jasności zmiana zakreślonego miejsca między wizytami jest zestawiana ze zwykłymi gwiazdami na tych samych obrazach. Jeśli one pozostały stałe, a miejsce nie, zmiana jest prawdziwa, a nie jest kaprysem kamery. To samo robi się dla jego położenia.</li>
      <li><b>Każda gwiazda sprawdzona.</b> Pod obrazami każda wyraźna gwiazda w polu jest badana pod kątem ruchu i zmian jasności, bez użycia jakiegokolwiek katalogu. Te nieliczne, które się wyróżniają, są wypisane i oznaczone rombem. Oznaczenie to powód, by spojrzeć, a nie wynik.</li>
      <li><b>Ciała przechodzące przez pole.</b> Pod obrazami każda ekspozycja jest przeszukiwana pod kątem punktów, które przez kilka minut są w jednym miejscu, a w inne dni ich tam nie ma: planetoid, komet, planet karłowatych. SPHEREx zatrzymuje się, wykonuje do czterech ekspozycji w odstępie dwóch minut, a dwa z jego sześciu detektorów zawsze patrzą w tej samej chwili na ten sam fragment nieba. Prawdziwe ciało widać więc naraz na kilku niezależnych obrazach; trafienie promienia kosmicznego tylko na jednym. Każde znalezione ciało nazywa SkyBoT, serwis Obserwatorium Paryskiego, który wie, gdzie w danej chwili było każde skatalogowane ciało; można je śledzić od postoju do postoju, z jego własnym widmem.</li>
      <li><b>Lata.</b> SPHEREx obserwuje niebo dopiero od półtora roku: za krótko, by większość gwiazd się przesunęła. Widok Lata dodaje starsze teleskopy: 2MASS, który sfotografował każde miejsce jednej nocy między 1997 a 2001 rokiem, WISE w 2010 i, jako NEOWISE, co pół roku od 2014 do 2024. Dla pięciu obiektów testowych ich własne ekspozycje są nakładane na siatkę obrazów SPHEREx, dla każdego innego miejsca mapy nieba 2MASS i AllWISE. Gwiazda z katalogu jest odnajdywana na każdym obrazie, a jej ruch mierzony w całym okresie: Gwiazda Barnarda 10,42 sekundy kątowej na rok, w katalogu 10,39. Obiekt widoczny tylko w najdłuższych falach, jak WISE 0855, jest zimny: tak znajduje się takie światy.</li>
    </ul>
    <h2>Czego ci nie powie</h2>
    <ul>
      <li>Jeden piksel SPHEREx obejmuje 6,15 sekundy łuku. Nawet gwiazda, której położenie na niebie zmienia się najszybciej, przesuwa się o mniej niż dwa piksele rocznie, więc ruch to mały skok między wizytami, nigdy smuga.</li>
      <li>Pomiary używają prostego, stałego koła i służą do poznawania, a nie do publikacji. Bardzo jasne gwiazdy nasycają detektor; dla nich mierzy się zamiast tego słabą zewnętrzną poświatę gwiazdy, a każdy detektor dołącza się do sąsiedniego: ogólny kształt widma jest poprawny, jego poziom i drobne szczegóły są przybliżone.</li>
      <li>Spadek na długości fali cząsteczki to wskazówka, a nie wykrycie.</li>
      <li>Położenia zwykłych gwiazd powtarzają się z dokładnością do kilku dziesiątych sekundy łuku, ale gwiazda bliska nasycenia kamery może w pojedynczej wizycie odbiegać o sekundę łuku lub więcej.</li>
      <li>Wyszukiwanie przechodzących ciał sięga do około 18. wielkości gwiazdowej. W ośmiu polach testowych wzdłuż płaszczyzny Układu Słonecznego wskazało dwadzieścia ciał o jasności od 14 do 18,8 wielkości gwiazdowej i SkyBoT znał każde z nich; w ośmiu polach daleko od tej płaszczyzny albo wokół gwiazd nie wskazało żadnego. Punkt, którego nie zna żaden katalog, wciąż może być wadą obrazu: to powód, by spojrzeć jeszcze raz.</li>
      <li>Nic tutaj nie jest twierdzeniem o odkryciu. Coś, co wygląda na nowe, to powód, by sprawdzić to w innych narzędziach, do których prowadzą odnośniki przy każdym obiekcie.</li>
    </ul>`,

    hunt: () => `
    <p class="eyebrow">Polowanie na planetoidy</p>
    <h1>Znajdź planetoidę na zdjęciach SPHEREx</h1>
    <p class="lead">Planetoidy, komety i planety karłowate bez przerwy przechodzą przez zdjęcia SPHEREx: punkty, które przez kilka minut stoją w jednym miejscu, a następnego dnia już ich tam nie ma. Oto jak znaleźć jedną z nich, co się wtedy dostaje i gdzie zgłasza się znalezisko.</p>
    <p class="docgo"><a class="cta" href="./?hunt" data-do="hunt">Zacznij polowanie</a></p>
    <h2>Trzy sposoby, by ją znaleźć</h2>
    <ul>
      <li><b>Niech narzędzie wybierze pole.</b> „Znajdź planetoidę” losuje jedną z pierwszych trzech tysięcy ponumerowanych planetoid i otwiera fragment nieba, przez który przeszła, gdy patrzył tam SPHEREx. Wyszukiwanie nie wie ani która to planetoida, ani gdzie była. Odczytuje wszystkie ekspozycje tego fragmentu, około trzystu, i podaje, co przez niego przeszło. Trwa to od dwóch do czterech minut.</li>
      <li><b>Zapytaj o nią po nazwie.</b> Wpisz nazwę albo numer w pole wyszukiwania: Ceres, 433 Eros, Pluton, Uran, 2P/Encke. Narzędzie sprawdza orbitę, znajduje dni, w których SPHEREx miał to ciało w polu widzenia, i otwiera ten fragment nieba z pierścieniem już na nim.</li>
      <li><b>Zajrzyj gdziekolwiek.</b> Którekolwiek miejsce otworzysz, jego ekspozycje są przeszukiwane pod kątem przechodzących ciał, a to, co znaleziono, jest wymienione pod obrazami. Większość ciał wędruje w pobliżu ekliptyki, czyli pasa nieba, po którym poruszają się planety.</li>
    </ul>
    <h2>Jak odróżnić ciało od wady obrazu</h2>
    <p>SPHEREx zatrzymuje się, wykonuje do czterech ekspozycji w odstępach dwóch minut, a dwa z jego sześciu detektorów zawsze patrzą w tej samej chwili na ten sam fragment nieba. Ciało jest więc na kilku niezależnych obrazach w jednym miejscu, a gdy teleskop wraca po kilku godzinach, już go tam nie ma. Gwiazda jest tam za każdym razem. Ślad promienia kosmicznego jest tylko na jednym obrazie.</p>
    <p>Wyszukiwanie wypróbowano na polach, dla których odpowiedź jest znana. W ośmiu polach wzdłuż ekliptyki zgłosiło dwadzieścia ciał i każde z nich było skatalogowanym ciałem we właściwym miejscu. W ośmiu innych polach, z dala od ekliptyki albo wokół gwiazd, nie zgłosiło żadnego. Sięga mniej więcej 18. wielkości gwiazdowej.</p>
    <h2>Co dostajesz</h2>
    <ul>
      <li><b>Nazwę.</b> Każde znalezione ciało jest sprawdzane w SkyBoT, serwisie Obserwatorium Paryskiego, który wie, gdzie w tamtej chwili było każde skatalogowane ciało.</li>
      <li><b>Jego ruch.</b> Naciśnij ciało, aby je śledzić: jeden obraz na każdy postój teleskopu, pierścień przesuwający się razem z nim oraz to, jak daleko i jak szybko się przemieściło.</li>
      <li><b>Jego widmo.</b> Każda ekspozycja uchwyciła je w innej barwie podczerwieni, od 0,75 do 5 mikrometrów. Naziemne przeglądy barw planetoid kończą się w pobliżu 2,5 mikrometra; SPHEREx sięga dalej, tam gdzie swój ślad zostawiają uwodnione minerały i lody. Widmo Plutona pokazuje lód metanowy.</li>
      <li><b>Pliki do zachowania.</b> Jego jasność na każdej długości fali w postaci tabeli (CSV) oraz zmierzone pozycje w formacie Minor Planet Center (ADES), razem z położeniem satelity przy każdej ekspozycji.</li>
    </ul>
    <h2>Czy jest nowe?</h2>
    <p>Prawie na pewno nie i lepiej wiedzieć to przed polowaniem niż po nim. Pojedyncza ekspozycja SPHEREx sięga planetoid o wielkości gwiazdowej około 18. Przeglądy, które co noc szukają nowych planetoid, skatalogowały pas główny aż do ciał wielokrotnie słabszych, więc te, które widzi SPHEREx, znaleziono dawno temu. W naszych testach każde ciało zgłoszone przez wyszukiwanie było już znane.</p>
    <p>Punkt, którego SkyBoT nie potrafi nazwać, to najczęściej wada obrazu. Zanim w niego uwierzysz:</p>
    <ol>
      <li><b>Śledź go.</b> Prawdziwe ciało jest znajdowane na trzech postojach lub więcej, na linii prostej, w stałym tempie.</li>
      <li><b>Obejrzyj go.</b> W trybie „Ekspozycje” powinien wyglądać jak gwiazdy wokół i być na każdym obrazie z postoju.</li>
      <li><b>Zapytaj Minor Planet Center.</b> Ramka bezimiennego punktu zawiera odnośnik do narzędzia MPChecker tego centrum, z wypełnionym miejscem i chwilą. Wymienia ono każde znane ciało w pobliżu, także te znalezione w zeszłym tygodniu.</li>
    </ol>
    <h2>Gdzie zgłasza się znalezisko</h2>
    <p>Nowe planetoidy i komety zgłasza się do Centrum Małych Planet (Minor Planet Center, MPC). Przyjmuje ono pozycje mierzone przez obserwatoria na całym świecie i wyznacza orbity, pod auspicjami Międzynarodowej Unii Astronomicznej. Czego potrzeba:</p>
    <ul>
      <li><b>Pozycji w jego formacie.</b> Co najmniej dwóch pozycji ciała z jednej nocy, w formacie o nazwie ADES. „Pozycje (ADES)” zapisuje taki plik: czasy, pozycje, ich dokładność oraz, dla każdej ekspozycji, położenie SPHEREx, bo teleskop na orbicie widzi bliskie ciało pod nieco innym kątem niż środek Ziemi. Na liście MPC SPHEREx jest obserwatorium numer 288.</li>
      <li><b>Najpierw kontaktu z MPC.</b> Zdjęcia SPHEREx to dane archiwalne z cudzego teleskopu. W przypadku takich danych MPC prosi o kontakt przez swój dział pomocy, zanim cokolwiek zostanie wysłane. Plik jest tym, co należy załączyć.</li>
      <li><b>Cierpliwości.</b> Ciało widziane tylko jednej nocy czeka w pliku niepotwierdzonych śladów, dopóki nie zostaną z nim powiązane inne obserwacje. Gdy znana jest orbita, dostaje oznaczenie tymczasowe. Numer otrzymuje, gdy orbita jest pewna, w przypadku planetoidy pasa głównego po około czterech powrotach. Wtedy rozstrzyga się, komu przypada odkrycie, i dopiero wtedy odkrywca może zaproponować nazwę, o której decyduje grupa robocza Międzynarodowej Unii Astronomicznej.</li>
    </ul>
    <p>Jeśli zależy ci na odkryciu nowej planetoidy: International Astronomical Search Collaboration (IASC), program NASA, daje ochotnikom do przejrzenia świeże zdjęcia z teleskopu Pan-STARRS i zgłasza ich znaleziska do MPC.</p>
    <h2>Co wnosi SPHEREx</h2>
    <p>Nowa na tych zdjęciach jest nie planetoida, lecz jej światło. SPHEREx ma zarejestrować ponad sto tysięcy planetoid i komet w 102 barwach podczerwieni, a współpracujący z misją zespół przygotowuje katalog ich widm. Dzięki temu narzędziu możesz obejrzeć każdą z nich już dziś, postój po postoju.</p>
    <p class="fine">Źródła: <a href="https://www.minorplanetcenter.net/about" target="_blank" rel="noopener">Minor Planet Center</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/" target="_blank" rel="noopener">MPC: przewodnik po zgłaszaniu pozycji</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/data-and-services/sarc/" target="_blank" rel="noopener">MPC: obserwacje archiwalne</a> · <a href="https://docs.minorplanetcenter.net/mpc-ops-docs/astrometry/discoveries-and-credit/" target="_blank" rel="noopener">MPC: odkrycia, autorstwo i nazwy</a> · <a href="https://minorplanetcenter.net/cgi-bin/checkmp.cgi" target="_blank" rel="noopener">MPChecker</a> · <a href="https://ssp.imcce.fr/webservices/skybot/" target="_blank" rel="noopener">SkyBoT</a>, <a href="https://ssp.imcce.fr/webservices/miriade/" target="_blank" rel="noopener">Miriade</a> (IMCCE, Obserwatorium Paryskie) · <a href="https://irsa.ipac.caltech.edu/data/SPHEREx/docs/SPHEREx_Expsupp_QR.pdf" target="_blank" rel="noopener">SPHEREx Explanatory Supplement</a> · <a href="https://meetingorganizer.copernicus.org/EPSC2026/EPSC2026-797.html" target="_blank" rel="noopener">Mahlke i in. 2026</a> · <a href="https://arxiv.org/abs/2010.07822" target="_blank" rel="noopener">Hendler &amp; Malhotra 2020</a> · <a href="https://science.nasa.gov/get-involved/citizen-science/new-way-you-can-discover-asteroids/" target="_blank" rel="noopener">NASA: IASC</a></p>`,

    about: () => `
    <p class="eyebrow">O projekcie</p>
    <h1>Zrobione po to, by mogło patrzeć więcej osób</h1>
    <p class="lead">Chronosphere powstał 14 i 15 listopada 2026 roku podczas NASA Space Apps Challenge, w ramach wyzwania <i>Planet X and SPHEREx</i>; zaczął go zespół ${TEAM.name} i od tamtej pory dalej go rozwijamy. W kolejnym tygodniu doszły wyszukiwanie planetoid i komet przecinających pole, polowanie na planetoidy z gotowym raportem dla Minor Planet Center, kometa 3I/ATLAS oraz widok „Lata”, który układa 27 lat obrazów z 2MASS, WISE i SPHEREx na jednej siatce.</p>
    ${team('Zespół')}
    <h2>Dlaczego to zbudowaliśmy</h2>
    <p>Plutona odnalazł w 1930 roku człowiek porównujący dwie fotografie. Ludzie wciąż znajdują w ten sposób nowe światy. Wolontariusze wypatrzyli większość z ponad 5000 komet odkrytych na zdjęciach z sondy SOHO oraz około 3000 kandydatów na brązowe karły na zdjęciach z teleskopu WISE należącego do NASA. SPHEREx fotografuje teraz setki milionów obiektów, raz za razem: więcej, niż jakakolwiek grupa zawodowców zdoła przejrzeć.</p>
    <p>Chcieliśmy narzędzia, w którym każdy, bez żadnego przygotowania, może wybrać punkt na niebie i sam zobaczyć, czy coś się tam poruszyło lub zmieniło, a potem jednym kliknięciem sprawdzić to w niezależnych źródłach.</p>
    <p>Wyzwanie bierze nazwę od Planety X, hipotetycznej, nieodkrytej jeszcze planety w zewnętrznym Układzie Słonecznym. Czy SPHEREx może ją zobaczyć, czy nie, każdy nieznany bliski obiekt zdradziłby się tak samo jak Pluton: jako punkt, który się porusza.</p>
    <h2>Dla kogo</h2>
    <ul>
      <li><b>Dla każdego, kto jest ciekawy.</b> Bez konta i bez przygotowania: przewodnik trwa dwie minuty, a każdy obiekt otwiera się kilkoma prostymi zdaniami o tym, co pokazują pomiary.</li>
      <li><b>Dla nauczycieli i uczniów.</b> Klasa może znaleźć poruszającą się gwiazdę tak, jak znaleziono Plutona, na prawdziwych zdjęciach NASA. Przewodnik zapisuje się na urządzeniu i działa bez połączenia, w sześciu językach.</li>
      <li><b>Dla miłośników astronomii i badaczy.</b> Pomiary dowolnego miejsca można pobrać jako tabelę (CSV), każda ekspozycja prowadzi do swojego oryginalnego pliku w archiwum NASA, a każdy widok można udostępnić jako link albo osadzić na innej stronie.</li>
    </ul>
    <h2>Skąd pochodzą dane</h2>
    <ul>
      <li><b>Obrazy SPHEREx i mapa całego nieba:</b> NASA/JPL-Caltech, udostępniane przez NASA/IPAC Infrared Science Archive (IRSA).</li>
      <li><b>Inne mapy nieba:</b> 2MASS, WISE i DSS, jako HiPS przygotowane przez CDS i udostępniane przez IRSA.</li>
      <li><b>Starsze obrazy tego samego nieba (widok Lata):</b> obrazy atlasu 2MASS (od 1997 do 2001) oraz pojedyncze ekspozycje WISE i NEOWISE (od 2010 do 2024), udostępniane przez IRSA.</li>
      <li><b>Katalogi:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Strasburg).</li>
      <li><b>Komponent atlasu nieba:</b> Aladin Lite (CDS).</li>
      <li><b>Karty encyklopedyczne:</b> Wikipedia, pokazywane z odnośnikiem do artykułu.</li>
    </ul>
    <h2>Otwarte źródło</h2>
    <p>Kod jest publiczny: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. Nie ma etapu budowania ani serwera: stronę można umieścić wszędzie tam, gdzie serwuje się pliki.</p>
    <h2>Użycie AI</h2>
    <p>Oprogramowanie zostało napisane podczas wydarzenia z pomocą asystenta programowania AI. Zespół wybrał podejście, sprawdził wyniki z wartościami katalogowymi i z niezależnymi narzędziami oraz odpowiada za treść. Nie użyto obrazów, dźwięku ani wideo wygenerowanych przez AI: każdy pokazany obraz to dane z teleskopu.</p>
    <p class="fine">Źródła powyższych liczb: <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">NASA o 5000. komecie SOHO</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};
