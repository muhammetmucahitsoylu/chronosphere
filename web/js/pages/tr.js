// The three information pages in Turkish. The English text is in ../pages.js: keep the two in step.
export default {
  nav: { spherex: 'SPHEREx nedir?', how: 'Nasıl çalışır?', about: 'Hakkında' },
  figure: {
    label: 'Rengi bir kenarından ötekine değişen bir filtre; aynı yıldız her pozda başka bir renge düşer',
    exposure: 'poz',
    caption: 'Teleskop gökyüzünde adım adım ilerler; böylece aynı yıldız her pozda filtrenin başka bir rengine düşer.',
  },
  sheets: ({ TEAM, figure, team }) => ({
    spherex: () => `
    <p class="eyebrow">Görev</p>
    <h1>SPHEREx nedir?</h1>
    <p class="lead">SPHEREx, bütün gökyüzünü kızılötesi ışığın 102 renginde fotoğraflayan bir NASA uzay teleskobudur. Sonra bunu altı ayda bir yeniden yapar.</p>
    <div class="statgrid">
      <div><b>102</b><span>renk, 0,75 ile 5 mikron arasında</span></div>
      <div><b>6 ay</b><span>bütün gökyüzünü bir kez haritalamak için</span></div>
      <div><b>2025</b><span>11 Mart’ta fırlatıldı</span></div>
      <div><b>6,15″</b><span>bir pikselin kapladığı gökyüzü parçası</span></div>
    </div>
    <h2>Neden kızılötesi?</h2>
    <p>Kızılötesi, gözümüzün görebildiğinden daha uzun dalga boylu ışıktır. Soğuk cisimler bu ışıkta parlar: kahverengi cüceler, toz bulutları, ömrünün sonuna yaklaşmış dev yıldızlar. Çok uzak gökadaların ışığı bize bu dalga boylarına gerilmiş olarak ulaşır. Su, karbondioksit ve metan gibi moleküllerin her biri kızılötesi ışığı kendine özgü dalga boylarında soğurur; bu yüzden bir cismin kızılötesi renkleri onun neden yapıldığını ele verir.</p>
    <h2>Filtre tekerleği olmadan 102 renk</h2>
    <p>Çoğu kamera bir seferde tek bir renk çeker. SPHEREx ise rengi bir kenarından ötekine yumuşakça değişen filtrelerin ardından bakar. Teleskop gökyüzünde adım adım ilerledikçe her yıldız her pozda filtrenin başka bir yerine düşer ve başka bir renkte kaydedilir.</p>
    ${figure}
    <p>Bir yıldızın yeterince pozunu toplayınca bütün tayfı elinizde olur. Chronosphere’de zamanda ilerlemekle tayf oluşturmanın aynı iş olması bundandır.</p>
    <h2>Ne için yapıldı</h2>
    <ul>
      <li><b>Evrenin ilk anı.</b> 450 milyondan fazla gökadayı üç boyutlu haritalayarak Büyük Patlama’dan sonraki ilk anda neler olduğuna dair düşünceleri sınar.</li>
      <li><b>Gökadaların tarihi.</b> Tek tek görülemeyecek kadar sönük olanlar da içinde, bütün gökadaların toplam ışımasını ölçer.</li>
      <li><b>Su ve yaşamın yapı taşları.</b> Yıldızların ve gezegenlerin oluştuğu bulutlardaki donmuş suyu, karbondioksiti ve öteki buzları tarar.</li>
    </ul>
    <h2>Bu arada yaptığı başka bir şey</h2>
    <p>SPHEREx gökyüzünün her noktasına tekrar tekrar döndüğü için <b>hareket eden ya da değişen</b> her şeyi de kaydeder: asteroitler, kuyruklu yıldızlar, yakından geçen yıldızlar, kahverengi cüceler, atım yapan ya da parlayan yıldızlar. Yüz milyonlarca yıldızı ve gökadayı fotoğraflar; bu, hiçbir ekibin tek tek bakabileceğinden çok fazladır. Bu araç, daha çok insan bakabilsin diye var.</p>
    <p class="fine">Kaynaklar: <a href="https://www.jpl.nasa.gov/missions/spherex/" target="_blank" rel="noopener">NASA/JPL görev sayfası</a> · <a href="https://science.nasa.gov/mission/spherex/" target="_blank" rel="noopener">NASA Science</a> · <a href="https://irsa.ipac.caltech.edu/Missions/spherex.html" target="_blank" rel="noopener">NASA/IPAC arşivinde SPHEREx</a></p>`,

    how: () => `
    <p class="eyebrow">Perde arkası</p>
    <h1>Nasıl çalışır?</h1>
    <p class="lead">Gökyüzünde bir noktaya tıklarsınız. Birkaç saniye sonra SPHEREx’in o noktadan çektiği bütün görüntüleri hizalanmış olarak, altında bir tayfla izliyorsunuzdur. Arada şunlar olur.</p>
    <ol>
      <li><b>Gökyüzü dizininde arama.</b> Herkese açık bütün SPHEREx pozlarının, yaklaşık 1,6 milyon pozun, küçük bir dizini hangilerinin sizin noktanızın yakınına bakmış olduğunu söyler. Dizin belirli aralıklarla NASA’nın arşivinden yeniden kurulur; böylece yeni veri sürümleri kimse koda dokunmadan görünür.</li>
      <li><b>Yalnızca gereken pikselleri okuma.</b> Tam bir poz 60 megabayttan büyük bir dosyadır. Tarayıcınız dosyanın başlığını ve yalnızca noktanızın çevresindeki birkaç yüz kilobaytlık küçük piksel bloğunu, doğrudan NASA’nın buluttaki açık verisinden okur.</li>
      <li><b>Görüntüleri hizalama.</b> Her poz başka bir açıyla çekilmiştir. Her blok, dosyada saklanan konum bilgisi kullanılarak kuzey yukarıda olacak biçimde ortak bir ızgaraya yeniden çizilir ve gökyüzü arka planının ışıması çıkarılır.</li>
      <li><b>Her pikselin rengini bulma.</b> Her poz noktanızı başka bir dalga boyunda kaydeder. Bu dalga boyu her dosyanın içindeki bir tablodan okunur.</li>
      <li><b>Hesabı sizin cihazınızda yapma.</b> Parlaklık, üst üste toplama, çıkarma, renkli görüntüler, ölçümler ve grafikler tarayıcınızda hesaplanır; her denetimin anında yanıt vermesi bundandır.</li>
      <li><b>Ne olduğunu söyleme.</b> SIMBAD kataloğuna o konumda ne bulunduğu sorulur. Kataloglar bir yıldızın 2000 yılında nerede olduğunu saklar; bu yüzden o zamandan beri yer değiştirmiş yakın yıldızlar eşleştirmeden önce bugünün tarihine taşınır.</li>
    </ol>
    <h2>Sunucu yok, çevrimdışı da çalışır</h2>
    <p>Chronosphere’in kendi sunucusu yoktur. Sayfa bir dizi sabit dosyadan oluşur; geri kalan her şey tarayıcınızın doğrudan NASA’nın açık verisiyle konuşmasıdır. Yani bizim tarafımızda çalışır durumda tutulacak ya da çökebilecek bir şey yok. Bir kez açtığınız her şey, rehberli turun tamamı da içinde, cihazınıza kaydedilir ve bağlantı olmadan çalışmayı sürdürür.</p>
    <h2>Gördüklerinizi nasıl okumalı</h2>
    <ul>
      <li><b>Ziyaretler.</b> SPHEREx gökyüzünün çoğu bölümüne yaklaşık altı ayda bir geri gelir ve her ziyaret birkaç günden birkaç haftaya kadar sürer. Her ziyaret için üst üste toplanmış tek bir görüntü sırayla gösterilince küçük bir kayma kolayca görülür. Güneş sistemi düzleminin kutuplarına yakın yerlere neredeyse her yörüngede baktığı için orada görüntüler aylara göre gruplanır.</li>
      <li><b>Kayma tablosu.</b> Hareket eden bir cisim için her ziyarette ölçülen konum, kataloğun öngördüğüyle karşılaştırılır: gökyüzündeki düzgün hareketi ve en yakın yıldızlar için Dünya’nın kendi yörüngesinden kaynaklanan yıllık salınım. Hareket, cismi gören her dedektörde ayrı ayrı ölçülür ve dedektörler birbiriyle karşılaştırılır.</li>
      <li><b>Tayf.</b> Her nokta bir pozdur: dalga boyu ve halka içindeki noktanın o pozdaki parlaklığı. Noktalar ziyarete göre renklendirilir.</li>
      <li><b>Molekül bantları.</b> Gölgeli şeritler yaygın moleküllerin ışığı soğurduğu yerleri gösterir. Tablo, orada ne kadar derin bir çukur ölçüldüğünü bildirir.</li>
      <li><b>Komşularıyla karşılaştırma.</b> Parlaklık eğrisinin altında, halka içindeki noktanın ziyaretler arasındaki değişimi aynı görüntülerdeki sıradan yıldızlarla karşılaştırılır. Onlar sabit kalmış, nokta kalmamışsa değişim gerçektir, kameranın bir kusuru değildir. Aynısı konumu için de yapılır.</li>
      <li><b>Her yıldız denetlenir.</b> Görüntülerin altında, alandaki her net yıldız hiçbir katalog kullanılmadan hareket ve parlaklık değişimi açısından sınanır. Öne çıkan birkaçı listelenir ve bir baklava işaretiyle gösterilir. İşaret, bakmak için bir nedendir, bir bulgu değil.</li>
    </ul>
    <h2>Size söyleyemeyecekleri</h2>
    <ul>
      <li>Bir SPHEREx pikseli 6,15 yay saniyesi kaplar. Gökyüzünün en hızlı yıldızı bile yılda iki pikselden az yer değiştirir; bu yüzden hareket ziyaretler arasında küçük bir sıçramadır, asla bir çizgi değil.</li>
      <li>Ölçümler basit, sabit bir daire kullanır ve keşif içindir, yayın için değil. Çok parlak yıldızlar dedektörü doyurur; onlarda bunun yerine yıldızın sönük dış ışıması ölçülür ve her dedektör komşusuna eklenir: tayfın genel biçimi doğrudur, düzeyi ve ince ayrıntısı yaklaşıktır.</li>
      <li>Bir molekülün dalga boyundaki çukur bir ipucudur, bir tespit değil.</li>
      <li>Sıradan yıldızlarda konumlar yay saniyesinin onda birkaçı kadar bir doğrulukla yinelenir; ama kamerayı doyurmaya yakın bir yıldız tek bir ziyarette bir yay saniyesi ya da daha fazla sapabilir.</li>
      <li>Buradaki hiçbir şey bir keşif iddiası değildir. Yeni görünen bir şey, onu her cisimden bağlantısı verilen öteki araçlarda denetlemek için bir nedendir.</li>
    </ul>`,

    about: () => `
    <p class="eyebrow">Hakkında</p>
    <h1>Bir hafta sonunda, daha çok insan bakabilsin diye yapıldı</h1>
    <p class="lead">Chronosphere, 14 ve 15 Kasım 2026’da NASA Space Apps Challenge’da, <i>Planet X and SPHEREx</i> görevi için ${TEAM.name} takımı tarafından yapıldı.</p>
    ${team('Ekip')}
    <h2>Neden yaptık</h2>
    <p>Plüton 1930’da iki fotoğrafı karşılaştıran bir insan tarafından bulundu. İnsanlar hâlâ yeni dünyaları bu yolla buluyor. SOHO uzay aracının görüntülerinde keşfedilen 5.000’den fazla kuyruklu yıldızın çoğunu ve NASA’nın WISE teleskobunun görüntülerindeki yaklaşık 3.000 kahverengi cüce adayını gönüllüler fark etti. SPHEREx şimdi yüz milyonlarca cismi tekrar tekrar fotoğraflıyor: hiçbir uzman grubunun inceleyebileceğinden çok fazlası.</p>
    <p>Hiçbir eğitimi olmayan birinin gökyüzünde bir nokta seçip orada bir şeyin hareket edip etmediğini ya da değişip değişmediğini kendi gözüyle görebileceği, sonra da bunu tek tıkla bağımsız kaynaklarla karşılaştırabileceği bir araç istedik.</p>
    <p>Görev adını, dış güneş sisteminde bulunduğu varsayılan ve henüz keşfedilmemiş gezegenden, X Gezegeni’nden alır. SPHEREx onu görebilsin ya da göremesin, yakındaki bilinmeyen her cisim kendini Plüton’un ele verdiği yolla ele verir: hareket eden bir nokta olarak.</p>
    <h2>Veriler nereden geliyor</h2>
    <ul>
      <li><b>SPHEREx görüntüleri ve tüm gökyüzü haritası:</b> NASA/JPL-Caltech; NASA/IPAC Kızılötesi Bilim Arşivi (IRSA) sunar.</li>
      <li><b>Öteki gökyüzü haritaları:</b> 2MASS, WISE ve DSS; CDS’in hazırladığı HiPS olarak, IRSA sunar.</li>
      <li><b>Kataloglar:</b> Gaia DR3 (ESA), CatWISE2020, SIMBAD (CDS, Strazburg).</li>
      <li><b>Gökyüzü atlası bileşeni:</b> Aladin Lite (CDS).</li>
      <li><b>Ansiklopedi kartları:</b> Wikipedia; maddeye bağlantıyla birlikte gösterilir.</li>
    </ul>
    <h2>Açık kaynak</h2>
    <p>Kod herkese açık: <a href="${TEAM.repo}" target="_blank" rel="noopener">${TEAM.repo.replace('https://', '')}</a>. Derleme adımı da sunucusu da yok: sayfa, dosya sunabilen her yerde barındırılabilir.</p>
    <h2>Yapay zekâ kullanımı</h2>
    <p>Yazılım, etkinlik sırasında bir yapay zekâ kodlama yardımcısıyla yazıldı. Yaklaşımı takım seçti, sonuçları katalog değerleriyle ve bağımsız araçlarla karşılaştırdı ve içerikten takım sorumludur. Yapay zekâyla üretilmiş görüntü, ses ya da video kullanılmadı: gösterilen her görüntü teleskop verisidir.</p>
    <p class="fine">Yukarıdaki sayıların kaynakları: <a href="https://svs.gsfc.nasa.gov/14552/" target="_blank" rel="noopener">SOHO’nun 5.000. kuyruklu yıldızı üzerine NASA</a> · <a href="https://www.backyardworlds.org/" target="_blank" rel="noopener">Backyard Worlds: Planet 9</a></p>`,
  }),
};
