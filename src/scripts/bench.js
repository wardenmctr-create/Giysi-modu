// Giysi tezgâhı: şekil, renk şablonu, boya hazneleri ve motif düzenleyici.
// Malzemeler yalnızca "Tamamla" onayında tüketilir; iptal hiçbir şey tüketmez.
import { system } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { DATA } from "./data.js";
import {
  CAT_BY_BASE, CAT_BY_ITEM, DYE_ITEMS, isBase, isCloth, readCloth, writeCloth, createClothItem, newId, giveOrDrop,
} from "./cloth.js";
import { syncPreview } from "./sync.js";
import { getState, setSlim } from "./bags.js";

const PREVIEW = "§g§m§r"; // server_form.json bu işareti görünce canlı önizlemeyi açar
const busy = new Set();
const pad = (n) => String(n).padStart(2, "0");
const dyeName = (i) => (i >= 0 ? DATA.DYES[i].name : "Boş (beyaz)");
const dyeIcon = (i) => `textures/gm/ui/dye_${DATA.DYES[i].id}`;

async function show(form, player) {
  for (let i = 0; i < 20; i++) {
    const r = await form.show(player);
    if (r.cancelationReason !== FormCancelationReason.UserBusy) return r;
    await new Promise((res) => system.runTimeout(() => res(undefined), 5));
  }
  return { canceled: true };
}

function inventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

function countDyes(player) {
  const inv = inventory(player);
  const counts = new Array(DATA.DYES.length).fill(0);
  if (!inv) return counts;
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (it && DYE_ITEMS.has(it.typeId)) counts[DYE_ITEMS.get(it.typeId)] += it.amount;
  }
  return counts;
}

function consumeDyes(player, need) {
  const inv = inventory(player);
  const left = [...need];
  for (let i = 0; i < inv.size && left.some((n) => n > 0); i++) {
    const it = inv.getItem(i);
    if (!it || !DYE_ITEMS.has(it.typeId)) continue;
    const d = DYE_ITEMS.get(it.typeId);
    const take = Math.min(left[d], it.amount);
    if (take <= 0) continue;
    left[d] -= take;
    if (take === it.amount) inv.setItem(i, undefined);
    else {
      it.amount -= take;
      inv.setItem(i, it);
    }
  }
}

function cost(sess) {
  const need = new Array(DATA.DYES.length).fill(0);
  if (sess.mode === "new") for (const c of sess.colors) if (c >= 0) need[c]++;
  for (const m of sess.motifs) for (const c of m.c) if (c >= 0) need[c]++;
  return need;
}

function design(sess) {
  return {
    cat: sess.cat.id, shape: sess.shape, tpl: sess.tpl, colors: sess.colors,
    motifs: [...sess.existing, ...sess.motifs],
  };
}

function preview(sess) {
  syncPreview(sess.player, sess.cat.key, design(sess), sess.yaw);
}

function endPreview(sess) {
  syncPreview(sess.player, sess.cat.key, null, 0);
}

// ------------------------------------------------------------ giriş haznesi
export async function openBench(player) {
  if (busy.has(player.id)) return;
  busy.add(player.id);
  try {
    await inputMenu(player);
  } catch (e) {
    console.warn(`[Giysi] tezgâh hatası: ${e}\n${e.stack ?? ""}`);
  } finally {
    busy.delete(player.id);
  }
}

async function inputMenu(player) {
  const inv = inventory(player);
  const choices = [];
  for (let i = 0; i < inv.size; i++) {
    const it = inv.getItem(i);
    if (isBase(it)) choices.push({ slot: i, typeId: it.typeId, label: `${CAT_BY_BASE.get(it.typeId).name} (beyaz temel)` });
    else if (isCloth(it)) {
      const d = readCloth(it);
      if (d) choices.push({ slot: i, typeId: it.typeId, clothId: d.id, label: `${DATA.SHAPES[d.cat][d.shape].name} §8(motif ekle)` });
    }
  }
  if (!choices.length) {
    player.sendMessage("§eTezgâha koymak için beyaz temel giysi veya tamamlanmış giysi gerekli.");
    return;
  }
  const f = new ActionFormData().title("Giysi Tezgâhı · Giriş haznesi").body("Tezgâha koyulacak giysiyi seç.");
  for (const c of choices) {
    const cat = CAT_BY_BASE.get(c.typeId) ?? CAT_BY_ITEM.get(c.typeId);
    f.button(c.label, `textures/gm/items/${cat.id}${c.clothId ? "" : "_base"}`);
  }
  const r = await show(f, player);
  if (r.canceled) return;
  const ch = choices[r.selection];
  if (ch.clothId) {
    const d = readCloth(inv.getItem(ch.slot));
    if (!d) return;
    const sess = {
      player, mode: "motif", cat: DATA.CATEGORIES.find((c) => c.id === d.cat), input: ch,
      shape: d.shape, tpl: d.tpl, colors: d.colors, existing: d.motifs, motifs: [], yaw: 0, step: 1, base: d,
    };
    return designLoop(sess);
  }
  const cat = CAT_BY_BASE.get(ch.typeId);
  const sess = { player, mode: "new", cat: DATA.CATEGORIES.find((c) => c.id === cat.id), input: ch, existing: [], motifs: [], yaw: 0, step: 1 };
  if (!(await shapeMenu(sess))) return;
  return designLoop(sess);
}

