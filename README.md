# Giysi Modu

Minecraft Bedrock (Android, güncel resmî sürüm) için giysi tasarım addon'u: 4 kategori × 25 şekil,
şekil başına 25 renk şablonu (1–16 boya bölgesi), giysi başına 16'ya kadar motif (konum, uygun motiflerde
boyut ve açı ayarlı), oyun içi çizim ve Atölye sayfasından gelen 128×128 çizim/foto, giyinmenin tek yolu
olan giysi çantası. Mod tamamen Türkçedir.

**Durum: Aşama 1 — doğrulama prototipi.** Her kategoriden bir şekil ayrıntılı olarak üretildi;
oyun içi doğrulama için bkz. [docs/DOGRULAMA_KAPISI.md](docs/DOGRULAMA_KAPISI.md).

## Oynanış

| Tarif | Malzeme |
|---|---|
| Beyaz temel şapka / üst / pantolon / ayakkabı | 5 / 8 / 7 / 4 beyaz yün (deri zırh biçimi) |
| Giysi tezgâhı | 2 tahta + 2 çubuk + 1 beyaz yün (şekilsiz) |
| Giysi çantası | 1 yün (herhangi renk) + 1 deri + 1 boya (şekilsiz; boya çantanın rengi) |

**Tezgâh:** giriş haznesine giysi seç → canlı ekranda şekil, şablon ve boya hazneleri; motif düzenleyici
(konum, boyut, en/boy, açı); oyun içi çizim fırçası. Önizleme kamerayla oyuncunun üstünde, döndürülebilir.
**Kaydet ve üret**e basılana kadar hiçbir şey üretilmez veya tüketilmez; tasarım taslak olarak saklanır.

**Çanta:** bitmiş giysileri çantaya koy; taşıdığın tüm çantalarda her türden ilk konulan giysi giyilir.

**Atölye:** tarayıcıda giysinin üzerine piksel piksel çiz ya da galeriden fotoğraf seç (16 boya rengine
dönüşür), paketi indir; tasarımlar tezgâhta "Atölye" şablonu ve "Foto" motifi olarak çıkar.

## Geliştirme

```
npm run build   # tools/build.mjs → build/ ve dist/GiysiModu.mcaddon (çakışma denetimi dahil)
npm test        # derleme + sahte Bedrock API ile mantık testleri
npm run check   # scriptlerin resmi API tanımlarıyla tür denetimi (önce: cd tools && npm i)
node tools/page.mjs tools/preview_template.html onizleme.html   # 3B önizleme sayfası
node tools/page.mjs tools/atolye_template.html atolye.html      # Atölye sayfası
```

| Yol | İçerik |
|---|---|
| `tools/catalog.mjs` | 100 şekil, 25 şablon, 97 motif, 11 set, 16 boya — tek kaynak |
| `tools/motif_art.mjs`, `tools/gen/vector_motifs.mjs` | Piksel ve vektör motif çizimleri (Türk bayrağı resmî oranlarla) |
| `tools/gen/shapes_proto.mjs` | Prototip şekiller: parçalar, katman bütçesi, kumaş gölgeleri, motif yüzeyleri |
| `tools/gen/templates.mjs` | Giysiye oturan 25 şablon |
| `tools/gen/garment.mjs`, `tools/gen/fabric.mjs` | Doku yerleşimi, gövde çevresi koordinatı, kumaş dokuları |
| `tools/gen/zfight.mjs` | Çakışma (titreme) dedektörü |
| `tools/gen/render.mjs` | Oyuncu render controller'ları, motif animasyonları |
| `src/scripts/` | Oyun scriptleri: çanta motoru, tezgâh, çizim, Atölye kaydı, veri aktarımı |
| `tests/` | Sahte `@minecraft/server` ve `@minecraft/server-ui` ile mantık testleri |
