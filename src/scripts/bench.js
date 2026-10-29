// Giysi tezgâhı: şekil, renk şablonu, boya hazneleri, motif düzenleyici ve oyun içi çizim.
// "Kaydet"e basılana kadar hiçbir şey üretilmez ve tüketilmez; tasarım taslak olarak saklanır,
// tezgâh kapanıp yeniden açılınca kalınan yerden devam edilir.
import { system, InputPermissionCategory } from "@minecraft/server";
import { ActionFormData, CustomForm, ObservableNumber, ObservableString, ObservableBoolean, FormCancelationReason } from "@minecraft/server-ui";
import { DATA } from "./data.js";
import {
  CAT_BY_BASE, CAT_BY_ITEM, DYE_ITEMS, isBase, isCloth, readCloth, writeCloth, createClothItem, newId, giveOrDrop,
  templateName, templateRegions, normalizeMotif,
} from "./cloth.js";
import { syncPreview, endPreview } from "./sync.js";
import { getState, setSlim, refreshSelf } from "./bags.js";
import { clothSlotsFor, photoSlot } from "./atolye.js";

const DRAFT_KEY = "gm:taslak";
const busy = new Set();
const pad = (n) => String(n).padStart(2, "0");
const RULE = DATA.MOTIF_RULES;
const FIRST_PHOTO = DATA.MOTIFS.findIndex((m) => m.kind === "photo");
const DRAW_CHARS = "0123456789abcdefg";
// Metin ızgarasında boyaların yaklaşık § renkleri
const DYE_TEXT = ["§f", "§6", "§d", "§b", "§e", "§a", "§d", "§8", "§7", "§3", "§5", "§9", "§n", "§2", "§c", "§0"];

// ------------------------------------------------------------ yardımcılar
function inventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}

