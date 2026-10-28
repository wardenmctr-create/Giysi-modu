# Giysi Modu

Minecraft Bedrock (Android, güncel resmî sürüm) için giysi tasarım addon'u: 4 kategori × 25 şekil,
şekil başına 25 renk şablonu (1–16 boya bölgesi), giysi başına 16'ya kadar kaydırılabilir motif,
giyinmenin tek yolu olan giysi çantası.

**Durum: Aşama 1 — doğrulama prototipi.** Her kategoriden bir şekil tamamen çalışır durumda üretildi;
oyun içi doğrulama kapısı için bkz. [docs/DOGRULAMA_KAPISI.md](docs/DOGRULAMA_KAPISI.md).

## İndir

`dist/GiysiModu.mcaddon` — telefonda Minecraft ile açın.

## Oynanış

| Tarif | Malzeme |
|---|---|
| Beyaz temel şapka / üst / pantolon / ayakkabı | 5 / 8 / 7 / 4 beyaz yün (deri zırh biçimi) |
| Giysi tezgâhı | 2 tahta + 2 çubuk + 1 beyaz yün (şekilsiz) |
| Giysi çantası | 1 yün (herhangi renk) + 1 deri + 1 boya (şekilsiz; boya çantanın rengi) |

**Tezgâh:** giriş haznesine giysi seç → şekil → renk şablonu → boya hazneleri (canlı önizleme) →
yeşil motif düzenleyici → Tamamla. Boyalar yalnızca son onayda tüketilir. Tamamlanmış giysi tezgâha
tekrar konduğunda yalnızca yeni motif eklenebilir.

**Çanta:** bitmiş giysileri çantaya koyun; taşıdığınız tüm çantalarda her türden ilk konulan giysi giyilir.
Çanta bloğa dokunarak yere konabilir; yerdeyken giydirmez, vurunca içeriğiyle birlikte düşer.

## Geliştirme

```
npm run build   # tools/build.mjs → build/ ve dist/GiysiModu.mcaddon
npm test        # derleme + sahte Bedrock API ile mantık testleri
npm run check   # scriptlerin resmi API tanımlarıyla tür denetimi (önce: cd tools && npm i)
```

| Yol | İçerik |
|---|---|
| `tools/catalog.mjs` | 100 şekil, 25 şablon, 50 motif, 11 set, 16 boya — tek kaynak |
| `tools/motif_art.mjs` | 50 motifin 12×12 çizimleri |
| `tools/gen/shapes_proto.mjs` | Prototip şekillerin geometri tanımları ve motif yüzeyleri |
| `tools/gen/templates.mjs` | 25 şablonun bölge fonksiyonları |
| `tools/gen/garment.mjs` | 128×128 doku yerleşimi ve Bedrock geometrisi |
| `tools/gen/render.mjs` | Oyuncu render controller'ları, motif animasyonları |
| `src/scripts/` | Oyun scriptleri: çanta motoru, tezgâh, yerdeki çanta, veri aktarımı |
| `tests/` | Sahte `@minecraft/server` ile mantık testleri |
