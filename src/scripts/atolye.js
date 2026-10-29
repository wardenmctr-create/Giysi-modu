// Atölye kayıtları: Atölye sayfasının ürettiği paket, dünya açılınca "gm:atolye" script olayıyla
// kendi tasarımlarını bildirir. Doku dosyaları paketten gelir; burada yalnızca adlar ve boya maliyetleri tutulur.
import { world } from "@minecraft/server";
import { DATA } from "./data.js";

const KEY = "gm:atolye";

export function atolyeData() {
  try {
    const d = JSON.parse(String(world.getDynamicProperty(KEY) ?? "{}"));
    return { kiyafet: d.kiyafet ?? [], foto: d.foto ?? [] };
  } catch {
    return { kiyafet: [], foto: [] };
  }
}

const dyeList = (a) => (Array.isArray(a) ? [...new Set(a.filter((n) => Number.isInteger(n) && n >= 0 && n < DATA.DYES.length))] : []);
const name = (s, d) => (typeof s === "string" && s.trim() ? s.trim().slice(0, 32) : d);

// Doğrulanmış kayıtları saklar; hatalı alanlar yok sayılır.
export function registerAtolye(message) {
  let d;
  try {
    d = JSON.parse(message);
  } catch {
    return 0;
  }
  const kiyafet = (d.kiyafet ?? []).filter((k) =>
    DATA.CATEGORIES.some((c) => c.id === k.cat) &&
    Number.isInteger(k.shape) && DATA.SHAPES[k.cat]?.[k.shape]?.built >= 0 &&
    Number.isInteger(k.slot) && k.slot >= 0 && k.slot < DATA.ATOLYE.clothSlots,
  ).map((k) => ({ cat: k.cat, shape: k.shape, slot: k.slot, ad: name(k.ad, `Atölye ${k.slot + 1}`), boyalar: dyeList(k.boyalar) }));
  const foto = (d.foto ?? []).filter((f) => Number.isInteger(f.slot) && f.slot >= 0 && f.slot < DATA.ATOLYE.photoSlots)
    .map((f) => ({ slot: f.slot, ad: name(f.ad, `Foto ${f.slot + 1}`), boyalar: dyeList(f.boyalar) }));
  world.setDynamicProperty(KEY, JSON.stringify({ kiyafet, foto }));
  return kiyafet.length + foto.length;
}

export function clothSlotsFor(cat, shape) {
  return atolyeData().kiyafet.filter((k) => k.cat === cat && k.shape === shape);
}

export function photoSlot(slot) {
  return atolyeData().foto.find((f) => f.slot === slot);
}
