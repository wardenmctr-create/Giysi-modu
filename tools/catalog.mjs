// Giysi kataloğu: 4 kategori × 25 şekil, 25 ortak renk şablonu, 50 motif, 11 set.
// Bu dosya hem üretim betiğinin hem de oyun içi script verisinin tek kaynağıdır.

export const CATEGORIES = [
  { id: "hat", key: "h", name: "Şapka", baseItem: "gm:hat_base", item: "gm:hat", wool: 5 },
  { id: "top", key: "t", name: "Elbise/Üst", baseItem: "gm:top_base", item: "gm:top", wool: 8 },
  { id: "pants", key: "p", name: "Pantolon", baseItem: "gm:pants_base", item: "gm:pants", wool: 7 },
  { id: "shoes", key: "s", name: "Ayakkabı", baseItem: "gm:shoes_base", item: "gm:shoes", wool: 4 },
];

// Her kategoride sıra: 17 modern, 5 fantastik, 3 ortaçağ.
// sets: şeklin ait olduğu uyumlu set(ler). proto: doğrulama kapısında üretilen model.
const S = (name, style, sets = [], proto = false) => ({ name, style, sets, proto });

export const SHAPES = {
  hat: [
    S("Bere", "modern", ["kislik"], true),
    S("Ponponlu bere", "modern", ["kislik"]),
    S("Kulaklıklı bere", "modern", ["kislik"]),
    S("Siperlikli şapka", "modern", ["sokak"]),
    S("Kasket", "modern", ["tesisatci"]),
    S("Balıkçı şapkası", "modern"),
    S("Fötr", "modern"),
    S("Geniş kenarlı şapka", "modern"),
    S("Kovboy şapkası", "modern", ["kovboy"]),
    S("Silindir şapka", "modern"),
    S("Ressam beresi", "modern"),
    S("Aşçı şapkası", "modern"),
    S("Mezuniyet kepi", "modern"),
    S("Bandana", "modern"),
    S("Kaşif şapkası", "modern", ["kasif"]),
    S("Peluş başlık", "modern"),
    S("İnşaatçı bareti", "modern", ["insaatci"]),
    S("Büyücü şapkası", "fantastik", ["buyucu"]),
    S("Elf başlığı", "fantastik", ["orman"]),
    S("Mantar başlığı", "fantastik"),
    S("Boynuzlu başlık", "fantastik"),
    S("Kristal taç", "fantastik", ["kristal"]),
    S("Viking başlığı", "ortacag", ["viking"]),
    S("Sarkık halk şapkası", "ortacag"),
    S("Konik soylu başlığı", "ortacag", ["soylu"]),
  ],
  top: [
    S("Kısa kollu tişört", "modern", ["sokak"], true),
    S("Uzun kollu tişört", "modern"),
    S("Kolsuz üst", "modern"),
    S("Kısa kollu gömlek", "modern", ["tesisatci"]),
    S("Uzun kollu gömlek", "modern", ["kovboy"]),
    S("Kısa kollu ceket", "modern"),
    S("Kısa ceket", "modern"),
    S("Klasik ceket", "modern"),
    S("Kapüşonlu sweatshirt", "modern", ["sokak"]),
    S("Kolsuz kapüşonlu", "modern"),
    S("Dik yakalı kazak", "modern", ["kislik"]),
    S("Yelek", "modern", ["insaatci"]),
    S("Uzun palto", "modern"),
    S("Panço", "modern"),
    S("Düz elbise", "modern"),
    S("Çan etekli elbise", "modern"),
    S("Kabarık etekli elbise", "modern"),
    S("Büyücü cübbesi", "fantastik", ["buyucu"]),
    S("Maceracı ceketi", "fantastik", ["kasif"]),
    S("Yaprak yakalı üst", "fantastik", ["orman"]),
    S("Kristal omuzluklu tunik", "fantastik", ["kristal"]),
    S("Peri elbisesi", "fantastik"),
    S("Viking tuniği", "ortacag", ["viking"]),
    S("Bağcıklı köylü gömleği", "ortacag"),
    S("Pelerinli soylu üstü", "ortacag", ["soylu"]),
  ],
  pants: [
    S("Dar paça", "modern"),
    S("Düz paça", "modern", ["sokak"], true),
    S("Bol paça", "modern", ["kislik"]),
    S("İspanyol paça", "modern"),
    S("Manşetli", "modern"),
    S("Kıvrık paça", "modern"),
    S("Bilek üstü", "modern"),
    S("Kargo", "modern", ["kasif"]),
    S("Dizlikli iş pantolonu", "modern", ["insaatci"]),
    S("Askılı pantolon", "modern"),
    S("Salopet", "modern", ["tesisatci"]),
    S("Kısa şort", "modern"),
    S("Bermuda", "modern"),
    S("Kapri", "modern"),
    S("Bol şort", "modern"),
    S("Kargo şort", "modern"),
    S("Spor şort", "modern"),
    S("Katmanlı maceracı", "fantastik"),
    S("Kristal dizlikli", "fantastik", ["kristal"]),
    S("Yaprak kemerli", "fantastik", ["orman"]),
    S("Çift kat büyücü", "fantastik", ["buyucu"]),
    S("Balon paçalı soytarı", "fantastik"),
    S("Viking pantolonu", "ortacag", ["viking"]),
    S("Binici pantolonu", "ortacag", ["kovboy", "soylu"]),
    S("Kuşaklı şalvar", "ortacag"),
  ],
  shoes: [
    S("Alçak spor", "modern", ["sokak"], true),
    S("Yüksek spor", "modern"),
    S("Kalın tabanlı spor", "modern"),
    S("Kundura", "modern"),
    S("Topuklu kundura", "modern"),
    S("Mokasen", "modern"),
    S("Babet", "modern"),
    S("Açık sandalet", "modern"),
    S("Kapalı burunlu sandalet", "modern"),
    S("Parmak arası terlik", "modern"),
    S("Bantlı terlik", "modern"),
    S("Peluş terlik", "modern"),
    S("Bilek botu", "modern", ["kasif"]),
    S("Postal", "modern", ["insaatci"]),
    S("Lastik çizme", "modern", ["tesisatci"]),
    S("Kış botu", "modern", ["kislik"]),
    S("Kovboy çizmesi", "modern", ["kovboy"]),
    S("Elf ayakkabısı", "fantastik", ["orman"]),
    S("Soytarı ayakkabısı", "fantastik"),
    S("Kristal tokalı büyücü botu", "fantastik", ["buyucu", "kristal"]),
    S("Pençe burunlu bot", "fantastik"),
    S("Yaprak manşetli bot", "fantastik"),
    S("Viking deri botu", "ortacag", ["viking"]),
    S("Bağcıklı ortaçağ botu", "ortacag"),
    S("Uzun burunlu saray kundurası", "ortacag", ["soylu"]),
  ],
};

