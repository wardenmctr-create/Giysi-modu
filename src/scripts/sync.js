// Script verisini istemci Molang değişkenlerine aktarır.
// Yöntem: boş "animation.gm.sync" animasyonu playAnimation ile oynatılır; stopExpression içindeki
// atamalar istemcide çalışır ve "return 1" ile animasyon hemen biter.
import { world } from "@minecraft/server";
import { DATA } from "./data.js";
import { dyeRgb } from "./cloth.js";

const MCH = ["a", "b", "c"];
const CHUNK = 48;

// prefix "gm" = giyili, "gq" = önizleme. d = giysi verisi veya null.
export function clothAssignments(prefix, catKey, d) {
  const p = `v.${prefix}${catKey}`;
  if (!d) return [`${p}s=0`];
  const shape = DATA.SHAPES[d.cat][d.shape];
  const out = [`${p}s=${shape.built + 1}`, `${p}t=${d.tpl}`];
  for (let r = 0; r < DATA.LIMITS.maxRegions; r++) out.push(`${p}k${r}=${dyeRgb(d.colors[r] ?? -1)}`);
  for (let m = 0; m < DATA.LIMITS.maxMotifs; m++) {
    const mo = d.motifs[m];
    if (!mo) {
      out.push(`${p}m${m}i=0`);
      continue;
    }
    out.push(`${p}m${m}i=${mo.i + 1}`, `${p}m${m}f=${mo.f}`, `${p}m${m}x=${mo.x}`, `${p}m${m}y=${mo.y}`);
    for (let ch = 0; ch < 3; ch++) out.push(`${p}m${m}${MCH[ch]}=${dyeRgb(mo.c[ch] ?? -1)}`);
  }
  return out;
}

export function send(entity, assignments, tag, players) {
  for (let i = 0, n = 0; i < assignments.length; i += CHUNK, n++) {
    const expr = assignments.slice(i, i + CHUNK).join(";") + ";return 1;";
    const opts = { stopExpression: expr, controller: `gm_sync_${tag}_${n}` };
    if (players) opts.players = players;
    try {
      entity.playAnimation("animation.gm.sync", opts);
    } catch (e) {
      console.warn(`[Giysi] playAnimation başarısız: ${e}`);
    }
  }
}

// Giyili durum: worn = { hat: clothData|null, ... }, armor = { h:0/1 ... }, slim = 0/1
export function syncWorn(player, worn, armor, slim, players) {
  for (const c of DATA.CATEGORIES) {
    const a = clothAssignments("gm", c.key, worn[c.id] ?? null);
    a.push(`v.gma${c.key}=${armor[c.key] ? 1 : 0}`);
    if (c.key === "h") a.push(`v.gmslim=${slim ? 1 : 0}`);
    send(player, a, c.key, players);
  }
}

export function syncPreview(player, catKey, d, yaw) {
  const a = d ? clothAssignments("gq", catKey, d) : [];
  a.push(`v.gq${catKey}on=${d ? 1 : 0}`, `v.gqyaw=${yaw ?? 0}`);
  send(player, a, `p${catKey}`, [player]);
}

export function allPlayers() {
  return world.getAllPlayers();
}