export function countDyes(player) {
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

const shapeOf = (sess) => DATA.SHAPES[sess.cat.id][sess.shape];

// Boya maliyeti: dolu temel bölge, yeni motif kanalı, çizimde kullanılan her renk, Atölye tasarımının renkleri.
export function cost(sess) {
  const need = new Array(DATA.DYES.length).fill(0);
  if (sess.mode === "new") {
    for (const c of sess.colors) if (c >= 0) need[c]++;
    if (sess.tpl === DATA.DRAW_TEMPLATE) {
      for (const ch of new Set(sess.draw.replace(/0/g, ""))) need[parseInt(ch, 17) - 1]++;
    }
    if (sess.tpl >= DATA.ATOLYE_TEMPLATE) {
      const slot = clothSlotsFor(sess.cat.id, sess.shape).find((k) => k.slot === sess.tpl - DATA.ATOLYE_TEMPLATE);
      for (const d of slot?.boyalar ?? []) need[d]++;
    }
  }
  for (const m of sess.motifs) {
    if (m.i >= FIRST_PHOTO && FIRST_PHOTO >= 0) for (const d of photoSlot(m.i - FIRST_PHOTO)?.boyalar ?? []) need[d]++;
    else for (const c of m.c) if (c >= 0) need[c]++;
  }
  return need;
}

function design(sess) {
  return {
    cat: sess.cat.id, shape: sess.shape, tpl: sess.tpl, colors: sess.colors,
    motifs: [...sess.existing, ...sess.motifs], draw: sess.draw,
  };
}

// Motif boyut sınırı: yüzeyden taşmasın (dönme açısıyla birlikte).
export function motifLimits(sess, m) {
  const md = DATA.MOTIFS[m.i];
  const rule = RULE[md.kind];
  const sh = shapeOf(sess);
  const s = sh.surfaces[m.f];
  const r = (m.r * Math.PI) / 180, ca = Math.abs(Math.cos(r)), sa = Math.abs(Math.sin(r));
  const S0 = sh.motifSize;
  const [lo, hi] = rule.scale;
  if (rule.stretch) {
    const ky = m.h / 100, kx = m.w / 100;
    const wMax = Math.min(ca > 1e-6 ? (s.A / S0 - ky * sa) / ca : Infinity, sa > 1e-6 ? (s.B / S0 - ky * ca) / sa : Infinity);
    const hMax = Math.min(sa > 1e-6 ? (s.A / S0 - kx * ca) / sa : Infinity, ca > 1e-6 ? (s.B / S0 - kx * sa) / ca : Infinity);
    return { lo, wHi: Math.max(lo, Math.min(hi, Math.floor(wMax * 100))), hHi: Math.max(lo, Math.min(hi, Math.floor(hMax * 100))) };
  }
  const k = Math.min(s.A, s.B) / (S0 * (ca + sa));
  return { lo, hi: Math.max(lo, Math.min(hi, Math.floor(k * 100))) };
}

export function clampMotif(sess, m) {
  const md = DATA.MOTIFS[m.i];
  const L = motifLimits(sess, m);
  const step = RULE[md.kind].rotStep;
  m.r = (Math.round(m.r / step) * step + 360) % 360;
  if (RULE[md.kind].stretch) {
    m.w = Math.max(L.lo, Math.min(L.wHi, m.w));
    m.h = Math.max(L.lo, Math.min(L.hHi, m.h));
    m.s = m.w;
  } else {
    m.s = Math.max(L.lo, Math.min(L.hi, m.s));
    m.w = m.h = m.s;
  }
  m.x = Math.max(0, Math.min(15, m.x));
  m.y = Math.max(0, Math.min(15, m.y));
}

// ------------------------------------------------------------ taslak ve önizleme
function saveDraft(sess) {
  const d = { input: sess.input, mode: sess.mode, cat: sess.cat.id, shape: sess.shape, tpl: sess.tpl, colors: sess.colors, motifs: sess.motifs, draw: sess.draw };
  try {
    sess.player.setDynamicProperty(DRAFT_KEY, JSON.stringify(d));
  } catch (e) {
    console.warn(`[Giysi] taslak kaydedilemedi: ${e}`);
  }
}

function loadDraft(player) {
  try {
    return JSON.parse(player.getDynamicProperty(DRAFT_KEY) ?? "null");
  } catch {
    return null;
  }
}

function clearDraft(player) {
  player.setDynamicProperty(DRAFT_KEY, undefined);
}

// Her değişiklikte bir sonraki tikte tek önizleme + taslak kaydı (kaydırıcılar art arda değer yollar).
function touch(sess) {
  if (sess.pending || sess.closed) return;
  sess.pending = true;
  system.run(() => {
    sess.pending = false;
    // Tezgâh kapandıysa bekleyen güncelleme kamerayı yeniden açmamalı ve silinen taslağı geri yazmamalı.
    if (sess.closed || !sess.player.isValid) return;
    const st = getState(sess.player);
    syncPreview(sess.player, sess.cat.key, design(sess), st.data, st.slim, 0);
    saveDraft(sess);
    updateCamera(sess);
  });
}

const FOCUS = { hat: [1.75, 2.1], top: [1.2, 2.6], pants: [0.7, 2.6], shoes: [0.25, 2.0] };
function updateCamera(sess) {
  const p = sess.player;
  try {
    const [h, dist] = FOCUS[sess.cat.id];
    const yaw = ((sess.bodyYaw + sess.yaw) * Math.PI) / 180;
    const o = sess.origin;
    const location = { x: o.x - Math.sin(yaw) * dist, y: o.y + h + 0.3, z: o.z + Math.cos(yaw) * dist };
    p.camera.setCamera("minecraft:free", { location, facingLocation: { x: o.x, y: o.y + h, z: o.z }, easeOptions: { easeTime: 0.25 } });
  } catch {
    // Kamera kullanılamıyorsa önizleme oyuncunun kendi görünümünde kalır.
  }
}

function startPreview(sess) {
  sess.origin = { ...sess.player.location };
  sess.bodyYaw = sess.player.getRotation().y;
  try {
    sess.player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
  } catch { /* isteğe bağlı */ }
  touch(sess);
}

function stopPreview(sess) {
  sess.closed = true;
  const p = sess.player;
  if (!p.isValid) return;
  try { p.camera.clear(); } catch { /* isteğe bağlı */ }
  try { p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true); } catch { /* isteğe bağlı */ }
  endPreview(p);
  refreshSelf(p);
}

