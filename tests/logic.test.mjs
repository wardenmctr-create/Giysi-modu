// Oyun dışı mantık testleri: node --import ./tests/mock/loader.mjs --test tests/
// Önce: node tools/build.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { world, system, ItemStack, Player, Dimension, Direction, EquipmentSlot } from "./mock/server.mjs";
import { ui } from "./mock/server-ui.mjs";

const S = "../build/GiysiModu_BP/scripts/";
const comps = {};
const registry = { registerCustomComponent: (n, c) => (comps[n] = c) };
await import(S + "main.js");
system.beforeEvents.startup.fire({ blockComponentRegistry: registry, itemComponentRegistry: registry });
world.afterEvents.worldLoad.fire({});
const { DATA } = await import(S + "data.js");
const { createClothItem, readCloth, bagContainer, ensureBagId } = await import(S + "cloth.js");
const { scanPlayer, getState } = await import(S + "bags.js");
const { breakBag } = await import(S + "placed.js");

const dim = new Dimension();
let n = 0;
function newPlayer() {
  const p = new Player(`P${++n}`, dim);
  world.players.push(p);
  return p;
}
function cloth(cat, extra = {}) {
  const shape = DATA.SHAPES[cat].findIndex((s) => s.built >= 0);
  return createClothItem({ v: 1, id: `t${cat}${++n}`, cat, shape, tpl: 1, colors: [14, 3], motifs: [], done: true, ...extra });
}
function bagWith(color, items) {
  const b = new ItemStack(`gm:bag_${color}`);
  ensureBagId(b);
  const c = bagContainer(b);
  items.forEach((it, j) => c.setItem(j, it));
  return b;
}
// Oyuncunun eriştiği tüm giysi kimlikleri (envanter + çanta içleri + yere düşenler).
function allClothIds(p) {
  const ids = [];
  const visit = (it) => {
    if (!it) return;
    const d = readCloth(it);
    if (d) ids.push(d.id);
    const c = it.getComponent("minecraft:inventory")?.container;
    if (c) for (let j = 0; j < c.size; j++) visit(c.getItem(j));
  };
  for (let i = 0; i < p.container.size; i++) visit(p.container.getItem(i));
  for (const d of dim.items) visit(d.item);
  for (const e of dim.entities) if (e.inv) for (let j = 0; j < 4; j++) visit(e.inv.getItem(j));
  return ids.sort();
}
const worn = (p, cat) => getState(p).data[cat]?.id;

test("katalog: 4×25 şekil, 25 şablon, ilk 50 motif + en az 20 eklenen motif", () => {
  for (const c of DATA.CATEGORIES) assert.equal(DATA.SHAPES[c.id].length, 25);
  assert.equal(DATA.TEMPLATES.length, 25);
  assert.ok(DATA.MOTIFS.slice(50).filter((m) => m.kind === "pixel" || m.kind === "vector").length >= 20);
  for (const id of ["hilal", "yildiz", "ay_yildiz", "turk_bayragi"]) assert.ok(DATA.MOTIFS.some((m) => m.id === id), id);
});

test("farklı çantalardaki farklı türler birlikte giyilir; ilk konulan öncelikli", () => {
  const p = newPlayer();
  const hat1 = cloth("hat"), pants = cloth("pants"), hat2 = cloth("hat");
  p.container.setItem(0, bagWith("red", [hat1]));
  p.container.setItem(1, bagWith("blue", [pants]));
  scanPlayer(p);
  const before = allClothIds(p);
  assert.equal(worn(p, "hat"), readCloth(hat1).id);
  assert.equal(worn(p, "pants"), readCloth(pants).id);
  // İkinci şapka ikinci çantaya konur → envantere geri verilir.
  const b = p.container.getItem(1);
  bagContainer(b).setItem(1, hat2);
  p.container.setItem(1, b);
  scanPlayer(p);
  assert.equal(worn(p, "hat"), readCloth(hat1).id);
  assert.equal(bagContainer(p.container.getItem(1)).getItem(1), undefined);
  assert.deepEqual(allClothIds(p), [...before, readCloth(hat2).id].sort());
  assert.ok(p.actionbar.some((m) => m.includes("ikinci")));
});

