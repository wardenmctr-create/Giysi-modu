// Oyuncu istemci varlığı, giysi render controller'ları ve motif animasyonları.
// Veri yolu: script → playAnimation(stopExpression) → Molang değişkenleri (v.gm<k>*).
// Tasarım önizlemesi sırasında tasarlayan oyuncunun kendi istemcisine taslak değerler gönderilir;
// diğer oyuncular giyili hâli görmeye devam eder (değişkenler istemci başınadır).
//
// Geçişler (kategori başına): taban (bölge 0 rengi, beyaz doku) → bölge 1..15 maskeleri (kategori atlasında
// ortak) → kenar vurgusu (yalnızca kenar kemikleri) → gölge + ayrıntı katmanı (şekle özel, karışımlı) →
// çizim hücreleri → motifler.
// Renklendirme iki yöntemle denenir (v.gmmode, /scriptevent gm:mod a|b):
//   A (0): overlay_color (entity_alphatest)   B (1): "color" çarpımı (entity_alphatest_change_color)

import { motifBoneName, drawBoneName, partBoneName } from "./garment.mjs";
import { SLOTS } from "./slots.mjs";

// Bedrock animasyon konumunda X ekseni ve dönme yönü için varsayımlar (kapı testinde doğrulanır).
export const ANIM_X_SIGN = -1;
export const ANIM_ROT_SIGN = 1;

export const DRAW_TEMPLATE = 25; // "Çizim (oyun içi)"
export const ATOLYE_TEMPLATE = 26; // 26..26+clothSlots-1

const THIRD = "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator";
const MCH = ["a", "b", "c"];

function rgbExpr(expr, a = "1.0") {
  return {
    r: `math.floor(${expr} / 65536) / 255`,
    g: `math.mod(math.floor(${expr} / 256), 256) / 255`,
    b: `math.mod(${expr}, 256) / 255`,
    a,
  };
}
const fixed = (rgb) => ({ r: `${((rgb >> 16) & 255) / 255}`, g: `${((rgb >> 8) & 255) / 255}`, b: `${(rgb & 255) / 255}`, a: "1.0" });
const pad2 = (n) => String(n).padStart(2, "0");

function visCond(rule) {
  const conds = rule.keys.map((key) => `!v.gma${key}`);
  if (rule.under) conds.push("!(v.gmts > 0)");
  return conds.length ? conds.join(" && ") : true;
}

