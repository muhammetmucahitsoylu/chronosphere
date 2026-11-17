// The three information pages in Polish. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { spherex: 'Czym jest SPHEREx?', how: 'Jak to działa', about: 'O projekcie' },
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
    </ul>
    <h2>Czego ci nie powie</h2>
    <ul>
      <li>Jeden piksel SPHEREx obejmuje 6,15 sekundy łuku. Nawet gwiazda, której położenie na niebie zmienia się najszybciej, przesuwa się o mniej niż dwa piksele rocznie, więc ruch to mały skok między wizytami, nigdy smuga.</li>
      <li>Pomiary używają prostego, stałego koła i służą do poznawania, a nie do publikacji. Bardzo jasne gwiazdy nasycają detektor; dla nich mierzy się zamiast tego słabą zewnętrzną poświatę gwiazdy, a każdy detektor dołącza się do sąsiedniego: ogólny kształt widma jest poprawny, jego poziom i drobne szczegóły są przybliżone.</li>
      <li>Spadek na długości fali cząsteczki to wskazówka, a nie wykrycie.</li>
      <li>Położenia zwykłych gwiazd powtarzają się z dokładnością do kilku dziesiątych sekundy łuku, ale gwiazda bliska nasycenia kamery może w pojedynczej wizycie odbiegać o sekundę łuku lub więcej.</li>
      <li>Nic tutaj nie jest twierdzeniem o odkryciu. Coś, co wygląda na nowe, to powód, by sprawdzić to w innych narzędziach, do których prowadzą odnośniki przy każdym obiekcie.</li>
    </ul>`,

    about: () => `
    <p class="eyebrow">O projekcie</p>
    <h1>Zrobione w jeden weekend, by mogło patrzeć więcej osób</h1>
    <p class="lead">Chronosphere powstał 14 i 15 listopada 2026 roku podczas NASA Space Apps Challenge, w ramach wyzwania <i>Planet X and SPHEREx</i>, a zbudował go zespół ${TEAM.name}.</p>
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