test("giyili çanta ölümde korunur, diğeri korunmaz", () => {
  const p = newPlayer();
  p.container.setItem(0, bagWith("red", [cloth("top")]));
  p.container.setItem(1, new ItemStack("gm:bag_blue"));
  scanPlayer(p);
  assert.equal(p.container.getItem(0).keepOnDeath, true);
  assert.equal(p.container.getItem(1).keepOnDeath, false);
});

test("giyili giysi çıkarılınca sonraki geçerli giysi giyilir", () => {
  const p = newPlayer();
  const a = cloth("shoes"), b2 = cloth("shoes");
  p.container.setItem(0, bagWith("red", [a]));
  scanPlayer(p);
  const bag = p.container.getItem(0);
  bagContainer(bag).setItem(0, undefined);
  bagContainer(bag).setItem(2, b2);
  p.container.setItem(0, bag);
  p.container.setItem(5, a);
  scanPlayer(p);
  assert.equal(worn(p, "shoes"), readCloth(b2).id);
});

test("yerden alınan dolu çanta tahliye edilir, giysiler otomatik giyilmez, dolu envanterde yere düşer", () => {
  const p = newPlayer();
  for (let i = 1; i < 36; i++) p.container.setItem(i, new ItemStack("minecraft:dirt", 64));
  const bag = bagWith("green", [cloth("hat"), cloth("top")]);
  const before = allClothIds(p).length;
  dim.items.length = 0;
  const itemEntity = { getComponent: () => ({ itemStack: bag }) };
  world.beforeEvents.entityItemPickup.fire({ entity: p, item: itemEntity });
  p.container.setItem(0, bag);
  scanPlayer(p);
  assert.equal(worn(p, "hat"), undefined);
  assert.equal(worn(p, "top"), undefined);
  const c = bagContainer(p.container.getItem(0));
  for (let j = 0; j < 4; j++) assert.equal(c.getItem(j), undefined);
  assert.equal(dim.items.length, 2);
  assert.equal(allClothIds(p).length, before + 2);
});

test("kayıt yükleme / envanterde taşıma tahliye sayılmaz", () => {
  const p = newPlayer();
  const h = cloth("hat");
  p.container.setItem(3, bagWith("red", [h]));
  scanPlayer(p);
  const bag = p.container.getItem(3);
  p.container.setItem(3, undefined);
  p.container.setItem(20, bag);
  scanPlayer(p);
  assert.equal(worn(p, "hat"), readCloth(h).id);
});

test("çantaya tamamlanmamış/yabancı eşya girerse geri verilir", () => {
  const p = newPlayer();
  p.container.setItem(0, bagWith("red", [new ItemStack("gm:hat")]));
  scanPlayer(p);
  assert.equal(bagContainer(p.container.getItem(0)).getItem(0), undefined);
  assert.equal(p.container.getItem(1)?.typeId, "gm:hat");
});

test("yerleştir → kır → al döngüsü renk ve veriyi korur, kopya oluşmaz", async () => {
  const p = newPlayer();
  dim.items.length = 0;
  const h = cloth("hat", { motifs: [{ i: 2, f: 1, x: 3, y: 9, c: [1, 2, 3] }] });
  p.container.setItem(0, bagWith("magenta", [h, cloth("pants")]));
  scanPlayer(p);
  const ids = allClothIds(p);
  comps["gm:bag"].onUseOn({ source: p, block: { location: { x: 0, y: 63, z: 0 } }, blockFace: Direction.Up });
  await system.tick(1);
  assert.equal(p.container.getItem(0), undefined);
  const ent = dim.entities.find((e) => e.typeId === "gm:placed_bag" && e.isValid);
  assert.equal(ent.getProperty("gm:color"), 2);
  assert.deepEqual(allClothIds(p), ids);
  scanPlayer(p);
  assert.equal(worn(p, "hat"), undefined, "yerdeki çanta giydirmez");
  breakBag(ent, p);
  assert.equal(ent.isValid, false);
  assert.equal(dim.items.length, 1);
  const dropped = dim.items[0].item;
  assert.equal(dropped.typeId, "gm:bag_magenta");
  assert.deepEqual(allClothIds(p), ids);
  assert.deepEqual(readCloth(bagContainer(dropped).getItem(0)).motifs, readCloth(h).motifs);
  // Alınca tahliye edilir.
  dim.items.length = 0;
  p.container.setItem(5, dropped);
  scanPlayer(p);
  assert.equal(worn(p, "hat"), undefined);
  assert.deepEqual(allClothIds(p), ids);
});

