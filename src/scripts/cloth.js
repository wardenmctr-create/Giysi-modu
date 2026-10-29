// Giysi ve çanta verisi yardımcıları.
import { ItemStack, world } from "@minecraft/server";
import { DATA } from "./data.js";

export const CAT_BY_ITEM = new Map();
export const CAT_BY_BASE = new Map();
export const CAT_BY_ID = new Map();
for (const c of DATA.CATEGORIES) {
  CAT_BY_ITEM.set(c.item, c);
  CAT_BY_BASE.set(c.baseItem, c);
  CAT_BY_ID.set(c.id, c);
}

const DATA_KEY = "gm:d";
const BAG_ID_KEY = "gm:bid";
const EVAC_KEY = "gm:evac";

export const isBag = (item) => !!item && item.typeId.startsWith("gm:bag_");
export const isCloth = (item) => !!item && CAT_BY_ITEM.has(item.typeId);
export const isBase = (item) => !!item && CAT_BY_BASE.has(item.typeId);
export const bagColor = (item) => DATA.DYES.findIndex((d) => `gm:bag_${d.id}` === item.typeId);

// Boya eşyaları → boya sırası. Vanilla'daki eşdeğer boyalar da kabul edilir.
export const DYE_ITEMS = new Map();
DATA.DYES.forEach((d, i) => DYE_ITEMS.set(`minecraft:${d.id}_dye`, i));
DYE_ITEMS.set("minecraft:ink_sac", 15);
DYE_ITEMS.set("minecraft:lapis_lazuli", 11);
DYE_ITEMS.set("minecraft:cocoa_beans", 12);
DYE_ITEMS.set("minecraft:bone_meal", 0);

export function newId(prefix) {
  const n = Number(world.getDynamicProperty("gm:seq") ?? 0) + 1;
  world.setDynamicProperty("gm:seq", n);
  return `${prefix}${n.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// Şablon sırası: 0..24 ortak şablonlar, 25 oyun içi çizim, 26.. Atölye yuvaları.
export function templateName(tpl) {
  if (tpl < DATA.TEMPLATES.length) return DATA.TEMPLATES[tpl].name;
  if (tpl === DATA.DRAW_TEMPLATE) return "Çizim";
  return `Atölye ${tpl - DATA.ATOLYE_TEMPLATE + 1}`;
}

export function templateRegions(tpl) {
  return tpl < DATA.TEMPLATES.length ? DATA.TEMPLATES[tpl].regions : tpl === DATA.DRAW_TEMPLATE ? 1 : 0;
}

// Motif ölçeği: s (yüzde), şekillerde en w ve boy h ayrı; r açı (derece).
export function normalizeMotif(m) {
  const s = m.s ?? 100;
  return { i: m.i, f: m.f ?? 0, x: m.x ?? 7, y: m.y ?? 7, c: m.c ?? [], s, w: m.w ?? s, h: m.h ?? s, r: m.r ?? 0 };
}

// Giysi verisi: { v, id, cat, shape, tpl, colors[], motifs[{i,f,x,y,c[],s,w,h,r}], draw?, done }
export function readCloth(item) {
  if (!isCloth(item)) return undefined;
  const raw = item.getDynamicProperty(DATA_KEY);
  if (typeof raw !== "string") return undefined;
  try {
    const d = JSON.parse(raw);
    if (!d || !d.done) return undefined;
    d.motifs = (d.motifs ?? []).map(normalizeMotif);
    return d;
  } catch {
    return undefined;
  }
}

export function writeCloth(item, d) {
  item.setDynamicProperty(DATA_KEY, JSON.stringify(d));
  const cat = CAT_BY_ID.get(d.cat);
  const shape = DATA.SHAPES[d.cat][d.shape];
  item.nameTag = `§r${shape.name}`;
  item.setLore([
    `§7${cat.name} · ${templateName(d.tpl)}`,
    `§7Motif: ${d.motifs.length}/${DATA.LIMITS.maxMotifs}`,
  ]);
}

export function createClothItem(d) {
  const cat = CAT_BY_ID.get(d.cat);
  const item = new ItemStack(cat.item, 1);
  writeCloth(item, d);
  return item;
}

export function bagContainer(bag) {
  try {
    return bag.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

export function bagId(bag) {
  return bag.getDynamicProperty(BAG_ID_KEY);
}

export function ensureBagId(bag) {
  let id = bag.getDynamicProperty(BAG_ID_KEY);
  if (typeof id !== "string") {
    id = newId("b");
    bag.setDynamicProperty(BAG_ID_KEY, id);
    return { id, changed: true };
  }
  return { id, changed: false };
}

export const getEvac = (bag) => bag.getDynamicProperty(EVAC_KEY) === true;
export const setEvac = (bag, v) => bag.setDynamicProperty(EVAC_KEY, v ? true : undefined);

export function bagHasContents(bag) {
  const c = bagContainer(bag);
  if (!c) return false;
  for (let i = 0; i < c.size; i++) if (c.getItem(i)) return true;
  return false;
}

// Oyuncuya eşya verir; sığmayanı yanına bırakır.
export function giveOrDrop(player, item) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const left = inv ? inv.addItem(item) : item;
  if (left) player.dimension.spawnItem(left, player.location);
}

export function dyeRgb(idx) {
  return idx >= 0 ? DATA.DYES[idx].rgb : 0;
}