export function buildRender({ CATEGORIES, TEMPLATES, MOTIFS, DYES, built, LIMITS, ATOLYE }) {
  const textures = { gm_blank: "textures/gm/blank", gm_white: "textures/gm/white" };
  const geometry = { gm_empty: "geometry.gm.empty" };
  const rcs = {};
  const entityRCs = [];
  const animations = {};
  const entityAnims = {};
  const animate = [];
  const firstPhoto = MOTIFS.findIndex((m) => m.kind === "photo");

  for (let k = 0; k < ATOLYE.photoSlots; k++) textures[`gm_photo_${k}`] = `textures/gm/photo/p${k}`;
  const motTex = (m, ch) => (m.kind === "photo" || ch >= m.ch ? "Texture.gm_blank" : `Texture.gm_mot_${m.id}_${ch}`);
  MOTIFS.forEach((m) => { for (let ch = 0; ch < m.ch; ch++) textures[`gm_mot_${m.id}_${ch}`] = `textures/gm/motif/${m.id}_${ch}`; });

  for (const cat of CATEGORIES) {
    const k = cat.key;
    const shapes = built[cat.id];
    if (!shapes.length) continue;
    const V = cat.id === "top" ? 2 : 1;
    const S = `v.gm${k}s`;
    const T = `v.gm${k}t`;
    const E = `v.gm${k}e`;
    const idx = V === 2 ? `((${S} - 1) * 2 + v.gmslim)` : `(${S} - 1)`;
    const arr = { g: [], mg: [], dg: [], ov: [], at: [] };
    const boneRules = new Map();
    const trimRules = new Map();
    const customBones = new Map();
    const cellBones = new Map(); // bone adı → { n, keys }
    const motifVariants = new Map(); // slot → Set(keys)
    for (const sh of shapes) {
      for (let vi = 0; vi < V; vi++) {
        const vr = sh.variants[Math.min(vi, sh.variants.length - 1)];
        const tag = `${sh.texKey}${vr.tag}`;
        geometry[`gm_${tag}`] = vr.geoId;
        geometry[`gm_${tag}_m`] = `${vr.geoId}.motif`;
        geometry[`gm_${tag}_d`] = `${vr.geoId}.draw`;
        arr.g.push(`Geometry.gm_${tag}`);
        arr.mg.push(`Geometry.gm_${tag}_m`);
        arr.dg.push(`Geometry.gm_${tag}_d`);
        textures[`gm_${tag}_ov`] = `textures/gm/cloth/${tag}/overlay`;
        arr.ov.push(`Texture.gm_${tag}_ov`);
        for (let a = 0; a < ATOLYE.clothSlots; a++) {
          textures[`gm_${tag}_at${a}`] = `textures/gm/cloth/${tag}/atolye_${a}`;
          arr.at.push(`Texture.gm_${tag}_at${a}`);
        }
        for (const [b, rule] of Object.entries(vr.boneRules)) boneRules.set(b, rule);
        for (const [b, rule] of Object.entries(vr.trimBones)) trimRules.set(b, rule);
        for (const b of vr.bones ?? []) if (b.anim) customBones.set(b.name, b);
        for (const c of vr.drawCells) cellBones.set(drawBoneName(cat.id, c.n, c.keys), c);
        for (const s of vr.surfaces) {
          if (!motifVariants.has(s.slot)) motifVariants.set(s.slot, new Set());
          motifVariants.get(s.slot).add(s.keys ?? "");
        }
      }
    }

    // Kategori atlasının ortak bölge maskeleri (şablon × bölge 1..15).
    const maskArr = Array.from({ length: LIMITS.maxRegions }, () => []);
    TEMPLATES.forEach((tpl, ti) => {
      for (let r = 1; r < LIMITS.maxRegions; r++) {
        if (r < tpl.regions) {
          const key = `gm_mask_${k}_${ti}_${r}`;
          textures[key] = `textures/gm/mask/${k}/t${pad2(ti)}_r${pad2(r)}`;
          maskArr[r].push(`Texture.${key}`);
        } else maskArr[r].push("Texture.gm_blank");
      }
    });

    // Katman kuralları: zırha değebilecek parçalar o zırh takılınca, bel ayrıntıları üst giyilince gizlenir.
    const partVis = [{ "*": true }];
    for (const [b, rule] of boneRules) partVis.push({ [b]: visCond(rule) });
    const accentVis = [{ "*": false }];
    for (const [b, rule] of trimRules) accentVis.push({ [b]: visCond(rule) });

    const worn = `${S} > 0 && ${THIRD}`;
    const notAt = `${T} < ${ATOLYE_TEMPLATE}`;
    const tplOn = `${T} < ${DRAW_TEMPLATE}`;
    const modeA = "v.gmmode == 0";
    const modeB = "v.gmmode == 1";
    const geoArr = { "Array.g": arr.g };
    const rc = (id, body, cond) => {
      rcs[id] = { geometry: `Array.g[${idx}]`, materials: [{ "*": "Material.gm" }], part_visibility: partVis, ...body, arrays: { geometries: geoArr, ...(body.arrays ?? {}) } };
      entityRCs.push({ [id]: cond });
    };
    const tint = (K) => ({ materials: [{ "*": "Material.gm_tint" }], color: rgbExpr(K) });
    const K0 = `v.gm${k}k0`;

    rc(`controller.render.gm.${k}.base_a`, { textures: ["Texture.gm_white"], overlay_color: rgbExpr(K0) }, `${worn} && ${notAt} && ${modeA}`);
    rc(`controller.render.gm.${k}.base_b`, { textures: ["Texture.gm_white"], ...tint(K0) }, `${worn} && ${notAt} && ${modeB}`);
    for (let r = 1; r < LIMITS.maxRegions; r++) {
      const K = `v.gm${k}k${r}`;
      const body = { arrays: { textures: { "Array.t": maskArr[r] } }, textures: [`Array.t[${T}]`] };
      rc(`controller.render.gm.${k}.r${r}_a`, { ...body, overlay_color: rgbExpr(K) }, `${worn} && ${tplOn} && ${modeA} && ${K} > 0`);
      rc(`controller.render.gm.${k}.r${r}_b`, { ...body, ...tint(K) }, `${worn} && ${tplOn} && ${modeB} && ${K} > 0`);
    }
    if (trimRules.size) {
      rc(`controller.render.gm.${k}.acc_a`, { part_visibility: accentVis, textures: ["Texture.gm_white"], overlay_color: rgbExpr(E) }, `${worn} && ${tplOn} && ${modeA} && ${E} > 0`);
      rc(`controller.render.gm.${k}.acc_b`, { part_visibility: accentVis, textures: ["Texture.gm_white"], ...tint(E) }, `${worn} && ${tplOn} && ${modeB} && ${E} > 0`);
    }
    rc(`controller.render.gm.${k}.atolye`, { arrays: { textures: { "Array.t": arr.at } }, textures: [`Array.t[${idx} * ${ATOLYE.clothSlots} + ${T} - ${ATOLYE_TEMPLATE}]`] }, `${worn} && ${T} >= ${ATOLYE_TEMPLATE}`);
    rc(`controller.render.gm.${k}.overlay`, { materials: [{ "*": "Material.gm_blend" }], arrays: { textures: { "Array.t": arr.ov } }, textures: [`Array.t[${idx}]`] }, worn);

    // Oyun içi çizim hücreleri: renk başına bir geçiş.
    if (cellBones.size) {
      for (let c = 1; c <= DYES.length; c++) {
        const vis = [{ "*": false }];
        for (const [name, cell] of cellBones) vis.push({ [name]: [`v.gm${k}d${cell.n} == ${c}`, ...[...(cell.keys ?? "")].map((a) => `!v.gma${a}`)].join(" && ") });
        const id = `controller.render.gm.${k}.draw${c}`;
        rcs[id] = {
          arrays: { geometries: { "Array.g": arr.dg } },
          geometry: `Array.g[${idx}]`, materials: [{ "*": "Material.gm" }], textures: ["Texture.gm_white"],
          part_visibility: vis, overlay_color: fixed(DYES[c - 1].rgb),
        };
        entityRCs.push({ [id]: `${worn} && !v.gma${k} && ${T} == ${DRAW_TEMPLATE}` });
      }
    }

    // Motif yuvaları: renk kanalı başına bir geçiş + foto geçişi. Sonraki yuva dışa doğru ötelenir (üstte).
    const slots = SLOTS[cat.id];
    const motArr = MCH.map((_, ch) => MOTIFS.map((m) => motTex(m, ch)));
    const photoArr = Array.from({ length: ATOLYE.photoSlots }, (_, p) => `Texture.gm_photo_${p}`);
    for (let m = 0; m < LIMITS.maxMotifs; m++) {
      const p = `v.gm${k}m${m}`;
      const vis = [{ "*": false }];
      for (const [si, keySet] of motifVariants) {
        for (const keys of keySet) vis.push({ [motifBoneName(cat.id, m, si, keys)]: [`${p}f == ${si}`, ...[...keys].map((a) => `!v.gma${a}`)].join(" && ") });
      }
      const mbody = { geometry: `Array.g[${idx}]`, materials: [{ "*": "Material.gm" }], part_visibility: vis };
      for (let ch = 0; ch < 3; ch++) {
        const C = `${p}${MCH[ch]}`;
        const id = `controller.render.gm.${k}.m${m}.${ch}`;
        rcs[id] = { ...mbody, arrays: { geometries: { "Array.g": arr.mg }, textures: { "Array.t": motArr[ch] } }, textures: [`Array.t[${p}i - 1]`], overlay_color: rgbExpr(C) };
        entityRCs.push({ [id]: `${worn} && !v.gma${k} && ${p}i > 0 && ${C} > 0` });
      }
      const pid = `controller.render.gm.${k}.m${m}.foto`;
      rcs[pid] = { ...mbody, arrays: { geometries: { "Array.g": arr.mg }, textures: { "Array.t": photoArr } }, textures: [`Array.t[${p}i - ${firstPhoto + 1}]`] };
      entityRCs.push({ [pid]: `${worn} && !v.gma${k} && ${p}i > ${firstPhoto}` });

      // Konum (script şeklin yüzey ölçüsüne göre ötelemeyi hesaplar: u, v birim), dönme ve ölçek.
      for (const [si, keySet] of motifVariants) {
        const s = slots[si];
        const kx = `(${p}w / 100)`, ky = `(${p}h / 100)`;
        const U = `${p}u`, Vv = `${p}v`, R = `${p}r`;
        let pos, rot, scl;
        if (s.face === "north") { pos = [`${ANIM_X_SIGN} * ${U}`, Vv, "0"]; rot = ["0", "0", `${ANIM_ROT_SIGN} * ${R}`]; scl = [kx, ky, "1"]; }
        else if (s.face === "south") { pos = [`${-ANIM_X_SIGN} * ${U}`, Vv, "0"]; rot = ["0", "0", `${-ANIM_ROT_SIGN} * ${R}`]; scl = [kx, ky, "1"]; }
        else if (s.face === "east") { pos = ["0", Vv, `-${U}`]; rot = [`${-ANIM_ROT_SIGN} * ${R}`, "0", "0"]; scl = ["1", ky, kx]; }
        else { pos = ["0", Vv, U]; rot = [`${ANIM_ROT_SIGN} * ${R}`, "0", "0"]; scl = ["1", ky, kx]; }
        const an = `animation.gm.motif.${k}.${m}.${si}`;
        const bones = {};
        for (const keys of keySet) bones[motifBoneName(cat.id, m, si, keys)] = { position: pos, rotation: rot, scale: scl };
        animations[an] = { loop: true, bones };
        const key = `gm_m_${k}_${m}_${si}`;
        entityAnims[key] = an;
        animate.push({ [key]: `${S} > 0 && ${p}i > 0 && ${p}f == ${si}` });
      }
    }

    // Şekle özel hareketli kemikler (ör. pelerin yürürken geriye savrulur).
    for (const b of customBones.values()) {
      const an = `animation.gm.bone.${b.name}`;
      animations[an] = { loop: true, bones: { [b.name]: b.anim } };
      entityAnims[`gm_b_${b.name}`] = an;
      animate.push({ [`gm_b_${b.name}`]: `${S} > 0` });
    }
  }

  animations["animation.gm.sync"] = { loop: true, animation_length: 1, bones: {} };
  animations["animation.gm.preview"] = { loop: true, bones: { root: { rotation: [0, "v.gmyaw", 0] } } };
  entityAnims.gm_preview = "animation.gm.preview";
  animate.push({ gm_preview: "q.is_in_ui && v.gmyaw != 0" });

  return {
    textures, geometry, entityRCs, entityAnims, animate,
    rcFile: { format_version: "1.10.0", render_controllers: rcs },
    animFile: { format_version: "1.10.0", animations },
  };
}

export function patchPlayerEntity(vanilla, r) {
  const e = JSON.parse(JSON.stringify(vanilla));
  const d = e["minecraft:client_entity"].description;
  d.materials.gm = "entity_alphatest";
  d.materials.gm_tint = "entity_alphatest_change_color";
  d.materials.gm_blend = "entity_alphablend";
  Object.assign(d.textures, r.textures);
  Object.assign(d.geometry, r.geometry);
  Object.assign(d.animations, r.entityAnims);
  d.scripts.animate = [...d.scripts.animate, ...r.animate];
  d.render_controllers = [...d.render_controllers, ...r.entityRCs];
  return e;
}

export { partBoneName };