export const SETS = {
  viking: "Viking",
  buyucu: "Büyücü",
  insaatci: "İnşaatçı",
  tesisatci: "Tesisatçı",
  kasif: "Kaşif",
  kovboy: "Kovboy",
  kislik: "Kışlık",
  sokak: "Sokak/Spor",
  orman: "Orman/Elf",
  kristal: "Kristal",
  soylu: "Soylu",
};

// Ortak 25 renk şablonu. regions: bağımsız boya bölgesi sayısı (1–16).
// Modele/sete özel uyarlamalar ileride shape.templateOverrides ile bunların yerini alacak.
export const TEMPLATES = [
  { id: "duz", name: "Düz", regions: 1 },
  { id: "ust_alt", name: "Üst–alt", regions: 2 },
  { id: "on_arka", name: "Ön–arka", regions: 2 },
  { id: "sag_sol", name: "Sağ–sol", regions: 2 },
  { id: "kenarlik", name: "Kenarlık", regions: 2 },
  { id: "orta_serit", name: "Orta şerit", regions: 2 },
  { id: "ikili_dikey", name: "İkili dikey", regions: 2 },
  { id: "uclu_dikey", name: "Üçlü dikey", regions: 3 },
  { id: "ikili_yatay", name: "İkili yatay", regions: 2 },
  { id: "uclu_yatay", name: "Üçlü yatay", regions: 3 },
  { id: "capraz", name: "Çapraz", regions: 2 },
  { id: "cift_capraz", name: "Çift çapraz", regions: 2 },
  { id: "dama", name: "Dama", regions: 2 },
  { id: "dort_dama", name: "Dört renkli dama", regions: 4 },
  { id: "baklava", name: "Baklava", regions: 2 },
  { id: "zikzak", name: "Zikzak", regions: 2 },
  { id: "sevron", name: "Şevron", regions: 2 },
  { id: "benek", name: "Benek", regions: 2 },
  { id: "dalga", name: "Dalga", regions: 2 },
  { id: "kisa_girdap", name: "Kısa girdap", regions: 3 },
  { id: "uzun_girdap", name: "Uzun girdap", regions: 4 },
  { id: "kose", name: "Köşe panelleri", regions: 5 },
  { id: "yamali", name: "Yamalı", regions: 6 },
  { id: "mozaik", name: "Mozaik", regions: 8 },
  { id: "on_alti", name: "16 parçalı düzen", regions: 16 },
];

