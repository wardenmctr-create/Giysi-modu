# Doğrulama kapısı (Aşama 1) — oyun içi test protokolü

Bu paket **doğrulama prototipidir**. Birleşik görünüm yöntemi henüz oyun içinde doğrulanmadı; bu kapı
geçmeden kalan 96 modelin üretimine başlanmayacak. Başarısız bir madde sessizce başka bir davranışla
değiştirilmeyecek: sonucu raporlanıp karar birlikte verilecek.

Her kategoriden bir şekil ayrıntılı olarak üretildi (diğer 96 şekil tezgâhta kilitli görünür):

| Kategori | Prototip şekil | Ayrıntılar | Motif yüzeyleri |
|---|---|---|---|
| Şapka | Bere | Kubbeli tepe, kıvrık örgü katlama, etiket | Katlama ön/arka/sağ/sol, tepe ön/arka |
| Elbise/üst | Kısa kollu tişört | Gerçek yaka açıklığı, manşet, etek bandı; standart + ince kol | Ön, arka, sağ kol, sol kol |
| Pantolon | Düz paça (kot) | Kemer köprüleri, arka cepler, ön cep ağzı, fermuar dikişi, düğme, perçin | Sağ/sol uyluk, sağ/sol arka |
| Ayakkabı | Alçak spor | Taban, burun, dil, 3 bağcık, topuk, yan şerit | Sağ/sol dış yan, burun, topuk |

Her prototip şeklin 25 şablonu giysiye oturacak şekilde (yaka/manşet/taban düz, desen gövdede sürekli) ve
97 motif (50 özgün + 33 yeni + 6 ayarlanabilir şekil + 8 Atölye foto yuvası) hazırdır.

## Kurulum (Redmi A3, güncel resmî Android sürümü)

1. `GiysiModu.mcaddon` dosyasını Minecraft ile açın (iki paket birlikte içe aktarılır).
2. Yeni bir test dünyası: Yaratıcı mod, **Hileler açık**. Davranış paketi ve kaynak paketi etkin.
   Deney (beta) ayarı **gerekmez**: yalnızca kararlı `@minecraft/server 2.11.0` ve `@minecraft/server-ui 2.3.0`.
3. Sohbete `/scriptevent gm:kit` → tezgâh, 4 beyaz temel giysi, 3 çanta, 16 boya × 32.

| Komut | İşlev |
|---|---|
| `/scriptevent gm:kit` | Test seti |
| `/scriptevent gm:yogun` | En yoğun kombinasyon: 4 giysi × 16 bölge × 16 üç renkli motif |
| `/scriptevent gm:mod a` / `gm:mod b` | Renklendirme yöntemini değiştirir (aşağıda K2) |
| `/scriptevent gm:durum` | Giyili giysiler, zırh durumu, kol tipi |
| `/scriptevent gm:olcum` | Script tarama süresi (son / en yüksek ms) |
| `/scriptevent gm:tazele` | Görünüm değişkenlerini herkese yeniden gönderir |

## Test edilen varsayımlar

Her madde için **Geçti / Kaldı / Kısmen** ve gerekirse ekran görüntüsü yeterli.

### K1 — Veri aktarımı (`playAnimation` + `stopExpression`)
- [ ] Çantaya bitmiş bir şapka konunca üçüncü şahıs görünümde şapka görünüyor; çıkarınca kayboluyor.
- [ ] Bölge renkleri tasarlanan renklerle aynı.

### K2 — Renklendirme ve doku ayrıntısı
İki yöntem var; ikisini de deneyin ve hangisinin doğru göründüğünü yazın:
- **A** (`/scriptevent gm:mod a`, varsayılan): düz renk maskesi + üstte yarı saydam gölge katmanı.
- **B** (`/scriptevent gm:mod b`): gölgesi işlenmiş maske + renk çarpımı.
- [ ] Renkler doğru, kumaş dokusu (örgü, kot, dikişler, kıvrımlar) her renkte görünüyor.
- [ ] `/scriptevent gm:yogun` sonrası 16 bölgenin hepsi ayrı renkte.
- [ ] Hiçbir yerde titreme (yüz çakışması) yok: yakından ve uzaktan, yürürken ve eğilirken.
      (Derleme sırasında otomatik çakışma denetimi çalışıyor: skin, skin dış katmanı, 4 zırh, giysiler arası
      ve motif katmanları; şu an 0 sorun.)

### K3 — Tezgâh ve önizleme
Tezgâh artık tek ekranlık canlı bir form (CustomForm). Önizleme, kamera oyuncunun karşısına geçerek
dünyada gösterilir; döndürme kaydırıcısıyla kamera etrafında döner.
- [ ] Tezgâha dokununca giriş haznesi, ardından canlı ekran açılıyor.
- [ ] Şekil/şablon/bölge seçimleri ve kaydırıcılar ekranı kapatmadan oyuncunun üstündeki giysiyi anında değiştiriyor.
- [ ] Önizlemeyi yalnızca tasarlayan görüyor; diğer oyuncular giyili hâli görüyor.
- [ ] "Önizlemeyi döndür" kamerayı oyuncunun etrafında döndürüyor; form kapanınca kamera ve hareket normale dönüyor.
- [ ] Ekranı kapatıp tezgâhı yeniden açınca "Taslağa devam" çıkıyor ve tasarım kaldığı yerden sürüyor.
- [ ] **Kaydet ve üret**e basmadan hiçbir boya ya da giysi tüketilmiyor/üretilmiyor; "Taslağı sil" taslağı siliyor.