// ------------------------------------------------------------ giriş haznesi
export async function openBench(player) {
  if (busy.has(player.id)) return;
  busy.add(player.id);
  let sess;
  try {
    if (typeof CustomForm !== "function") {
      player.sendMessage("§cBu oyun sürümü tezgâhın canlı ekranını (CustomForm) desteklemiyor.");
      return;
    }
    sess = await inputMenu(player);
    if (!sess) return;
    startPreview(sess);
    await editorLoop(sess);
  } catch (e) {
    console.warn(`[Giysi] tezgâh hatası: ${e}\n${e?.stack ?? ""}`);
  } finally {
    if (sess) stopPreview(sess);
    busy.delete(player.id);
  }
}

async function showAction(form, player) {
  for (let i = 0; i < 20; i++) {
    const r = await form.show(player);
    if (r.cancelationReason !== FormCancelationReason.UserBusy) return r;
    await new Promise((res) => system.runTimeout(() => res(undefined), 5));
  }
  return { canceled: true };
}

function newSession(player, choice, draft) {
  const inv = inventory(player);
  if (choice.clothId) {
    const d = readCloth(inv.getItem(choice.slot));
    if (!d) return undefined;
    const sess = {
      player, mode: "motif", cat: DATA.CATEGORIES.find((c) => c.id === d.cat), input: choice,
      shape: d.shape, tpl: d.tpl, colors: d.colors, existing: d.motifs, motifs: [], draw: d.draw ?? "", yaw: 0,
    };
    if (draft && draft.mode === "motif" && draft.input?.clothId === choice.clothId) sess.motifs = draft.motifs.map(normalizeMotif);
    return sess;
  }
  const cat = DATA.CATEGORIES.find((c) => c.id === CAT_BY_BASE.get(choice.typeId).id);
  const firstBuilt = DATA.SHAPES[cat.id].findIndex((s) => s.built >= 0);
  const sess = { player, mode: "new", cat, input: choice, shape: firstBuilt, tpl: 0, colors: [-1], existing: [], motifs: [], draw: "", yaw: 0 };
  if (draft && draft.mode === "new" && draft.cat === cat.id && DATA.SHAPES[cat.id][draft.shape]?.built >= 0) {
    Object.assign(sess, { shape: draft.shape, tpl: draft.tpl, colors: draft.colors, motifs: draft.motifs.map(normalizeMotif), draw: draft.draw ?? "" });
  }
  return sess;
}

async function inputMenu(player) {
  const inv = inventory(player);
  const draft = loadDraft(player);
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
    return undefined;
  }
  // Taslağa ait giysi hâlâ envanterdeyse onu öne al.
  let resume = -1;
  if (draft) {
    resume = choices.findIndex((c) => (draft.mode === "motif" ? c.clothId === draft.input?.clothId : !c.clothId && c.typeId === draft.input?.typeId));
  }
  const f = new ActionFormData().title("Giysi Tezgâhı · Giriş haznesi").body(resume >= 0 ? "Kaydedilmemiş bir taslağın var; üstteki düğmeyle devam edebilirsin." : "Tezgâha koyulacak giysiyi seç.");
  const order = resume >= 0 ? [resume, ...choices.keys()].filter((v, i, a) => a.indexOf(v) === i) : [...choices.keys()];
  for (const k of order) {
    const c = choices[k];
    const cat = CAT_BY_BASE.get(c.typeId) ?? CAT_BY_ITEM.get(c.typeId);
    f.button(k === resume ? `§2Taslağa devam: ${c.label}` : c.label, `textures/gm/items/${cat.id}${c.clothId ? "" : "_base"}`);
  }
  const r = await showAction(f, player);
  if (r.canceled) return undefined;
  const k = order[r.selection];
  return newSession(player, choices[k], k === resume ? draft : null);
}