async function shapeMenu(sess) {
  const k = sess.cat.key;
  for (;;) {
    const f = new ActionFormData().title(`${sess.cat.name} · Şekil`).body("Kategorinin 25 şekli. Kilitli olanlar doğrulama kapısından sonra üretilecek.");
    DATA.SHAPES[sess.cat.id].forEach((s, i) => {
      const style = s.style === "modern" ? "" : s.style === "fantastik" ? " §d(fantastik)" : " §6(ortaçağ)";
      f.button(`${s.built >= 0 ? "" : "§8"}${s.name}${style}`, `textures/gm/ui/shape_${k}${pad(i + 1)}`);
    });
    const r = await show(f, sess.player);
    if (r.canceled) return false;
    const s = DATA.SHAPES[sess.cat.id][r.selection];
    if (s.built < 0) {
      sess.player.sendMessage(`§e"${s.name}" henüz üretilmedi: doğrulama kapısı geçmeden 100 modelin üretimine başlanmıyor.`);
      continue;
    }
    sess.shape = r.selection;
    if (await templateMenu(sess)) return true;
  }
}

async function templateMenu(sess) {
  const key = `${sess.cat.key}${pad(sess.shape + 1)}`;
  const f = new ActionFormData().title(`${DATA.SHAPES[sess.cat.id][sess.shape].name} · Renk şablonu`).body("Örnek renkler bölgeleri birbirinden ayırır.");
  DATA.TEMPLATES.forEach((t, i) => f.button(`${t.name} §8· ${t.regions} bölge`, `textures/gm/ui/tpl_${key}_${pad(i)}`));
  const r = await show(f, sess.player);
  if (r.canceled) return false;
  sess.tpl = r.selection;
  sess.colors = new Array(DATA.TEMPLATES[sess.tpl].regions).fill(-1);
  return true;
}

// ------------------------------------------------------------ tasarım ekranı
async function designLoop(sess) {
  try {
    for (;;) {
      preview(sess);
      const res = await designMenu(sess);
      if (res === "done") return;
      if (res === "cancel") {
        sess.player.sendMessage("§7Tasarım iptal edildi; malzeme tüketilmedi.");
        return;
      }
    }
  } finally {
    endPreview(sess);
  }
}

async function designMenu(sess) {
  const p = sess.player;
  const st = getState(p);
  const have = countDyes(p);
  const need = cost(sess);
  const shape = DATA.SHAPES[sess.cat.id][sess.shape];
  const lines = [
    `§l${shape.name}§r · ${DATA.TEMPLATES[sess.tpl].name}`,
    sess.mode === "motif" ? "§6Tamamlanmış giysi: yalnızca yeni motif eklenebilir." : "Hazneye dokunup envanterden boya seç.",
    `Motif: ${sess.existing.length + sess.motifs.length}/${DATA.LIMITS.maxMotifs}`,
  ];
  const costLine = need.map((n, i) => (n ? `${n > have[i] ? "§c" : "§a"}${DATA.DYES[i].name} ${n}/${have[i]}§r` : "")).filter(Boolean);
  lines.push(costLine.length ? `Gereken boya: ${costLine.join(", ")}` : "Gereken boya: yok");
  const f = new ActionFormData().title(`${PREVIEW}Giysi Tezgâhı`).body(lines.join("\n"));
  const actions = [];
  if (sess.mode === "new") {
    sess.colors.forEach((c, r) => {
      f.button(`Bölge ${r + 1}: ${dyeName(c)}`, c >= 0 ? dyeIcon(c) : "textures/gm/ui/dye_white");
      actions.push(["region", r]);
    });
  }
  f.button("§2Motif düzenleyici", "textures/gm/ui/btn_motif"); actions.push(["motif"]);
  f.button("Önizlemeyi döndür", "textures/gm/ui/btn_rotate"); actions.push(["rotate"]);
  f.button(`Kol tipi: ${st.slim ? "İnce" : "Standart"}`); actions.push(["slim"]);
  f.button("§aTamamla", "textures/gm/ui/btn_done"); actions.push(["done"]);
  f.button("§cİptal", "textures/gm/ui/btn_cancel"); actions.push(["cancel"]);
  const r = await show(f, p);
  if (r.canceled) return "cancel";
  const [act, arg] = actions[r.selection];
  switch (act) {
    case "region": {
      const d = await dyePicker(sess, `Bölge ${arg + 1}`, true);
      if (d !== undefined) sess.colors[arg] = d;
      return;
    }
    case "motif":
      return motifEditor(sess);
    case "rotate":
      sess.yaw = (sess.yaw + 45) % 360;
      return;
    case "slim":
      setSlim(p, !st.slim);
      return;
    case "done":
      return complete(sess) ? "done" : undefined;
    case "cancel":
      return "cancel";
  }
}