test("yerdeki çanta aynı türden ikinci giysiyi reddeder", () => {
  const p = newPlayer();
  const ent = dim.spawnEntity("gm:placed_bag", { x: 0, y: 64, z: 0 });
  const h1 = cloth("hat"), h2 = cloth("hat");
  ent.inv.setItem(0, h1);
  world.afterEvents.entityContainerOpened.fire({ entity: ent, openSource: { entity: p } });
  ent.inv.setItem(2, h2);
  ent.inv.setItem(3, new ItemStack("minecraft:dirt", 3));
  world.afterEvents.entityContainerClosed.fire({ entity: ent, closeSource: { entity: p } });
  assert.equal(readCloth(ent.inv.getItem(0)).id, readCloth(h1).id);
  assert.equal(ent.inv.getItem(2), undefined);
  assert.equal(ent.inv.getItem(3), undefined);
  assert.ok(allClothIds(p).includes(readCloth(h2).id));
  assert.equal(dim.items.length === 0 || !dim.items.some((d) => readCloth(d.item)?.id === readCloth(h1).id), true);
});

function dyeCount(p, id) {
  let n = 0;
  for (let i = 0; i < 36; i++) {
    const it = p.container.getItem(i);
    if (it?.typeId.endsWith("_dye") && (!id || it.typeId === `minecraft:${id}_dye`)) n += it.amount;
  }
  return n;
}
const D = (id) => DATA.DYES.findIndex((d) => d.id === id);
const findItem = (p, type) => [...Array(36).keys()].map((i) => p.container.getItem(i)).find((it) => it?.typeId === type);

async function runBench(p, answers) {
  ui.answers = answers;
  await comps["gm:workbench"].onPlayerInteract({ player: p });
  for (let i = 0; i < 60; i++) await system.tick(1);
  assert.equal(ui.answers.length, 0, `kullanılmayan yanıtlar: ${JSON.stringify(ui.answers)}`);
}

test("tezgâh: kapatınca taslak saklanır, hiçbir şey tüketilmez; yeniden açınca kalınan yerden devam edilir", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:top_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 5));
  await runBench(p, ["beyaz temel", { set: "Renk şablonu", value: 1 }, { set: "Bölge 1", value: D("red") + 1 }, null]);
  assert.equal(dyeCount(p), 5);
  assert.ok(findItem(p, "gm:top_base"), "temel giysi duruyor");
  assert.ok(p.getDynamicProperty("gm:taslak"), "taslak saklandı");
  assert.equal(p.movement, true, "hareket kilidi kalktı");
  assert.ok(p.cameraLog.some((c) => c.preset === "minecraft:free"), "kamera önizlemesi açıldı");
  assert.ok(p.cameraLog.at(-1).clear, "kamera eski hâline döndü");
  await runBench(p, ["Taslağa devam", "Kaydet ve üret"]);
  assert.equal(dyeCount(p), 4);
  const d = readCloth(findItem(p, "gm:top"));
  assert.equal(d.tpl, 1);
  assert.deepEqual(d.colors, [D("red"), -1]);
  assert.equal(p.getDynamicProperty("gm:taslak"), undefined, "taslak üretimden sonra silindi");
});