// ------------------------------------------------------------ ana ekran
async function editorLoop(sess) {
  for (;;) {
    const act = await mainScreen(sess);
    if (act === "motifs") await motifList(sess);
    else if (act === "draw") await drawScreen(sess);
    else if (act === "save") {
      if (complete(sess)) return;
    } else if (act === "discard") {
      clearDraft(sess.player);
      sess.player.sendMessage("§7Taslak silindi; malzeme tüketilmedi.");
      return;
    } else {
      saveDraft(sess);
      sess.player.sendMessage("§7Tasarım taslak olarak saklandı. Kaydet'e basmadan giysi üretilmez.");
      return;
    }
  }
}

function templateChoices(sess) {
  const list = DATA.TEMPLATES.map((t, i) => ({ tpl: i, label: `${t.name} · ${t.regions} bölge` }));
  if (shapeOf(sess).draw?.length) list.push({ tpl: DATA.DRAW_TEMPLATE, label: "Çizim (oyun içi fırça)" });
  for (const k of clothSlotsFor(sess.cat.id, sess.shape)) list.push({ tpl: DATA.ATOLYE_TEMPLATE + k.slot, label: `Atölye: ${k.ad}` });
  return list;
}

function statusText(sess) {
  const have = countDyes(sess.player);
  const need = cost(sess);
  const parts = need.map((n, i) => (n ? `${n > have[i] ? "§c" : "§a"}${DATA.DYES[i].name} ${n}/${have[i]}§r` : "")).filter(Boolean);
  const total = sess.existing.length + sess.motifs.length;
  return [
    `§l${shapeOf(sess).name}§r · ${templateName(sess.tpl)} · Motif ${total}/${DATA.LIMITS.maxMotifs}`,
    sess.mode === "motif" ? "§6Tamamlanmış giysi: yalnızca yeni motif eklenebilir." : "Bölgelere boya seç; boş bölgeler beyaz kalır.",
    parts.length ? `Gereken boya: ${parts.join(", ")}` : "Gereken boya: yok",
    "§7Kaydet'e basana kadar hiçbir şey üretilmez veya tüketilmez.",
  ].join("\n");
}

function dyeItems(have, emptyLabel) {
  const items = [];
  if (emptyLabel) items.push({ label: emptyLabel, value: 0 });
  DATA.DYES.forEach((d, i) => items.push({ label: `${d.name} (${have[i]})`, value: items.length }));
  return items;
}