// allowEmpty: boş bırakılan temel bölge beyaz kalır. Dönüş: boya sırası, -1 (boş) veya undefined (vazgeç).
async function dyePicker(sess, title, allowEmpty) {
  const have = countDyes(sess.player);
  const f = new ActionFormData().title(`${PREVIEW}${title} · Boya`).body("Envanterdeki boyalar. Aynı renk birden çok haznede kullanılabilir.");
  const opts = [];
  if (allowEmpty) {
    f.button("Boş bırak (beyaz)");
    opts.push(-1);
  }
  have.forEach((n, i) => {
    if (n > 0) {
      f.button(`${DATA.DYES[i].name} §8×${n}`, dyeIcon(i));
      opts.push(i);
    }
  });
  if (!opts.length || (allowEmpty && opts.length === 1)) f.body("§eEnvanterde boya yok.");
  const r = await show(f, sess.player);
  if (r.canceled) return undefined;
  return opts[r.selection];
}

// ------------------------------------------------------------ motif düzenleyici
async function motifEditor(sess) {
  for (;;) {
    preview(sess);
    const total = sess.existing.length + sess.motifs.length;
    const f = new ActionFormData().title(`${PREVIEW}Motif düzenleyici`)
      .body(`Motif: ${total}/${DATA.LIMITS.maxMotifs}. Boyut ve açı sabit; yalnızca konum değişir.${sess.existing.length ? `\n§7${sess.existing.length} mevcut motif değiştirilemez.` : ""}`);
    const acts = [];
    sess.motifs.forEach((m, i) => {
      f.button(`${DATA.MOTIFS[m.i].name} §8· ${surfaceName(sess, m.f)}`, `textures/gm/ui/motif_${DATA.MOTIFS[m.i].id}`);
      acts.push(["edit", i]);
    });
    if (total < DATA.LIMITS.maxMotifs) {
      f.button("§2Yeni motif ekle", "textures/gm/ui/btn_motif");
      acts.push(["add"]);
    }
    f.button("Geri");
    acts.push(["back"]);
    const r = await show(f, sess.player);
    if (r.canceled) return;
    const [act, arg] = acts[r.selection];
    if (act === "back") return;
    if (act === "edit") await motifEdit(sess, arg);
    if (act === "add") {
      const m = await newMotif(sess);
      if (m) {
        sess.motifs.push(m);
        await motifEdit(sess, sess.motifs.length - 1);
      }
    }
  }
}

function surfaceName(sess, f) {
  return DATA.SHAPES[sess.cat.id][sess.shape].surfaces[f] ?? "?";
}

async function newMotif(sess) {
  const f = new ActionFormData().title("Motif seç").body("Her renk kanalı bir boya tüketir.");
  DATA.MOTIFS.forEach((m) => f.button(`${m.name} §8· ${m.ch} renk`, `textures/gm/ui/motif_${m.id}`));
  const r = await show(f, sess.player);
  if (r.canceled) return undefined;
  const mi = r.selection;
  const c = [];
  for (let ch = 0; ch < DATA.MOTIFS[mi].ch; ch++) {
    const d = await dyePicker(sess, `${DATA.MOTIFS[mi].name} · renk ${ch + 1}`, false);
    if (d === undefined || d < 0) return undefined;
    c.push(d);
  }
  const fs = await surfacePicker(sess);
  if (fs === undefined) return undefined;
  return { i: mi, f: fs, x: 7, y: 7, c };
}

async function surfacePicker(sess) {
  const names = DATA.SHAPES[sess.cat.id][sess.shape].surfaces;
  const f = new ActionFormData().title("Yüzey seç").body("Motifin yerleştirileceği giysi yüzeyi.");
  names.forEach((n) => f.button(n));
  const r = await show(f, sess.player);
  return r.canceled ? undefined : r.selection;
}

