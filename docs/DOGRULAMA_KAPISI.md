# Doğrulama kapısı (Aşama 1) — oyun içi test protokolü

Bu paket **doğrulama prototipidir**. Birleşik görünüm yöntemi henüz oyun içinde doğrulanmadı;
bu kapı geçmeden kalan 96 modelin üretimine başlanmayacak. Başarısız bir madde sessizce başka bir
davranışla değiştirilmeyecek: sonucu raporlanıp karar birlikte verilecek.

Prototipte her kategoriden bir şekil üretildi (diğer 96 şekil tezgâhta kilitli görünür):

| Kategori | Prototip şekil | Motif yüzeyleri | Not |
|---|---|---|---|
| Şapka | Bere | Ön, arka, sağ yan, sol yan | |
| Elbise/üst | Kısa kollu tişört | Ön, arka, sağ kol, sol kol | Standart + ince kol geometrisi |
| Pantolon | Düz paça | Sağ/sol ön, sağ/sol arka | |
| Ayakkabı | Alçak spor | Sağ/sol dış yan, sağ/sol burun | Burun = zırhta gizlenen çıkıntı |

Her prototip şeklin 25 şablonu (1–16 bölge) ve 50 motifin tamamı hazırdır.

## Kurulum (Redmi A3, güncel resmî Android sürümü)

1. `dist/GiysiModu.mcaddon` dosyasını telefona indirip Minecraft ile açın (iki paket birlikte içe aktarılır).
2. Yeni bir test dünyası: Yaratıcı mod, **Hileler açık**. Davranış paketi ve kaynak paketi etkin.
   Beta API deneyi **gerekmez** (yalnızca kararlı `@minecraft/server 2.11.0` ve `@minecraft/server-ui 2.3.0` kullanılır).
3. Sohbete: `/scriptevent gm:kit` → tezgâh, 4 beyaz temel giysi, 3 çanta, 16 boya × 32.

Test komutları:

| Komut | İşlev |
|---|---|
| `/scriptevent gm:kit` | Test seti |
| `/scriptevent gm:yogun` | En yoğun kombinasyon: 4 giysi × 16 bölge × 16 üç renkli motif, tek çantada |
| `/scriptevent gm:durum` | Giyili giysiler, zırh durumu, kol tipi |
| `/scriptevent gm:olcum` | Script tarama süresi (son / en yüksek ms) |
| `/scriptevent gm:tazele` | Görünüm değişkenlerini herkese yeniden gönderir |

## Test edilen varsayımlar

Her madde için **Geçti / Kaldı / Kısmen** ve gerekirse ekran görüntüsü yeterli.

### K1 — Veri aktarımı (`playAnimation` + `stopExpression`)
Script, boş `animation.gm.sync` animasyonunu oynatır; `stopExpression` içindeki `v.x=...;` atamaları istemcide
Molang değişkenlerini kurar ve `return 1;` ile animasyon biter.
- [ ] Çantaya bitmiş bir şapka konunca üçüncü şahıs görünümde (F5 / kamera) şapka görünüyor.
- [ ] Çantadan çıkarınca kayboluyor.
- [ ] Bölge renkleri tasarlanan renklerle aynı.

> Kalırsa: aynı veriyi değer başına önceden üretilmiş animasyonlarla (timeline) aktaran yedek yöntem
> devreye alınabilir; paket boyutu büyür. Karar sizinle verilecek.

### K2 — Renk bölgeleri (`overlay_color`, aynı geometride çoklu geçiş)
- [ ] `/scriptevent gm:yogun` sonrası 16 bölgenin hepsi ayrı renkte, titreme (z-fighting) yok.
- [ ] Boş bırakılan bölgeler beyaz.

### K3 — Canlı önizleme (form içinde `live_player_renderer` + `query.is_in_ui`)
- [ ] Tezgâh tasarım ekranının üstünde oyuncu modeli görünüyor.
- [ ] Model, tasarlanan (henüz üretilmemiş) giysiyi gösteriyor; başka oyuncular bu önizlemeyi **görmüyor**.
- [ ] "Önizlemeyi döndür" düğmesi modeli 45° döndürüyor.
- [ ] Önizleme ile giyilen giysinin şekli, renkleri ve motif konumları aynı.