async function mainScreen(sess) {
  const p = sess.player;
  const f = new CustomForm(p, "Giysi Tezgâhı");
  let action = "close";
  const have = countDyes(p);
  const status = new ObservableString(statusText(sess));
  const refresh = () => { status.setData(statusText(sess)); touch(sess); };
  f.label(status);
  const editable = sess.mode === "new";

  // Şekil
  const shapes = DATA.SHAPES[sess.cat.id];
  const shapeObs = new ObservableNumber(sess.shape, { clientWritable: true });
  f.dropdown("Şekil", shapeObs, shapes.map((s, i) => ({ label: s.built >= 0 ? s.name : `§8${s.name} (tam sürümde gelecek)`, value: i })), { disabled: !editable });

  // Şablon (+ çizim ve Atölye)
  let tplList = templateChoices(sess);
  const tplObs = new ObservableNumber(Math.max(0, tplList.findIndex((t) => t.tpl === sess.tpl)), { clientWritable: true });
  f.dropdown("Renk şablonu", tplObs, tplList.map((t, i) => ({ label: t.label, value: i })), { disabled: !editable });

  // Boya hazneleri
  const regionObs = [], regionVis = [];
  for (let r = 0; r < DATA.LIMITS.maxRegions; r++) {
    regionObs.push(new ObservableNumber((sess.colors[r] ?? -1) + 1, { clientWritable: true }));
    regionVis.push(new ObservableBoolean(r < sess.colors.length));
    f.dropdown(`Bölge ${r + 1}`, regionObs[r], dyeItems(have, "Boş (beyaz)"), { visible: regionVis[r], disabled: !editable });
  }
  const drawVis = new ObservableBoolean(sess.tpl === DATA.DRAW_TEMPLATE && editable);
  const setRegions = () => {
    const n = templateRegions(sess.tpl);
    const next = [];
    for (let r = 0; r < n; r++) next.push(sess.colors[r] ?? -1);
    sess.colors = next;
    regionVis.forEach((v, r) => v.setData(r < n));
  };

  shapeObs.subscribe((v) => {
    if (!editable || v === sess.shape) return;
    if (shapes[v]?.built < 0) {
      shapeObs.setData(sess.shape);
      status.setData(`§e"${shapes[v].name}" henüz üretilmedi: kapı testi geçmeden 100 modelin üretimine başlanmıyor.\n` + statusText(sess));
      return;
    }
    sess.shape = v;
    sess.motifs.forEach((m) => { m.f = Math.min(m.f, shapeOf(sess).surfaces.length - 1); clampMotif(sess, m); });
    tplList = templateChoices(sess);
    if (!tplList.some((t) => t.tpl === sess.tpl)) { sess.tpl = 0; tplObs.setData(0); setRegions(); }
    refresh();
  });
  tplObs.subscribe((v) => {
    if (!editable || !tplList[v] || tplList[v].tpl === sess.tpl) return;
    sess.tpl = tplList[v].tpl;
    setRegions();
    drawVis.setData(sess.tpl === DATA.DRAW_TEMPLATE);
    refresh();
  });
  regionObs.forEach((o, r) => o.subscribe((v) => {
    if (!editable || r >= sess.colors.length) return;
    sess.colors[r] = v - 1;
    refresh();
  }));

  f.button("§2Motif düzenleyici", () => { action = "motifs"; f.close(); });
  f.button("Çizim fırçası", () => { action = "draw"; f.close(); }, { visible: drawVis });

  const yawObs = new ObservableNumber(sess.yaw, { clientWritable: true });
  f.slider("Önizlemeyi döndür", yawObs, 0, 345, { step: 15 });
  yawObs.subscribe((v) => { sess.yaw = v; touch(sess); });
  const slimObs = new ObservableBoolean(!!getState(p).slim, { clientWritable: true });
  f.toggle("İnce kol (skinin kolları inceyse)", slimObs);
  slimObs.subscribe((v) => { setSlim(p, v); touch(sess); });

  f.button("§aKaydet ve üret", () => { action = "save"; f.close(); });
  f.button("§cTaslağı sil", () => { action = "discard"; f.close(); });
  f.closeButton();
  await f.show();
  return action;
}

// ------------------------------------------------------------ motifler
async function motifList(sess) {
  for (;;) {
    const p = sess.player;
    const f = new CustomForm(p, "Motif düzenleyici");
    /** @type {{ back?: boolean, add?: boolean, edit?: number }} */
    let act = { back: true };
    const total = sess.existing.length + sess.motifs.length;
    f.label(`Motif: ${total}/${DATA.LIMITS.maxMotifs}. Konum her motifte kaydırılır; uygun motiflerde boyut ve açı da değişir.${sess.existing.length ? `\n§7${sess.existing.length} mevcut motif değiştirilemez.` : ""}`);
    sess.motifs.forEach((m, i) => {
      const md = DATA.MOTIFS[m.i];
      const size = RULE[md.kind].stretch ? `%${m.w}×${m.h}` : `%${m.s}`;
      f.button(`${md.name} · ${shapeOf(sess).surfaces[m.f].name} · ${size} · ${m.r}°`, () => { act = { edit: i }; f.close(); });
    });
    f.button("§2Yeni motif ekle", () => { act = { add: true }; f.close(); }, { disabled: total >= DATA.LIMITS.maxMotifs });
    f.button("Geri", () => { act = { back: true }; f.close(); });
    f.closeButton();
    await f.show();
    if (act.back) return;
    if (act.add) {
      const i = await motifPicker(sess);
      if (i === undefined) continue;
      const md = DATA.MOTIFS[i];
      const m = { i, f: 0, x: 7, y: 7, s: 100, w: 100, h: 100, r: 0, c: Array.from({ length: md.ch }, (_, k) => [14, 0, 4][k]) };
      clampMotif(sess, m);
      sess.motifs.push(m);
      touch(sess);
      await motifEdit(sess, sess.motifs.length - 1);
    }
    if (act.edit !== undefined) await motifEdit(sess, act.edit);
  }
}