test("tezgâh: motif boyutu yüzeye göre sınırlanır; motif kanalları ücretlendirilir", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:top_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 5));
  p.container.setItem(2, new ItemStack("minecraft:blue_dye", 5));
  await runBench(p, [
    "beyaz temel", { set: "Bölge 1", value: D("blue") + 1 },
    "Motif düzenleyici", "Yeni motif ekle", "Vektör", "Yıldız",
    { set: "Boyut", value: 300 }, { set: "Açı", value: 45 }, "Tamam", "Geri", "Kaydet ve üret",
  ]);
  assert.equal(dyeCount(p, "blue"), 4);
  assert.equal(dyeCount(p, "red"), 4);
  const d = readCloth(findItem(p, "gm:top"));
  const m = d.motifs[0];
  const sh = DATA.SHAPES.top[d.shape];
  const s = sh.surfaces[m.f];
  const half = (sh.motifSize / 2) * (m.s / 100) * (Math.abs(Math.cos(Math.PI / 4)) + Math.abs(Math.sin(Math.PI / 4)));
  assert.equal(m.r, 45);
  assert.ok(m.s < 300 && m.s >= 50, `ölçek sınırlandı: ${m.s}`);
  assert.ok(half * 2 <= Math.min(s.A, s.B) + 1e-6, "döndürülmüş motif yüzeye sığıyor");
  assert.equal(m.w, m.s);
});

test("tezgâh: tamamlanmış giysi yalnızca yeni motif kabul eder ve yalnızca onu ücretlendirir", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:hat_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 6));
  await runBench(p, ["beyaz temel", { set: "Renk şablonu", value: 1 }, { set: "Bölge 1", value: D("red") + 1 }, { set: "Bölge 2", value: D("red") + 1 }, "Kaydet ve üret"]);
  assert.equal(dyeCount(p), 4);
  ui.forms.length = 0;
  await runBench(p, ["Bere", "Motif düzenleyici", "Yeni motif ekle", "Vektör", "Kalp", "Tamam", "Geri", "Kaydet ve üret"]);
  const main = ui.forms.find((f) => f.title === "Giysi Tezgâhı");
  assert.equal(main.find("dropdown", "Bölge 1").options.disabled, true, "renk hazneleri kilitli");
  assert.equal(main.find("dropdown", "Renk şablonu").options.disabled, true, "şablon kilitli");
  assert.equal(dyeCount(p), 3, "yalnızca yeni motifin tek kanalı ücretlendirildi");
  const d = readCloth(findItem(p, "gm:hat"));
  assert.deepEqual(d.colors, [D("red"), D("red")]);
  assert.equal(d.motifs.length, 1);
});

test("tezgâh: oyun içi çizim her farklı rengi bir boya sayar ve hücreleri saklar", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:top_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 3));
  p.container.setItem(2, new ItemStack("minecraft:blue_dye", 3));
  const drawIdx = DATA.TEMPLATES.length;
  await runBench(p, [
    "beyaz temel", { set: "Renk şablonu", value: drawIdx }, "Çizim fırçası",
    { set: "Fırça rengi", value: D("red") }, "Boya",
    { set: "Sütun", value: 3 }, { set: "Satır", value: 6 }, { set: "Fırça boyu", value: 1 }, { set: "Fırça rengi", value: D("blue") }, "Boya",
    "Geri", "Kaydet ve üret",
  ]);
  assert.equal(dyeCount(p, "red"), 2);
  assert.equal(dyeCount(p, "blue"), 2);
  const d = readCloth(findItem(p, "gm:top"));
  assert.equal(d.tpl, DATA.DRAW_TEMPLATE);
  const counts = {};
  for (const ch of d.draw) counts[ch] = (counts[ch] ?? 0) + 1;
  assert.equal(counts[(D("red") + 1).toString(17)], 1, "bir kırmızı hücre");
  assert.equal(counts[(D("blue") + 1).toString(17)], 4, "2×2 mavi fırça");
});

test("tezgâh: taslağı sil hiçbir şey tüketmez", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:pants_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 2));
  await runBench(p, ["beyaz temel", { set: "Bölge 1", value: D("red") + 1 }, "Taslağı sil"]);
  assert.equal(dyeCount(p), 2);
  assert.ok(findItem(p, "gm:pants_base"));
  assert.equal(p.getDynamicProperty("gm:taslak"), undefined);
});

