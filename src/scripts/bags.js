// Giyinme motoru: oyuncunun taşıdığı tüm çantalar birlikte değerlendirilir, her türden yalnızca bir giysi giyilir.
import { world, system, EquipmentSlot } from "@minecraft/server";
import { DATA } from "./data.js";
import {
  isBag, isCloth, readCloth, bagContainer, ensureBagId, bagId, getEvac, setEvac, bagHasContents, giveOrDrop,
} from "./cloth.js";
import { syncWorn } from "./sync.js";

const STATE_KEY = "gm:worn";
const SLIM_KEY = "gm:slim";
const states = new Map(); // player.id → durum
const pendingEvac = new Map(); // player.id → Set(bagId): yerden alınan dolu çantalar
export const stats = { lastScanMs: 0, maxScanMs: 0, scans: 0 };

function loadState(player) {
  let s = states.get(player.id);
  if (s) return s;
  let worn = {};
  try {
    worn = JSON.parse(player.getDynamicProperty(STATE_KEY) ?? "{}");
  } catch {
    worn = {};
  }
  let seq = 0;
  for (const w of Object.values(worn)) if (w) seq = Math.max(seq, w.order ?? 0);
  s = { worn, data: {}, armor: {}, slim: player.getDynamicProperty(SLIM_KEY) === 1 ? 1 : 0, sig: "", seq };
  states.set(player.id, s);
  return s;
}

function saveState(player, s) {
  player.setDynamicProperty(STATE_KEY, JSON.stringify(s.worn));
}

export function getState(player) {
  return loadState(player);
}

export function setSlim(player, slim) {
  const s = loadState(player);
  s.slim = slim ? 1 : 0;
  player.setDynamicProperty(SLIM_KEY, s.slim);
  s.sig = "";
}

const ARMOR_SLOTS = { h: EquipmentSlot.Head, t: EquipmentSlot.Chest, p: EquipmentSlot.Legs, s: EquipmentSlot.Feet };

function readArmor(player) {
  const eq = player.getComponent("minecraft:equippable");
  const out = {};
  for (const [k, slot] of Object.entries(ARMOR_SLOTS)) {
    try {
      out[k] = eq?.getEquipment(slot) ? 1 : 0;
    } catch {
      out[k] = 0;
    }
  }
  return out;
}

export function scanPlayer(player) {
  const t0 = Date.now();
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  const s = loadState(player);
  const pending = pendingEvac.get(player.id);
  const toGive = [];
  const bags = [];
  const found = [];
  let notice = "";

  for (let slot = 0; slot < inv.size; slot++) {
    const item = inv.getItem(slot);
    if (!isBag(item)) continue;
    const { id, changed } = ensureBagId(item);
    const c = bagContainer(item);
    const bag = { slot, item, c, id, changed };
    bags.push(bag);
    if (!c) continue;
    if (getEvac(item) || pending?.has(id)) {
      // Yerden alınan dolu çanta: tüm giysiler envantere, sığmayanlar yere; otomatik giyilmez.
      for (let j = 0; j < c.size; j++) {
        const it = c.getItem(j);
        if (it) {
          c.setItem(j, undefined);
          toGive.push(it);
        }
      }
      setEvac(item, false);
      pending?.delete(id);
      bag.changed = true;
      notice = "§eÇantadaki giysiler envantere çıkarıldı.";
      continue;
    }
    for (let j = 0; j < c.size; j++) {
      const it = c.getItem(j);
      if (!it) continue;
      const d = readCloth(it);
      if (!isCloth(it) || !d) {
        c.setItem(j, undefined);
        toGive.push(it);
        bag.changed = true;
        continue;
      }
      found.push({ cat: d.cat, id: d.id, data: d, bag, j, item: it });
    }
  }

  let stateChanged = false;
  const wornIds = new Set();
  for (const cat of DATA.CATEGORIES) {
    const list = found.filter((f) => f.cat === cat.id);
    const cur = s.worn[cat.id];
    let keep = cur ? list.find((f) => f.id === cur.id) : undefined;
    if (!keep && list.length) {
      keep = list[0];
      s.worn[cat.id] = { id: keep.id, bag: keep.bag.id, order: ++s.seq };
      stateChanged = true;
    } else if (!keep && cur) {
      s.worn[cat.id] = null;
      stateChanged = true;
    } else if (keep && cur.bag !== keep.bag.id) {
      cur.bag = keep.bag.id;
      stateChanged = true;
    }
    s.data[cat.id] = keep ? keep.data : null;
    if (keep) wornIds.add(keep.bag.id);
    for (const f of list) {
      if (f === keep) continue;
      // Aynı türden ikinci giysi: önceki giysi önceliklidir, yenisi geri verilir.
      f.bag.c.setItem(f.j, undefined);
      f.bag.changed = true;
      toGive.push(f.item);
      notice = `§eAynı türden ikinci ${cat.name.toLowerCase()} giyilemez; envantere geri verildi.`;
    }
  }

  for (const b of bags) {
    const keepIt = wornIds.has(b.id);
    if (b.item.keepOnDeath !== keepIt) {
      b.item.keepOnDeath = keepIt;
      b.changed = true;
    }
    if (b.changed) inv.setItem(b.slot, b.item);
  }
  for (const it of toGive) giveOrDrop(player, it);
  if (notice) player.onScreenDisplay.setActionBar(notice);
  if (stateChanged) saveState(player, s);

  s.armor = readArmor(player);
  const sig = JSON.stringify([s.worn, s.armor, s.slim, Object.values(s.data).map((d) => d && d.motifs.length)]);
  if (sig !== s.sig) {
    s.sig = sig;
    syncWorn(player, s.data, s.armor, s.slim);
  }
  const ms = Date.now() - t0;
  stats.lastScanMs = ms;
  stats.maxScanMs = Math.max(stats.maxScanMs, ms);
  stats.scans++;
}

// Tasarım bitince oyuncunun kendi istemcisine giyili hâli yeniden gönderir.
export function refreshSelf(player) {
  const s = loadState(player);
  s.sig = "";
  syncWorn(player, s.data, s.armor, s.slim, [player]);
}

// Görünüm tazeleme: menzile yeni giren oyuncular değişkenleri kaçırmış olabilir.
export function resyncAll(target) {
  for (const p of world.getAllPlayers()) {
    const s = loadState(p);
    syncWorn(p, s.data, s.armor, s.slim, target ? [target] : undefined);
  }
}

export function initBags() {
  system.runInterval(() => {
    for (const p of world.getAllPlayers()) {
      try {
        scanPlayer(p);
      } catch (e) {
        console.warn(`[Giysi] tarama hatası: ${e}`);
      }
    }
  }, 10);
  system.runInterval(() => resyncAll(), 100);

  world.beforeEvents.entityItemPickup.subscribe((e) => {
    if (e.entity.typeId !== "minecraft:player") return;
    const stack = e.item.getComponent("minecraft:item")?.itemStack;
    if (!isBag(stack) || !bagHasContents(stack)) return;
    const id = bagId(stack);
    if (typeof id !== "string") return;
    // Yalnızca script belleği değişir; dünya değişikliği olmadığı için before olayında güvenli.
    const pid = e.entity.id;
    if (!pendingEvac.has(pid)) pendingEvac.set(pid, new Set());
    pendingEvac.get(pid).add(id);
  });

  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    const s = loadState(player);
    s.sig = "";
    system.runTimeout(() => {
      if (!player.isValid) return;
      scanPlayer(player);
      if (initialSpawn) resyncAll(player);
    }, 20);
  });

  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    states.delete(playerId);
    pendingEvac.delete(playerId);
  });
}