const GROUPS = [["pixel", "Minecraft ve piksel"], ["vector", "Vektör (büyür, döner)"], ["shape", "Ayarlanabilir şekiller"], ["photo", "Foto (Atölye)"]];
async function motifPicker(sess) {
  const p = sess.player;
  const g = new ActionFormData().title("Motif grubu").body("Her renk kanalı bir boya tüketir.");
  GROUPS.forEach(([, n]) => g.button(n));
  const rg = await showAction(g, p);
  if (rg.canceled) return undefined;
  const kind = GROUPS[rg.selection][0];
  const items = DATA.MOTIFS.map((m, i) => ({ m, i })).filter(({ m, i }) => m.kind === kind && (kind !== "photo" || photoSlot(i - FIRST_PHOTO)));
  if (!items.length) {
    p.sendMessage(kind === "photo" ? "§eHenüz Atölye fotoğrafı yok. Atölye sayfasında foto hazırlayıp paketi dünyaya ekle." : "§eBu grupta motif yok.");
    return undefined;
  }
  const f = new ActionFormData().title(GROUPS[rg.selection][1]).body("Bir motif seç.");
  for (const { m, i } of items) {
    const label = kind === "photo" ? photoSlot(i - FIRST_PHOTO).ad : `${m.name} §8· ${m.ch} renk`;
    f.button(label, `textures/gm/ui/motif_${m.id}`);
  }
  const r = await showAction(f, p);
  return r.canceled ? undefined : items[r.selection].i;
}

