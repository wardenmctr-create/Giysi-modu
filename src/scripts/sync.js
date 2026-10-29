// Script verisini istemci Molang değişkenlerine aktarır.
// Yöntem: boş "animation.gm.sync" animasyonu playAnimation ile oynatılır; stopExpression içindeki
// atamalar istemcide çalışır ve "return 1" ile animasyon hemen biter.
// Tasarım sırasında tasarlayan oyuncunun KENDİ istemcisine taslak gönderilir; diğer oyuncular giyili hâli görür.
import { world } from "@minecraft/server";
import { DATA } from "./data.js";
import { dyeRgb } from "./cloth.js";

const MCH = ["a", "b", "c"];
const CHUNK = 48;
const designing = new Map(); // player.id → { catKey, design }

export function renderMode() {
  return world.getDynamicProperty("gm:mod") === 1 ? 1 : 0;
}

// Boyanmamış bölge beyaz kumaştır.
const UNDYED = 0xf4f4f4;
const regionRgb = (c) => (c >= 0 && c < DATA.DYES.length ? DATA.DYES[c].rgb : UNDYED);

// Motifin yüzey içindeki ötelemesi (birim): konum 0..15, yüzey ölçüsü ve dönmeye göre taşmadan.
export function motifOffset(shape, mo) {
  const s = shape.surfaces[mo.f] ?? shape.surfaces[0];
  const S0 = shape.motifSize;
  const r = ((mo.r ?? 0) * Math.PI) / 180;
  const ca = Math.abs(Math.cos(r)), sa = Math.abs(Math.sin(r));
  const kx = (mo.w ?? mo.s ?? 100) / 100, ky = (mo.h ?? mo.s ?? 100) / 100;
  const hx = (S0 / 2) * (kx * ca + ky * sa), hy = (S0 / 2) * (kx * sa + ky * ca);
  const u = (mo.x / 7.5 - 1) * Math.max(0, s.A / 2 - hx);
  const v = (1 - mo.y / 7.5) * Math.max(0, s.B / 2 - hy);
  return { slot: s.slot, u: Math.round(u * 1000) / 1000, v: Math.round(v * 1000) / 1000 };
}

export function clothAssignments(catKey, d) {
  const p = `v.gm${catKey}`;
  if (!d) return [`${p}s=0`];
  const shape = DATA.SHAPES[d.cat][d.shape];
  const out = [`${p}s=${shape.built + 1}`, `${p}t=${d.tpl}`];
  const tpl = d.tpl < DATA.TEMPLATES.length ? DATA.TEMPLATES[d.tpl] : null;
  const regions = tpl ? tpl.regions : 1;
  for (let r = 0; r < DATA.LIMITS.maxRegions; r++) out.push(`${p}k${r}=${r < regions ? regionRgb(d.colors?.[r] ?? -1) : 0}`);
  // Kenar parçalarının rengi (şablona göre ana renk, ikinci renk ya da yerinde desen).
  out.push(`${p}e=${tpl && tpl.accent >= 0 && tpl.accent < regions ? regionRgb(d.colors?.[tpl.accent] ?? -1) : 0}`);
  for (let m = 0; m < DATA.LIMITS.maxMotifs; m++) {
    const mo = d.motifs?.[m];
    if (!mo) {
      out.push(`${p}m${m}i=0`);
      continue;
    }
    const w = mo.w ?? mo.s ?? 100, h = mo.h ?? mo.s ?? 100;
    const o = motifOffset(shape, mo);
    out.push(`${p}m${m}i=${mo.i + 1}`, `${p}m${m}f=${o.slot}`, `${p}m${m}u=${o.u}`, `${p}m${m}v=${o.v}`, `${p}m${m}w=${w}`, `${p}m${m}h=${h}`, `${p}m${m}r=${mo.r ?? 0}`);
    for (let ch = 0; ch < 3; ch++) out.push(`${p}m${m}${MCH[ch]}=${dyeRgb(mo.c?.[ch] ?? -1)}`);
  }
  // Oyun içi çizim hücreleri: 0 boş, 1..16 boya
  const cells = shape.draw;
  if (cells?.length && d.tpl === DATA.DRAW_TEMPLATE) {
    const code = d.draw ?? "";
    for (let n = 0; n < cells.length; n++) out.push(`${p}d${n}=${parseInt(code[n] ?? "0", 17) || 0}`);
  }
  return out;
}

export function send(entity, assignments, tag, players) {
  if (players && !players.length) return;
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

function recipientsFor(player, targets) {
  const list = targets ?? world.getAllPlayers();
  // Tasarlayan oyuncu kendi istemcisinde taslağı görür; giyili hâl ona gönderilmez.
  return designing.has(player.id) ? list.filter((p) => p.id !== player.id) : targets;
}

// Giyili durum: worn = { hat: clothData|null, ... }, armor = { h:0/1 ... }, slim = 0/1
export function syncWorn(player, worn, armor, slim, targets) {
  const to = recipientsFor(player, targets);
  for (const c of DATA.CATEGORIES) {
    const a = clothAssignments(c.key, worn[c.id] ?? null);
    a.push(`v.gma${c.key}=${armor[c.key] ? 1 : 0}`);
    if (c.key === "h") a.push(`v.gmslim=${slim ? 1 : 0}`, `v.gmmode=${renderMode()}`);
    send(player, a, c.key, to);
  }
}

// Tasarım önizlemesi: yalnızca tasarlayan oyuncuya; zırh gizlemesi kapalı ki giysi tam görünsün.
export function syncPreview(player, catKey, design, worn, slim, yaw = 0) {
  designing.set(player.id, { catKey });
  for (const c of DATA.CATEGORIES) {
    const d = c.key === catKey ? design : worn[c.id] ?? null;
    const a = clothAssignments(c.key, d);
    a.push(`v.gma${c.key}=0`);
    if (c.key === "h") a.push(`v.gmslim=${slim ? 1 : 0}`, `v.gmmode=${renderMode()}`, `v.gmyaw=${yaw}`);
    send(player, a, `p${c.key}`, [player]);
  }
}

export function endPreview(player) {
  designing.delete(player.id);
  send(player, ["v.gmyaw=0"], "py", [player]);
}

export const isDesigning = (player) => designing.has(player.id);
