// Yere yerleştirilen çanta: içerik varlığın envanterinde (dünya kaydında) tutulur, giydirmez.
import { world, system, ItemStack, Direction } from "@minecraft/server";
import { DATA } from "./data.js";
import {
  isBag, isCloth, readCloth, bagContainer, ensureBagId, bagColor, setEvac, giveOrDrop,
} from "./cloth.js";

const BAG_ENTITY = "gm:placed_bag";
const OFFSET = {
  [Direction.Up]: [0, 1, 0], [Direction.Down]: [0, -1, 0], [Direction.North]: [0, 0, -1],
  [Direction.South]: [0, 0, 1], [Direction.East]: [1, 0, 0], [Direction.West]: [-1, 0, 0],
};
const open = new Map(); // entity.id → { entity, player, snapshot: string[] }

function placeBag(player, block, face) {
  const inv = player.getComponent("minecraft:inventory")?.container;
  const slot = player.selectedSlotIndex;
  const item = inv?.getItem(slot);
  if (!isBag(item)) return;
  const color = bagColor(item);
  const { id } = ensureBagId(item);
  const src = bagContainer(item);
  const contents = [];
  if (src) for (let j = 0; j < src.size; j++) contents.push(src.getItem(j));
  const [dx, dy, dz] = OFFSET[face] ?? [0, 1, 0];
  const loc = { x: block.location.x + dx + 0.5, y: block.location.y + dy, z: block.location.z + dz + 0.5 };
  // Önce eşya elden alınır, sonra varlık oluşturulur: aynı içeriğin iki kopyası oluşamaz.
  inv.setItem(slot, undefined);
  let entity;
  try {
    entity = player.dimension.spawnEntity(BAG_ENTITY, loc);
  } catch (e) {
    inv.setItem(slot, item);
    player.sendMessage(`§cÇanta buraya yerleştirilemedi.`);
    return;
  }
  entity.setProperty("gm:color", Math.max(0, color));
  entity.setDynamicProperty("gm:bid", id);
  entity.setRotation({ x: 0, y: player.getRotation().y + 180 });
  const ec = entity.getComponent("minecraft:inventory")?.container;
  contents.forEach((it, j) => it && ec?.setItem(j, it));
}

export function breakBag(entity, player) {
  if (!entity.isValid) return;
  const ec = entity.getComponent("minecraft:inventory")?.container;
  const color = entity.getProperty("gm:color") ?? 0;
  const bag = new ItemStack(`gm:bag_${DATA.DYES[color].id}`, 1);
  const bc = bagContainer(bag);
  let any = false;
  if (ec) {
    for (let j = 0; j < ec.size; j++) {
      const it = ec.getItem(j);
      if (!it) continue;
      if (bc && j < bc.size) {
        bc.setItem(j, it);
        any = true;
      } else {
        // Çanta kabı okunamazsa içerik kaybolmasın diye ayrı düşürülür.
        entity.dimension.spawnItem(it, entity.location);
      }
    }
    ec.clearAll();
  }
  const bid = entity.getDynamicProperty("gm:bid");
  if (typeof bid === "string") bag.setDynamicProperty("gm:bid", bid);
  // Yerden alınınca dolu çanta tahliye kuralı uygulanır.
  if (any) setEvac(bag, true);
  const loc = entity.location;
  const dim = entity.dimension;
  open.delete(entity.id);
  entity.remove();
  dim.spawnItem(bag, { x: loc.x, y: loc.y + 0.3, z: loc.z });
}

// Yerdeki çanta: yalnızca bitmiş giysi, her türden bir tane. Önceden bulunan öncelikli.
function enforce(entity, player) {
  const ec = entity.getComponent("minecraft:inventory")?.container;
  if (!ec) return;
  const rec = open.get(entity.id);
  const prev = rec?.snapshot ?? [];
  const items = [];
  for (let j = 0; j < ec.size; j++) items.push(ec.getItem(j));
  const eject = (j, msg) => {
    const it = items[j];
    ec.setItem(j, undefined);
    items[j] = undefined;
    if (player?.isValid) {
      giveOrDrop(player, it);
      player.onScreenDisplay.setActionBar(msg);
    } else entity.dimension.spawnItem(it, entity.location);
  };
  for (let j = 0; j < items.length; j++) {
    const it = items[j];
    if (it && (!isCloth(it) || !readCloth(it))) eject(j, "§eÇantaya yalnızca tamamlanmış giysi konabilir.");
  }
  const byCat = new Map();
  const order = [...items.keys()].sort((a, b) => {
    const da = items[a] && readCloth(items[a]);
    const db = items[b] && readCloth(items[b]);
    const pa = da && prev.includes(da.id) ? 0 : 1;
    const pb = db && prev.includes(db.id) ? 0 : 1;
    return pa - pb || a - b;
  });
  for (const j of order) {
    const d = items[j] && readCloth(items[j]);
    if (!d) continue;
    if (byCat.has(d.cat)) eject(j, "§eBu çantada aynı türden giysi zaten var.");
    else byCat.set(d.cat, d.id);
  }
  if (rec) rec.snapshot = [...byCat.values()];
}

export function initPlaced(registry) {
  registry.registerCustomComponent("gm:bag", {
    onUseOn(e) {
      const player = e.source;
      if (player?.typeId !== "minecraft:player") return;
      const { block, blockFace } = e;
      system.run(() => placeBag(player, block, blockFace));
    },
  });
}

export function initPlacedEvents() {
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (hitEntity?.typeId !== BAG_ENTITY || damagingEntity?.typeId !== "minecraft:player") return;
    breakBag(hitEntity, damagingEntity);
  });
  world.afterEvents.entityContainerOpened.subscribe(({ entity, openSource }) => {
    if (entity?.typeId !== BAG_ENTITY) return;
    const ec = entity.getComponent("minecraft:inventory")?.container;
    const snapshot = [];
    if (ec) for (let j = 0; j < ec.size; j++) {
      const d = readCloth(ec.getItem(j));
      if (d) snapshot.push(d.id);
    }
    open.set(entity.id, { entity, player: openSource?.entity, snapshot });
  });
  world.afterEvents.entityContainerClosed.subscribe(({ entity, closeSource }) => {
    if (entity?.typeId !== BAG_ENTITY) return;
    if (entity.isValid) enforce(entity, closeSource?.entity ?? open.get(entity.id)?.player);
    open.delete(entity.id);
  });
  system.runInterval(() => {
    for (const [id, rec] of open) {
      if (!rec.entity.isValid) {
        open.delete(id);
        continue;
      }
      enforce(rec.entity, rec.player);
    }
  }, 4);
}
