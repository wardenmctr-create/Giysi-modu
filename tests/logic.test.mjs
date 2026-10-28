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

test("katalog: 4×25 şekil, 25 şablon, 50 motif", () => {
  for (const c of DATA.CATEGORIES) assert.equal(DATA.SHAPES[c.id].length, 25);
  assert.equal(DATA.TEMPLATES.length, 25);
  assert.equal(DATA.MOTIFS.length, 50);
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

function dyeCount(p) {
  let n = 0;
  for (let i = 0; i < 36; i++) { const it = p.container.getItem(i); if (it?.typeId.endsWith("_dye")) n += it.amount; }
  return n;
}

test("tezgâh: iptal hiçbir şey tüketmez", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:top_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 5));
  ui.answers = ["beyaz temel", "Kısa kollu tişört", "Üst–alt", "Bölge 1", "Kırmızı", "İptal"];
  await comps["gm:workbench"].onPlayerInteract({ player: p });
  await system.tick(2);
  for (let i = 0; i < 20; i++) await system.tick(1);
  assert.equal(dyeCount(p), 5);
  assert.equal(p.container.getItem(0)?.typeId, "gm:top_base");
  assert.ok(p.animations.some((a) => a.players?.[0] === p && a.stopExpression.includes("v.gqton=0")), "önizleme kapatılır");
});

async function runBench(p) {
  await comps["gm:workbench"].onPlayerInteract({ player: p });
  for (let i = 0; i < 30; i++) await system.tick(1);
}

test("tezgâh: tamamla yalnızca gereken boyaları tüketir; yeniden açılan giysi yalnızca motif kabul eder", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:hat_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 5));
  p.container.setItem(2, new ItemStack("minecraft:blue_dye", 5));
  ui.answers = [
    "beyaz temel", "Bere", "Üst–alt", "Bölge 1", "Kırmızı", "Bölge 2", "Kırmızı",
    "Motif düzenleyici", "Yeni motif", "Kalp", "Mavi", "Ön", "Sağa", "Tamam", "Geri", "Tamamla",
  ];
  await runBench(p);
  assert.equal(dyeCount(p), 7, "2 bölge + 1 motif kanalı = 3 boya");
  const slot = [...Array(36).keys()].find((i) => p.container.getItem(i)?.typeId === "gm:hat");
  const d = readCloth(p.container.getItem(slot));
  assert.deepEqual(d.colors, [14, 14]);
  assert.equal(d.motifs.length, 1);
  assert.equal(d.motifs[0].x, 8);
  assert.ok(![...Array(36).keys()].some((i) => p.container.getItem(i)?.typeId === "gm:hat_base"), "temel giysi tüketildi");
  // Yeniden tezgâh: bölge hazneleri yok, yalnızca motif eklenir ve yalnızca o ücretlendirilir.
  ui.shown.length = 0;
  ui.answers = ["Bere", "Motif düzenleyici", "Yeni motif", "Kedi", "Mavi", "Mavi", "Kırmızı", "Arka", "Tamam", "Geri", "Tamamla"];
  await runBench(p);
  const design = ui.shown.find((f) => f.title.includes("Giysi Tezgâhı") && f.buttons.some((b) => b.includes("Tamamla")));
  assert.ok(!design.buttons.some((b) => b.startsWith("Bölge")), "renk hazneleri kapalı");
  assert.equal(dyeCount(p), 4);
  const d2 = readCloth(p.container.getItem(slot));
  assert.deepEqual(d2.colors, [14, 14]);
  assert.equal(d2.motifs.length, 2);
  assert.deepEqual(d2.motifs[0], d.motifs[0]);
});

test("tezgâh: boya yetersizse tamamlanmaz", async () => {
  const p = newPlayer();
  p.container.setItem(0, new ItemStack("gm:shoes_base"));
  p.container.setItem(1, new ItemStack("minecraft:red_dye", 1));
  ui.answers = ["beyaz temel", "Alçak spor", "İkili dikey", "Bölge 1", "Kırmızı", "Bölge 2", "Kırmızı", "Tamamla", "İptal"];
  await runBench(p);
  assert.equal(dyeCount(p), 1);
  assert.equal(p.container.getItem(0)?.typeId, "gm:shoes_base");
  assert.ok(p.messages.some((m) => m.includes("yetersiz")));
});

test("veri aktarımı: giyili değişkenler herkese, parçalı stopExpression ile gönderilir", () => {
  const p = newPlayer();
  p.animations.length = 0;
  p.container.setItem(0, bagWith("red", [cloth("top", { tpl: 24, colors: [...Array(16).keys()] })]));
  p.equipment[EquipmentSlot.Chest] = new ItemStack("minecraft:iron_chestplate");
  scanPlayer(p);
  const exprs = p.animations.filter((a) => a.name === "animation.gm.sync" && !a.players).map((a) => a.stopExpression);
  const all = exprs.join("");
  assert.match(all, /v\.gmts=1;/);
  assert.match(all, /v\.gmtt=24;/);
  assert.match(all, new RegExp(`v\\.gmtk15=${DATA.DYES[15].rgb};`));
  assert.match(all, /v\.gmat=1/);
  for (const e of exprs) {
    assert.ok(e.endsWith("return 1;"));
    assert.ok(e.length < 1500, `ifade uzunluğu ${e.length}`);
  }
});