async function motifEdit(sess, idx) {
  for (;;) {
    const m = sess.motifs[idx];
    if (!m) return;
    preview(sess);
    const f = new ActionFormData().title(`${PREVIEW}${DATA.MOTIFS[m.i].name}`)
      .body(`Yüzey: ${surfaceName(sess, m.f)} · Konum ${m.x + 1},${m.y + 1} / 16 · Adım ${sess.step}`);
    const acts = [["l"], ["r"], ["u"], ["d"], ["step"], ["color"], ["surface"], ["del"], ["ok"]];
    f.button("Sola", "textures/gm/ui/btn_left");
    f.button("Sağa", "textures/gm/ui/btn_right");
    f.button("Yukarı", "textures/gm/ui/btn_up");
    f.button("Aşağı", "textures/gm/ui/btn_down");
    f.button(`Adım: ${sess.step === 1 ? "1 → 4" : "4 → 1"}`);
    f.button("Renkleri değiştir");
    f.button("Yüzeyi değiştir");
    f.button("§cMotifi kaldır", "textures/gm/ui/btn_cancel");
    f.button("§aTamam", "textures/gm/ui/btn_done");
    const r = await show(f, sess.player);
    if (r.canceled) return;
    const max = DATA.LIMITS.motifPos - 1;
    const clamp = (v) => Math.max(0, Math.min(max, v));
    switch (acts[r.selection][0]) {
      case "l": m.x = clamp(m.x - sess.step); break;
      case "r": m.x = clamp(m.x + sess.step); break;
      case "u": m.y = clamp(m.y - sess.step); break;
      case "d": m.y = clamp(m.y + sess.step); break;
      case "step": sess.step = sess.step === 1 ? 4 : 1; break;
      case "color": {
        const c = [];
        for (let ch = 0; ch < DATA.MOTIFS[m.i].ch; ch++) {
          const d = await dyePicker(sess, `${DATA.MOTIFS[m.i].name} · renk ${ch + 1}`, false);
          if (d === undefined || d < 0) break;
          c.push(d);
        }
        if (c.length === DATA.MOTIFS[m.i].ch) m.c = c;
        break;
      }
      case "surface": {
        const s = await surfacePicker(sess);
        if (s !== undefined) m.f = s;
        break;
      }
      case "del": sess.motifs.splice(idx, 1); return;
      case "ok": return;
    }
  }
}

// ------------------------------------------------------------ tamamla
function findInput(sess) {
  const inv = inventory(sess.player);
  const match = (it) => {
    if (!it || it.typeId !== sess.input.typeId) return false;
    if (sess.mode === "new") return true;
    return readCloth(it)?.id === sess.input.clothId;
  };
  if (match(inv.getItem(sess.input.slot))) return sess.input.slot;
  for (let i = 0; i < inv.size; i++) if (match(inv.getItem(i))) return i;
  return -1;
}

function complete(sess) {
  const p = sess.player;
  if (sess.mode === "motif" && !sess.motifs.length) {
    p.sendMessage("§eEklenecek yeni motif yok.");
    return false;
  }
  const need = cost(sess);
  const have = countDyes(p);
  const lack = need.map((n, i) => (n > have[i] ? `${DATA.DYES[i].name} ${n - have[i]}` : "")).filter(Boolean);
  if (lack.length) {
    p.sendMessage(`§cBoya yetersiz: ${lack.join(", ")}`);
    return false;
  }
  const slot = findInput(sess);
  if (slot < 0) {
    p.sendMessage("§cTezgâhtaki giysi envanterde bulunamadı; işlem yapılmadı.");
    return false;
  }
  const inv = inventory(p);
  const it = inv.getItem(slot);
  consumeDyes(p, need);
  if (sess.mode === "new") {
    if (it.amount > 1) {
      it.amount -= 1;
      inv.setItem(slot, it);
    } else inv.setItem(slot, undefined);
    const d = {
      v: 1, id: newId("c"), cat: sess.cat.id, shape: sess.shape, tpl: sess.tpl,
      colors: sess.colors, motifs: sess.motifs, done: true,
    };
    giveOrDrop(p, createClothItem(d));
  } else {
    const d = readCloth(it);
    d.motifs = [...d.motifs, ...sess.motifs].slice(0, DATA.LIMITS.maxMotifs);
    writeCloth(it, d);
    inv.setItem(slot, it);
  }
  p.sendMessage("§aGiysi tamamlandı.");
  return true;
}

export function initBench(registry) {
  registry.registerCustomComponent("gm:workbench", {
    onPlayerInteract(e) {
      const player = e.player;
      if (!player) return;
      system.run(() => openBench(player));
    },
  });
}