test("tezgâh: boya yetersizse üretilmez", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:shoes_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 1));
  await runBench(p, ["beyaz temel", { set: "Renk şablonu", value: 6 }, { set: "Bölge 1", value: D("red") + 1 }, { set: "Bölge 2", value: D("red") + 1 }, "Kaydet ve üret", null]);
  assert.equal(dyeCount(p), 1);
  assert.ok(findItem(p, "gm:shoes_base"));
  assert.ok(p.messages.some((m) => m.includes("yetersiz")));
});

test("tezgâh: kilitli şekil seçilemez", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:hat_base"));
  ui.forms.length = 0;
  await runBench(p, ["beyaz temel", { set: "Şekil", value: 5 }, null]);
  const main = ui.forms.find((f) => f.title === "Giysi Tezgâhı");
  assert.equal(main.find("dropdown", "Şekil").obs.getData(), 0, "seçim geri alındı");
});

test("Atölye: paketin bildirdiği tasarım şablon listesine girer, renkleri ücretlendirilir", async () => {
  system.afterEvents.scriptEventReceive.fire({ id: "gm:atolye", message: JSON.stringify({ kiyafet: [{ cat: "top", shape: 0, slot: 1, ad: "Benim tasarımım", boyalar: [D("red"), D("white"), D("blue")] }], foto: [{ slot: 0, ad: "Kedim", boyalar: [D("black")] }] }) });
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:top_base"));
  for (const [k, id] of ["red", "white", "blue", "black"].entries()) p.container.setItem(k + 1, new ItemStack(`minecraft:${id}_dye`, 2));
  ui.forms.length = 0;
  await runBench(p, ["beyaz temel", { set: "Renk şablonu", value: DATA.TEMPLATES.length + 1 }, "Motif düzenleyici", "Yeni motif ekle", "Foto", "Kedim", "Tamam", "Geri", "Kaydet ve üret"]);
  const items = ui.forms.find((f) => f.title === "Giysi Tezgâhı").find("dropdown", "Renk şablonu").items;
  assert.ok(items.some((i) => i.label.includes("Atölye: Benim tasarımım")));
  assert.equal(dyeCount(p), 4, "kırmızı, beyaz, mavi (Atölye) + siyah (foto) birer adet");
  const d = readCloth(findItem(p, "gm:top"));
  assert.equal(d.tpl, DATA.ATOLYE_TEMPLATE + 1);
  assert.equal(DATA.MOTIFS[d.motifs[0].i].kind, "photo");
});

test("veri aktarımı: taslak yalnızca tasarlayana, giyili hâl diğerlerine gider", async () => {
  const { syncPreview, endPreview, syncWorn, isDesigning } = await import(S + "sync.js");
  const p = newPlayer(), q = newPlayer();
  p.animations.length = 0;
  const d = { cat: "top", shape: 0, tpl: 24, colors: [...Array(16).keys()], motifs: [{ i: 0, f: 0, x: 3, y: 4, s: 120, w: 120, h: 120, r: 90, c: [1] }] };
  syncPreview(p, "t", d, {}, 0);
  assert.ok(isDesigning(p));
  const prev = p.animations.filter((a) => a.players?.length === 1 && a.players[0] === p).map((a) => a.stopExpression).join("");
  assert.match(prev, /v\.gmts=1;/);
  assert.match(prev, /v\.gmtt=24;/);
  assert.match(prev, /v\.gmtm0w=120;/);
  assert.match(prev, /v\.gmtm0r=90;/);
  p.animations.length = 0;
  syncWorn(p, {}, {}, 0);
  assert.ok(p.animations.length > 0);
  assert.ok(p.animations.every((a) => a.players && !a.players.includes(p) && a.players.includes(q)), "tasarlayan kendi taslağını görmeye devam eder");
  endPreview(p);
  assert.ok(!isDesigning(p));
  for (const a of p.animations) assert.ok(a.stopExpression.endsWith("return 1;") && a.stopExpression.length < 1500);
});