### K4 — Motifler
- [ ] Motif "Sağa/sola" kaydırıcısıyla sağa-sola, "Yukarı/aşağı" ile yukarı-aşağı gidiyor (ters giderse tek satırlık düzeltme).
- [ ] Boyut, en/boy (şekillerde) ve açı değişiyor; motif yüzeyden taşmıyor; boyut üst sınırı açıya göre değişiyor.
- [ ] Ay yıldız ve Türk bayrağı motifleri doğru yönde (hilalin ağzı ve yıldız bayrağın uçkurluk tarafının tersine bakıyor).
- [ ] Üst üste binen motiflerde son eklenen üstte; 16 motif sınırı çalışıyor.

### K5 — Zırh katmanlaması
- [ ] Giysiler skinin üstünde, zırhın altında (deri, demir, zincir zırh).
- [ ] Zırha değebilecek parçalar o zırh takılınca gizleniyor, çıkarılınca geri geliyor:
      çizme → ayakkabı burnu, bağcıklar, topuk ve ayakkabı motifleri; dizlik → paça, arka cepler, kemer ve köprüleri,
      tişört etek bandı, pantolon motifleri; kask → bere tepe basamakları ve bere motifleri; göğüslük → tişört motifleri.
- [ ] Üst giyiliyken pantolon kemeri ve köprüleri gizli, üst çıkarılınca görünüyor.
- [ ] Yürüme, koşma, eğilme, yüzme sırasında giysiler gövdeyle birlikte hareket ediyor.

### K6 — Standart ve ince kollu skin
Skin kol tipini okuyan güvenilir bir Molang sorgusu bulunamadı; tezgâhta "İnce kol" anahtarı var.
- [ ] Standart skinde tişört kolları kola oturuyor; ince skin + anahtar açıkken de oturuyor.

### K7 — Native çanta (`storage_item`, `bundle_interaction`, item container API)
- [ ] Çanta kese gibi açılıyor, 4 giysi alıyor, giysi dışı eşyayı ve çanta içine çantayı kabul etmiyor.
- [ ] İki çantada iki şapka: ilk konulan giyili kalıyor, ikincisi envantere dönüyor.
- [ ] Şapka bir çantada, pantolon başka çantada: ikisi birlikte giyiliyor.
- [ ] Dünyadan çıkıp girince giyili giysiler aynı; ölümde giyili çanta korunuyor.
- [ ] Çantayı Q ile atıp geri alınca giysiler envantere çıkıyor ve giyilmiyor.

### K8 — Yere yerleştirme
- [ ] Çanta bloğa dokununca 3B çanta (kendi renginde) yere konuyor; dokununca 4 hazneli ekran açılıyor.
- [ ] Vurunca rengi ve içeriği korunmuş tek çanta düşüyor; kopya oluşmuyor.

### K9 — Oyun içi çizim
- [ ] Tişörtte şablon olarak "Çizim (oyun içi fırça)" seçilince "Çizim fırçası" açılıyor.
- [ ] Ekrandaki renkli ızgara ve oyuncunun üstündeki tişört fırçayla anında değişiyor (gövde önü/arkası 8×12).
- [ ] Kaydedilen çizim giyilince aynı görünüyor; her farklı renk bir boya tüketiyor.

### K10 — Atölye paketi
1. Atölye sayfasında bir tişört çizimi ve bir foto motifi kaydedip paketi indirin, adını `.mcaddon` yapıp açın.
2. Test dünyasında "Giysi Atölyesi" davranış ve kaynak paketlerini etkinleştirin (kaynak paketi Giysi Modu'nun üstünde).
- [ ] Tezgâhta tişört şablonlarında "Atölye: *ad*" çıkıyor; seçilince çizim aynen görünüyor (ince kollu skinde de).
- [ ] Motif ekle → "Foto (Atölye)" altında fotoğraf çıkıyor; büyütülüp küçültülebiliyor.
- [ ] Boya maliyeti: tasarımdaki her farklı renk bir boya.

### K11 — Çok oyunculu
- [ ] İkinci oyuncu birinci oyuncunun giysilerini aynı görüyor (sonradan katılınca da, en geç 5 sn içinde).

### K12 — Performans (Redmi A3)
- [ ] Giysisiz FPS: ___ · 4 normal giysi: ___ · `gm:yogun`: ___ · oyun içi çizimli tişört: ___
- [ ] `/scriptevent gm:olcum` en yüksek tarama süresi: ___ ms · dünyaya giriş süresi: ___ sn

Prototip ölçekleri: oyuncuya eklenen yaklaşık 420 render controller ve 607 doku; `.mcaddon` ≈ 1,3 MB.

## Bilinen sınırlamalar

- Oyuncu istemci varlığı (`entity/player.entity.json`) geçersiz kılınır; oyuncu modelini değiştiren başka
  addon'larla çakışabilir. Persona (karakter oluşturucu) parçalı skinler test edilmedi.
- Birinci şahıs görünümde giysiler çizilmez (vanilla kollar gibi).
- Vanilla zırhın kendi iç çakışması (iki bacağın çizmeleri ortada üst üste biner) Minecraft'a aittir; moddan değildir.
- Oyun içi çizim, oyun içinde yeni doku oluşturulamadığı için skin pikseli çözünürlüğündedir. 128×128 çizim ve
  fotoğraf Atölye sayfası üzerinden paketle gelir.

## Rapor biçimi

Her madde için "K3-4: Kaldı — kamera dönmüyor" gibi tek satır yeterli. Kalan maddelerde ekran görüntüsü ve
mümkünse içerik günlüğü (Ayarlar → Oluşturucu → İçerik Günlüğü) çok yardımcı olur.