// 50 motif. ch: renk kanalı sayısı (38 tek, 2 iki, 10 üç kanallı).
const M = (id, name, ch = 1) => ({ id, name, ch });
export const MOTIFS = [
  M("creeper", "Creeper yüzü"), M("enderman", "Enderman gözleri"), M("kedi", "Kedi", 3),
  M("kurt", "Kurt"), M("aksolotl", "Aksolotl", 3), M("ari", "Arı", 3), M("wither", "Wither"),
  M("ejderha", "Ejderha başı"), M("kilic", "Kılıç"), M("kazma", "Kazma"), M("balta", "Balta"),
  M("yay", "Yay ve ok"), M("mizrak", "Üç dişli mızrak"), M("kalkan", "Kalkan"), M("elmas", "Elmas"),
  M("zumrut", "Zümrüt"), M("kiziltas", "Kızıltaş"), M("altin_elma", "Altın elma", 3),
  M("ender_inci", "Ender incisi"), M("ender_goz", "Ender gözü", 3), M("masa", "Çalışma masası"),
  M("tnt", "TNT", 3), M("cim", "Çim bloğu", 2), M("gecit", "Nether geçidi", 3),
  M("nether_yildiz", "Nether yıldızı"),
  M("yildiz", "Yıldız"), M("kalp", "Kalp"), M("simsek", "Şimşek"), M("hilal", "Hilal"),
  M("gunes", "Güneş"), M("bulut", "Bulut"), M("yagmur", "Yağmur bulutu"), M("cicek", "Çiçek", 3),
  M("yaprak", "Yaprak"), M("agac", "Ağaç"), M("dag", "Dağ"), M("dalga", "Dalga"),
  M("alev", "Alev", 3), M("kar", "Kar tanesi"), M("pusula", "Pusula"), M("capa", "Çapa"),
  M("kafatasi", "Kafatası"), M("kelebek", "Kelebek", 3), M("pati", "Pati"), M("disli", "Dişli"),
  M("dama", "Dama", 2), M("cift_serit", "Çift şerit"), M("girdap", "Girdap"),
  M("kanat", "Kanatlar"), M("tac", "Taç"),
];

// Vanilla boya renkleri (Bedrock boya rengi değerleri).
export const DYES = [
  { id: "white", name: "Beyaz", rgb: 0xf9fffe },
  { id: "orange", name: "Turuncu", rgb: 0xf9801d },
  { id: "magenta", name: "Eflatun", rgb: 0xc74ebd },
  { id: "light_blue", name: "Açık mavi", rgb: 0x3ab3da },
  { id: "yellow", name: "Sarı", rgb: 0xfed83d },
  { id: "lime", name: "Açık yeşil", rgb: 0x80c71f },
  { id: "pink", name: "Pembe", rgb: 0xf38baa },
  { id: "gray", name: "Gri", rgb: 0x474f52 },
  { id: "light_gray", name: "Açık gri", rgb: 0x9d9d97 },
  { id: "cyan", name: "Camgöbeği", rgb: 0x169c9c },
  { id: "purple", name: "Mor", rgb: 0x8932b8 },
  { id: "blue", name: "Mavi", rgb: 0x3c44aa },
  { id: "brown", name: "Kahverengi", rgb: 0x835432 },
  { id: "green", name: "Yeşil", rgb: 0x5e7c16 },
  { id: "red", name: "Kırmızı", rgb: 0xb02e26 },
  { id: "black", name: "Siyah", rgb: 0x1d1d21 },
];

export const LIMITS = { maxRegions: 16, maxMotifs: 16, motifPos: 16, bagSlots: 4, texture: 128 };

export function validateCatalog() {
  const errors = [];
  for (const c of CATEGORIES) {
    const list = SHAPES[c.id];
    if (list.length !== 25) errors.push(`${c.id}: ${list.length} şekil`);
    const count = (s) => list.filter((x) => x.style === s).length;
    if (count("modern") !== 17 || count("fantastik") !== 5 || count("ortacag") !== 3)
      errors.push(`${c.id}: tarz dağılımı ${count("modern")}/${count("fantastik")}/${count("ortacag")}`);
  }
  if (TEMPLATES.length !== 25) errors.push(`şablon sayısı ${TEMPLATES.length}`);
  for (const t of TEMPLATES) if (t.regions < 1 || t.regions > 16) errors.push(`şablon ${t.id} bölge ${t.regions}`);
  if (MOTIFS.length !== 50) errors.push(`motif sayısı ${MOTIFS.length}`);
  const ch = [1, 2, 3].map((n) => MOTIFS.filter((m) => m.ch === n).length);
  if (ch[0] !== 38 || ch[1] !== 2 || ch[2] !== 10) errors.push(`motif kanalları ${ch.join("/")}`);
  for (const id of Object.keys(SETS)) {
    for (const c of CATEGORIES)
      if (!SHAPES[c.id].some((s) => s.sets.includes(id))) errors.push(`set ${id}: ${c.id} parçası yok`);
  }
  return errors;
}
