// Oyuncu istemci varlığı, giysi render controller'ları ve motif animasyonları.
// Veri yolu: script → playAnimation(stopExpression) → Molang değişkenleri (v.gm<k>*).
// Tasarım önizlemesi sırasında tasarlayan oyuncunun kendi istemcisine taslak değerler gönderilir;
// diğer oyuncular giyili hâli görmeye devam eder (değişkenler istemci başınadır).
//
// Renklendirme iki yöntemle denenir (v.gmmode, /scriptevent gm:mod a|b):
//   A (0): düz bölge maskesi + overlay_color, üstüne karışımlı gölge katmanı (entity_alphablend)
//   B (1): gölgesi işlenmiş gri maske + render controller "color" çarpımı (entity_alphatest_change_color)

import { motifBoneName, drawBoneName, partBoneName } from "./garment.mjs";

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

export function buildRender({ CATEGORIES, TEMPLATES, MOTIFS, DYES, built, LIMITS, ATOLYE }) {
  const textures = { gm_blank: "textures/gm/blank", gm_white: "textures/gm/white" };
  const geometry = { gm_empty: "geometry.gm.empty" };
  const rcs = {};
  const entityRCs = [];
  const animations = {};
  const entityAnims = {};
  const animate = [];
  const nTpl = TEMPLATES.length + 1; // ortak 25 + oyun içi çizim
  const firstPhoto = MOTIFS.findIndex((m) => m.kind === "photo");

  for (let k = 0; k < ATOLYE.photoSlots; k++) textures[`gm_photo_${k}`] = `textures/gm/photo/p${k}`;
  const motTex = (m, ch) => {
    if (m.kind === "photo" || ch >= m.ch) return "Texture.gm_blank";
    return `Texture.gm_mot_${m.id}_${ch}`;
  };
  MOTIFS.forEach((m) => { for (let ch = 0; ch < m.ch; ch++) textures[`gm_mot_${m.id}_${ch}`] = `textures/gm/motif/${m.id}_${ch}`; });

  for (const cat of CATEGORIES) {
    const k = cat.key;
    const shapes = built[cat.id];
    const V = cat.id === "top" ? 2 : 1;
    const S = `v.gm${k}s`;
    const T = `v.gm${k}t`;
    const idx = V === 2 ? `((${S} - 1) * 2 + v.gmslim)` : `(${S} - 1)`;
    const arr = { g: [], mg: [], dg: [], base: [], baseS: [], shade: [], detail: [], atolye: [] };
    const mask = Array.from({ length: LIMITS.maxRegions }, () => []);
    let surfaces = null, motifSize = 2, drawCells = null;
    const boneRules = new Map();
    for (const sh of shapes) {
      for (let vi = 0; vi < V; vi++) {
        const vr = sh.variants[Math.min(vi, sh.variants.length - 1)];
        const tag = `${sh.texKey}${vr.tag}`;
        geometry[`gm_${tag}`] = vr.geoId;
        geometry[`gm_${tag}_m`] = `${vr.geoId}.motif`;
        arr.g.push(`Geometry.gm_${tag}`);
        arr.mg.push(`Geometry.gm_${tag}_m`);
        if (vr.drawCells?.length) {
          geometry[`gm_${tag}_d`] = `${vr.geoId}.draw`;
          arr.dg.push(`Geometry.gm_${tag}_d`);
          drawCells = vr.drawCells;
        }
        for (const t of ["base", "base_s", "shade", "detail"]) textures[`gm_${tag}_${t}`] = `textures/gm/cloth/${tag}/${t}`;
        arr.base.push(`Texture.gm_${tag}_base`);
        arr.baseS.push(`Texture.gm_${tag}_base_s`);
        arr.shade.push(`Texture.gm_${tag}_shade`);
        arr.detail.push(`Texture.gm_${tag}_detail`);
        for (let a = 0; a < ATOLYE.clothSlots; a++) {
          textures[`gm_${tag}_at${a}`] = `textures/gm/cloth/${tag}/atolye_${a}`;
          arr.atolye.push(`Texture.gm_${tag}_at${a}`);
        }
        for (let ti = 0; ti < nTpl; ti++) {
          const regions = ti < TEMPLATES.length ? TEMPLATES[ti].regions : 1;
          const srcT = ti < TEMPLATES.length ? ti : 0;
          for (let r = 0; r < LIMITS.maxRegions; r++) {
            if (r < regions) {
              const key = `gm_${tag}_t${srcT}_r${r}`;
              textures[key] = `textures/gm/cloth/${tag}/t${String(srcT).padStart(2, "0")}_r${String(r).padStart(2, "0")}`;
              mask[r].push(`Texture.${key}`);
            } else mask[r].push("Texture.gm_blank");
          }
        }
        surfaces = vr.surfaces;
        motifSize = sh.motifSize;
        for (const [b, rule] of Object.entries(vr.boneRules)) boneRules.set(b, rule);
      }
    }

    // Katman kuralları: zırha değebilecek parçalar o zırh takılınca, bel ayrıntıları üst giyilince gizlenir.
    const partVis = [{ "*": true }];
    for (const [b, rule] of boneRules) {
      const conds = rule.keys.map((key) => `!v.gma${key}`);
      if (rule.under) conds.push("!(v.gmts > 0)");
      partVis.push({ [b]: conds.join(" && ") });
    }

    const worn = `${S} > 0 && ${THIRD}`;
    const notAt = `${T} < ${ATOLYE_TEMPLATE}`;
    const modeA = "v.gmmode == 0";
    const modeB = "v.gmmode == 1";
    const rc = (id, body, cond) => {
      rcs[id] = { geometry: `Array.g[${idx}]`, materials: [{ "*": "Material.gm" }], part_visibility: partVis, ...body };
      entityRCs.push({ [id]: cond });
    };
    const geoArr = { "Array.g": arr.g };

    rc(`controller.render.gm.${k}.base_a`, { arrays: { geometries: geoArr, textures: { "Array.t": arr.base } }, textures: [`Array.t[${idx}]`] }, `${worn} && ${notAt} && ${modeA}`);
    rc(`controller.render.gm.${k}.base_b`, { arrays: { geometries: geoArr, textures: { "Array.t": arr.baseS } }, textures: [`Array.t[${idx}]`] }, `${worn} && ${notAt} && ${modeB}`);
    rc(`controller.render.gm.${k}.atolye`, { arrays: { geometries: geoArr, textures: { "Array.t": arr.atolye } }, textures: [`Array.t[${idx} * ${ATOLYE.clothSlots} + ${T} - ${ATOLYE_TEMPLATE}]`] }, `${worn} && ${T} >= ${ATOLYE_TEMPLATE}`);

    for (let r = 0; r < LIMITS.maxRegions; r++) {
      const K = `v.gm${k}k${r}`;
      const body = { arrays: { geometries: geoArr, textures: { "Array.t": mask[r] } }, textures: [`Array.t[${idx} * ${nTpl} + ${T}]`] };
      rc(`controller.render.gm.${k}.r${r}_a`, { ...body, overlay_color: rgbExpr(K) }, `${worn} && ${notAt} && ${modeA} && ${K} > 0`);
      rc(`controller.render.gm.${k}.r${r}_b`, { ...body, materials: [{ "*": "Material.gm_tint" }], color: rgbExpr(K) }, `${worn} && ${notAt} && ${modeB} && ${K} > 0`);
    }

    rcs[`controller.render.gm.${k}.shade`] = {
      arrays: { geometries: geoArr, textures: { "Array.t": arr.shade } },
      geometry: `Array.g[${idx}]`, materials: [{ "*": "Material.gm_blend" }], textures: [`Array.t[${idx}]`], part_visibility: partVis,
    };
    entityRCs.push({ [`controller.render.gm.${k}.shade`]: `${worn} && (${modeA} || ${T} >= ${ATOLYE_TEMPLATE})` });
    rc(`controller.render.gm.${k}.detail`, { arrays: { geometries: geoArr, textures: { "Array.t": arr.detail } }, textures: [`Array.t[${idx}]`] }, worn);

    // Oyun içi çizim hücreleri (yalnızca hücre tanımı olan şekiller): renk başına bir geçiş.
    if (drawCells) {
      for (let c = 1; c <= DYES.length; c++) {
        const vis = [{ "*": false }];
        drawCells.forEach((_, n) => vis.push({ [drawBoneName(cat.id, n)]: `v.gm${k}d${n} == ${c}` }));
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
    const motArr = MCH.map((_, ch) => MOTIFS.map((m) => motTex(m, ch)));
    const photoArr = Array.from({ length: ATOLYE.photoSlots }, (_, p) => `Texture.gm_photo_${p}`);
    for (let m = 0; m < LIMITS.maxMotifs; m++) {
      const p = `v.gm${k}m${m}`;
      const vis = [{ "*": false }];
      surfaces.forEach((s, si) => {
        vis.push({ [motifBoneName(cat.id, m, si)]: `${p}f == ${si}` });
      });
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

      // Konum/dönme/ölçek: yuva × yüzey başına ayrı animasyon, yalnızca seçili yüzeyde çalışır.
      surfaces.forEach((s, si) => {
        const A = s.a[1] - s.a[0], B = s.b[1] - s.b[0];
        const kx = `(${p}w / 100)`, ky = `(${p}h / 100)`;
        const ca = `math.abs(math.cos(${p}r))`, sa = `math.abs(math.sin(${p}r))`;
        const hx = `(${motifSize / 2} * (${kx} * ${ca} + ${ky} * ${sa}))`;
        const hy = `(${motifSize / 2} * (${kx} * ${sa} + ${ky} * ${ca}))`;
        const oa = `((${p}x / 7.5 - 1) * math.max(0, ${(A / 2).toFixed(3)} - ${hx}))`;
        const ob = `((1 - ${p}y / 7.5) * math.max(0, ${(B / 2).toFixed(3)} - ${hy}))`;
        const R = `${p}r`;
        let pos, rot, scl;
        if (s.face === "north") { pos = [`${ANIM_X_SIGN} * ${oa}`, ob, "0"]; rot = ["0", "0", `${ANIM_ROT_SIGN} * ${R}`]; scl = [kx, ky, "1"]; }
        else if (s.face === "south") { pos = [`${-ANIM_X_SIGN} * ${oa}`, ob, "0"]; rot = ["0", "0", `${-ANIM_ROT_SIGN} * ${R}`]; scl = [kx, ky, "1"]; }
        else if (s.face === "east") { pos = ["0", ob, `-${oa}`]; rot = [`${-ANIM_ROT_SIGN} * ${R}`, "0", "0"]; scl = ["1", ky, kx]; }
        else { pos = ["0", ob, oa]; rot = [`${ANIM_ROT_SIGN} * ${R}`, "0", "0"]; scl = ["1", ky, kx]; }
        const an = `animation.gm.motif.${k}.${m}.${si}`;
        animations[an] = { loop: true, bones: { [motifBoneName(cat.id, m, si)]: { position: pos, rotation: rot, scale: scl } } };
        const key = `gm_m_${k}_${m}_${si}`;
        entityAnims[key] = an;
        animate.push({ [key]: `${S} > 0 && ${p}i > 0 && ${p}f == ${si}` });
      });
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