async function motifEdit(sess, idx) {
  const m = sess.motifs[idx];
  if (!m) return;
  const md = DATA.MOTIFS[m.i];
  const rule = RULE[md.kind];
  const p = sess.player;
  const have = countDyes(p);
  const f = new CustomForm(p, md.name);
  let removed = false;
  const sh = shapeOf(sess);
  const info = new ObservableString("");
  const L0 = motifLimits(sess, m);
  const surfObs = new ObservableNumber(m.f, { clientWritable: true });
  const xObs = new ObservableNumber(m.x + 1, { clientWritable: true });
  const yObs = new ObservableNumber(m.y + 1, { clientWritable: true });
  const sObs = new ObservableNumber(m.s, { clientWritable: true });
  const wObs = new ObservableNumber(m.w, { clientWritable: true });
  const hObs = new ObservableNumber(m.h, { clientWritable: true });
  const rObs = new ObservableNumber(m.r, { clientWritable: true });
  const sMax = new ObservableNumber(L0.hi ?? rule.scale[1]);
  const wMax = new ObservableNumber(L0.wHi ?? rule.scale[1]);
  const hMax = new ObservableNumber(L0.hHi ?? rule.scale[1]);
  const update = () => {
    clampMotif(sess, m);
    const L = motifLimits(sess, m);
    if (rule.stretch) { wMax.setData(L.wHi); hMax.setData(L.hHi); if (wObs.getData() !== m.w) wObs.setData(m.w); if (hObs.getData() !== m.h) hObs.setData(m.h); }
    else { sMax.setData(L.hi); if (sObs.getData() !== m.s) sObs.setData(m.s); }
    info.setData(rule.stretch ? `En en çok %${L.wHi}, boy en çok %${L.hHi} (bu yüzeyde ve açıda).` : `Boyut en çok %${L.hi} (bu yüzeyde ve açıda).`);
    touch(sess);
  };
  f.label(info);
  f.dropdown("Yüzey", surfObs, sh.surfaces.map((s, i) => ({ label: s.name, value: i })));
  f.slider("Sağa / sola", xObs, 1, 16, { step: 1 });
  f.slider("Yukarı / aşağı", yObs, 1, 16, { step: 1 });
  if (rule.stretch) {
    f.slider("En (%)", wObs, rule.scale[0], wMax, { step: rule.scaleStep });
    f.slider("Boy (%)", hObs, rule.scale[0], hMax, { step: rule.scaleStep });
  } else {
    f.slider("Boyut (%)", sObs, rule.scale[0], sMax, { step: rule.scaleStep });
  }
  f.slider(rule.rotStep === 90 ? "Açı (90° adım)" : "Açı", rObs, 0, 360 - rule.rotStep, { step: rule.rotStep });
  const chObs = [];
  if (md.kind !== "photo") {
    for (let ch = 0; ch < md.ch; ch++) {
      const o = new ObservableNumber(m.c[ch] ?? 0, { clientWritable: true });
      chObs.push(o);
      f.dropdown(`Renk ${ch + 1}`, o, dyeItems(have, null));
      o.subscribe((v) => { m.c[ch] = v; touch(sess); });
    }
  }
  surfObs.subscribe((v) => { m.f = v; update(); });
  xObs.subscribe((v) => { m.x = v - 1; touch(sess); });
  yObs.subscribe((v) => { m.y = v - 1; touch(sess); });
  sObs.subscribe((v) => { if (v !== m.s) { m.s = v; update(); } });
  wObs.subscribe((v) => { if (v !== m.w) { m.w = v; update(); } });
  hObs.subscribe((v) => { if (v !== m.h) { m.h = v; update(); } });
  rObs.subscribe((v) => { if (v !== m.r) { m.r = v; update(); } });
  f.button("§cMotifi kaldır", () => { removed = true; f.close(); });
  f.button("§aTamam", () => f.close());
  f.closeButton();
  update();
  await f.show();
  if (removed) {
    sess.motifs.splice(idx, 1);
    touch(sess);
  }
}

// ------------------------------------------------------------ oyun içi çizim
// Şeklin çizim yüzleri (ör. gövde önü/arkası, bacaklar, şapka yanları) ayrı ızgaralardır; her hücre bir boya rengi.
function drawGrid(sess, face, cur, size) {
  const sh = shapeOf(sess);
  const F = sh.drawFaces[face];
  const index = new Map();
  sh.draw.forEach((c, n) => { if (c[0] === face) index.set(c[1] * 100 + c[2], n); });
  const lines = [];
  for (let row = 0; row < F.rows; row++) {
    let line = "";
    for (let col = 0; col < F.cols; col++) {
      const n = index.get(row * 100 + col);
      const inBrush = row >= cur.row && row < cur.row + size && col >= cur.col && col < cur.col + size;
      if (n === undefined) { line += "§8 ·"; continue; }
      const v = parseInt(sess.draw[n] ?? "0", 17) || 0;
      const glyph = inBrush ? "▣" : "█";
      line += v ? `${DYE_TEXT[v - 1]}${glyph}` : inBrush ? "§f▣" : "§7░";
    }
    lines.push(line + "§r");
  }
  return lines.join("\n");
}

function paint(sess, face, cur, size, value) {
  const cells = shapeOf(sess).draw;
  const arr = [...(sess.draw.padEnd(cells.length, "0"))];
  cells.forEach((c, n) => {
    if (c[0] === face && c[1] >= cur.row && c[1] < cur.row + size && c[2] >= cur.col && c[2] < cur.col + size) arr[n] = DRAW_CHARS[value];
  });
  sess.draw = arr.join("");
  touch(sess);
}