### K4 — Hareketli motif
- [ ] Motif "Sağa" ile sağa, "Yukarı" ile yukarı gidiyor. (Ters giderse: `tools/gen/render.mjs` içindeki
      `ANIM_X_SIGN` işareti değiştirilir — tek satır.)
- [ ] Uç konumlarda (1 ve 16) motif yüzeyin dışına taşmıyor.
- [ ] Üst üste binen motiflerde son eklenen üstte.
- [ ] 16 motif sınırı: 16. motiften sonra "Yeni motif ekle" görünmüyor.

### K5 — Zırh katmanlaması
- [ ] Giysiler skinin üstünde, zırhın altında (deri ve demir zırhla).
- [ ] Ayakkabı burnu çizme takılınca gizleniyor, çıkarılınca geri geliyor.
- [ ] Yürüme, koşma, eğilme (sneak), yüzme sırasında giysiler gövdeyle birlikte hareket ediyor.

### K6 — Standart ve ince kollu skin
Bedrock'ta skin kol tipini okuyan güvenilir bir Molang sorgusu bulunamadı; prototipte tezgâhta
**"Kol tipi: Standart/İnce"** düğmesi var (oyuncu başına kaydedilir).
- [ ] Standart skinde tişört kolları kola oturuyor.
- [ ] İnce skin + "İnce" ayarında kollar oturuyor.

> Otomatik algılama isteniyorsa bu, onayınızı gerektiren bir sapmadır.

### K7 — Native çanta (`storage_item`, `bundle_interaction`, item container API)
- [ ] Çanta envanterde kese gibi açılıyor, 4 giysi alıyor, giysi dışı eşyayı kabul etmiyor, çanta içine çanta girmiyor.
- [ ] İki çantada iki şapka: ilk konulan giyili kalıyor, ikincisi envantere dönüyor (eylem çubuğunda uyarı).
- [ ] Şapka bir çantada, pantolon başka çantada: ikisi birlikte giyiliyor.
- [ ] Dolu envanterde fazla giysi oyuncunun yanına düşüyor.
- [ ] Dünyadan çıkıp girince giyili giysiler aynı (tahliye olmuyor).
- [ ] Ölümde giyili giysileri taşıyan çanta korunuyor, diğer çantalar düşüyor.
- [ ] Çantayı Q ile atıp geri alınca giysiler envantere çıkıyor ve giyilmiyor.

### K8 — Yere yerleştirme
- [ ] Çanta elde bloğa dokununca 3B çanta modeli (çantanın rengiyle) yere konuyor.
- [ ] Yerdeki çantaya dokununca 4 hazneli ekran açılıyor; giysi dışı eşya ve aynı türden ikinci giysi geri veriliyor.
- [ ] Yerdeyken giydirme bitiyor.
- [ ] Vurunca rengi ve içeriği korunmuş tek çanta düşüyor; alınca giysiler envantere çıkıyor; kopya oluşmuyor.

### K9 — Çok oyunculu
- [ ] İkinci oyuncu, birinci oyuncunun giysilerini aynı şekilde görüyor (sonradan katılınca da, en geç 5 sn içinde).

### K10 — Performans (Redmi A3)
- [ ] Giysisiz FPS: ___  · 4 normal giysi FPS: ___  · `gm:yogun` FPS: ___
- [ ] `/scriptevent gm:olcum` en yüksek tarama süresi: ___ ms
- [ ] İlk yükleme süresi (dünyaya giriş): ___ sn

Prototip ölçekleri: oyuncuya eklenen 264 render controller, 422 doku; `.mcaddon` ≈ 440 KB.
Tam sürümde (100 şekil) render controller sayısı aynı kalır, dokular yaklaşık 25 katına çıkar; bu ölçümler
o ölçeğin Redmi A3'te kabul edilebilir olup olmadığını belirleyecek.

## Bilinen sınırlamalar

- Oyuncu istemci varlığı (`entity/player.entity.json`) geçersiz kılınır; oyuncu modelini değiştiren başka
  addon'larla çakışabilir.
- Birinci şahıs görünümde giysiler çizilmez (vanilla kollar gibi).
- Motif ve şekil simgeleri prototip kalitesindedir.

## Rapor biçimi

Her madde için "K3-2: Kaldı — model görünüyor ama giysi yok" gibi tek satır yeterli. Kalan maddeler için
ekran görüntüsü ve mümkünse içerik günlüğü (Ayarlar → Oluşturucu → İçerik Günlüğü) çok yardımcı olur.
