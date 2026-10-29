// Giysi Modu giriş noktası.
import { world, system, ItemStack } from "@minecraft/server";
import { DATA } from "./data.js";
import { createClothItem, newId, bagContainer, ensureBagId, giveOrDrop } from "./cloth.js";
import { initBags, getState, stats, resyncAll } from "./bags.js";
import { initBench } from "./bench.js";
import { initPlaced, initPlacedEvents } from "./placed.js";
import { registerAtolye } from "./atolye.js";

system.beforeEvents.startup.subscribe((e) => {
  initBench(e.blockComponentRegistry);
  initPlaced(e.itemComponentRegistry);
});

world.afterEvents.worldLoad.subscribe(() => {
  initBags();
  initPlacedEvents();
});

// Doğrulama kapısı test komutları: /scriptevent gm:kit | gm:yogun | gm:durum | gm:olcum
const TPL16 = DATA.TEMPLATES.findIndex((t) => t.regions === 16);

function densest(cat) {
  const shape = DATA.SHAPES[cat.id].findIndex((s) => s.built >= 0);
  const surfaces = DATA.SHAPES[cat.id][shape].surfaces.length;
  const three = DATA.MOTIFS.map((m, i) => (m.ch === 3 ? i : -1)).filter((i) => i >= 0);
  const motifs = [];
  for (let m = 0; m < DATA.LIMITS.maxMotifs; m++) {
    motifs.push({ i: three[m % three.length], f: m % surfaces, x: (m * 5) % 16, y: (m * 3) % 16, s: 100, w: 100, h: 100, r: (m * 90) % 360, c: [m % 16, (m + 5) % 16, (m + 10) % 16] });
  }
  return {
    v: 1, id: newId("c"), cat: cat.id, shape, tpl: TPL16,
    colors: Array.from({ length: 16 }, (_, r) => r), motifs, done: true,
  };
}

system.afterEvents.scriptEventReceive.subscribe((e) => {
  // Atölye paketi kendi tasarımlarını bildirir (oyuncu kaynağı olmadan, dünya açılışında).
  if (e.id === "gm:atolye") {
    const n = registerAtolye(e.message);
    console.warn(`[Giysi] Atölye kaydı: ${n} tasarım`);
    return;
  }
  const player = /** @type {import("@minecraft/server").Player} */ (e.sourceEntity);
  if (player?.typeId !== "minecraft:player") return;
  switch (e.id) {
    case "gm:mod": {
      // Renklendirme yöntemi: a = düz maske + gölge katmanı, b = gölgeli maske + çarpım
      const b = e.message.trim().toLowerCase() === "b";
      world.setDynamicProperty("gm:mod", b ? 1 : 0);
      resyncAll();
      player.sendMessage(`§bRenklendirme yöntemi: ${b ? "B (çarpım)" : "A (düz + gölge katmanı)"}`);
      break;
    }
    case "gm:kit": {
      giveOrDrop(player, new ItemStack("gm:workbench", 1));
      for (const c of DATA.CATEGORIES) giveOrDrop(player, new ItemStack(c.baseItem, 1));
      for (const id of ["red", "blue", "yellow"]) giveOrDrop(player, new ItemStack(`gm:bag_${id}`, 1));
      for (const d of DATA.DYES) giveOrDrop(player, new ItemStack(`minecraft:${d.id}_dye`, 32));
      player.sendMessage("§aTest seti verildi.");
      break;
    }
    case "gm:yogun": {
      // En yoğun kombinasyon: 4 giysi × 16 bölge × 16 üç renkli motif, tek çantada.
      const bag = new ItemStack("gm:bag_purple", 1);
      ensureBagId(bag);
      const c = bagContainer(bag);
      if (!c) {
        player.sendMessage("§cÇanta kabına erişilemedi (ItemInventoryComponent).");
        break;
      }
      DATA.CATEGORIES.forEach((cat, j) => c.setItem(j, createClothItem(densest(cat))));
      giveOrDrop(player, bag);
      player.sendMessage("§aEn yoğun giysi çantası verildi.");
      break;
    }
    case "gm:durum": {
      const s = getState(player);
      const lines = DATA.CATEGORIES.map((c) => {
        const d = s.data[c.id];
        return `${c.name}: ${d ? `${DATA.SHAPES[c.id][d.shape].name} / ${DATA.TEMPLATES[d.tpl].name} / ${d.motifs.length} motif` : "-"}`;
      });
      player.sendMessage(`§b${lines.join("\n")}\nZırh: ${JSON.stringify(s.armor)} İnce kol: ${s.slim}`);
      break;
    }
    case "gm:olcum": {
      player.sendMessage(`§bTarama: son ${stats.lastScanMs} ms, en yüksek ${stats.maxScanMs} ms, ${stats.scans} tarama`);
      stats.maxScanMs = 0;
      break;
    }
    case "gm:tazele":
      resyncAll();
      break;
  }
});