async function drawScreen(sess) {
  const p = sess.player;
  const sh = shapeOf(sess);
  if (!sh.draw?.length) return;
  const have = countDyes(p);
  const f = new CustomForm(p, "Çizim fırçası");
  const faceObs = new ObservableNumber(0, { clientWritable: true });
  const colObs = new ObservableNumber(1, { clientWritable: true });
  const rowObs = new ObservableNumber(1, { clientWritable: true });
  const colMax = new ObservableNumber(sh.drawFaces[0].cols);
  const rowMax = new ObservableNumber(sh.drawFaces[0].rows);
  const colorObs = new ObservableNumber(14, { clientWritable: true });
  const sizeObs = new ObservableNumber(0, { clientWritable: true });
  const grid = new ObservableString("");
  const cur = () => ({ row: rowObs.getData() - 1, col: colObs.getData() - 1 });
  const redraw = () => grid.setData(drawGrid(sess, faceObs.getData(), cur(), sizeObs.getData() + 1));
  f.label("Skin pikseli çözünürlüğünde çizim. Her farklı renk bir boya tüketir.");
  f.dropdown("Yüz", faceObs, sh.drawFaces.map((d, i) => ({ label: `${d.name} (${d.cols}×${d.rows})`, value: i })));
  f.label(grid);
  f.slider("Sütun", colObs, 1, colMax, { step: 1 });
  f.slider("Satır", rowObs, 1, rowMax, { step: 1 });
  f.dropdown("Fırça rengi", colorObs, dyeItems(have, null));
  f.dropdown("Fırça boyu", sizeObs, [{ label: "1×1", value: 0 }, { label: "2×2", value: 1 }, { label: "3×3", value: 2 }]);
  faceObs.subscribe(() => system.run(() => {
    const F = sh.drawFaces[faceObs.getData()];
    colMax.setData(F.cols);
    rowMax.setData(F.rows);
    if (colObs.getData() > F.cols) colObs.setData(F.cols);
    if (rowObs.getData() > F.rows) rowObs.setData(F.rows);
    redraw();
  }));
  for (const o of [colObs, rowObs, sizeObs]) o.subscribe(() => system.run(redraw));
  const whole = () => Math.max(...sh.drawFaces.map((d) => Math.max(d.cols, d.rows)));
  f.button("§2Boya", () => { paint(sess, faceObs.getData(), cur(), sizeObs.getData() + 1, colorObs.getData() + 1); redraw(); });
  f.button("Sil", () => { paint(sess, faceObs.getData(), cur(), sizeObs.getData() + 1, 0); redraw(); });
  f.button("Bu yüzü tümüyle boya", () => { paint(sess, faceObs.getData(), { row: 0, col: 0 }, whole(), colorObs.getData() + 1); redraw(); });
  f.button("Bu yüzü temizle", () => { paint(sess, faceObs.getData(), { row: 0, col: 0 }, whole(), 0); redraw(); });
  f.button("Geri", () => f.close());
  f.closeButton();
  redraw();
  await f.show();
}

// ------------------------------------------------------------ kaydet
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

export function complete(sess) {
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
      v: 2, id: newId("c"), cat: sess.cat.id, shape: sess.shape, tpl: sess.tpl, colors: sess.colors,
      motifs: sess.motifs, draw: sess.tpl === DATA.DRAW_TEMPLATE ? sess.draw : undefined, done: true,
    };
    giveOrDrop(p, createClothItem(d));
  } else {
    const d = readCloth(it);
    d.motifs = [...d.motifs, ...sess.motifs].slice(0, DATA.LIMITS.maxMotifs);
    writeCloth(it, d);
    inv.setItem(slot, it);
  }
  clearDraft(p);
  p.sendMessage("§aGiysi kaydedildi ve üretildi.");
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
