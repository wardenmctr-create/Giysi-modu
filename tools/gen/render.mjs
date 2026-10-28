// Oyuncu istemci varlığı, giysi render controller'ları ve motif animasyonları.
// Veri yolu: script → playAnimation(stopExpression) → Molang değişkenleri.
//   v.gm<k>* = giyili, v.gq<k>* = tezgâh önizlemesi (yalnızca tasarlayan oyuncuya gönderilir).

import { motifBoneName } from "./garment.mjs";

// Bedrock animasyon konumunda X ekseninin geometriye göre ters olduğu varsayımı.
// Kapı testinde motif sağ/sol hareketi ters çıkarsa yalnızca bu değer değiştirilir.
export const ANIM_X_SIGN = -1;

const THIRD = "!variable.is_first_person && !variable.map_face_icon && !query.is_spectator";

export function VAL(k, f) {
  return `((q.is_in_ui && v.gq${k}on) ? v.gq${k}${f} : v.gm${k}${f})`;
}

function rgbExpr(expr) {
  return {
    r: `math.floor(${expr} / 65536) / 255`,
    g: `math.mod(math.floor(${expr} / 256), 256) / 255`,
    b: `math.mod(${expr}, 256) / 255`,
    a: "1.0",
  };
}

const MCH = ["a", "b", "c"];

// built: { [catId]: [{ key, variants:[{tag, layout, surfaces, templatesRegions...}] }] }
export function buildRender({ CATEGORIES, TEMPLATES, MOTIFS, built, LIMITS }) {
  const textures = { gm_blank: "textures/gm/blank" };
  const geometry = { gm_empty: "geometry.gm.empty" };
  const rcs = {};
  const entityRCs = [];
  const animations = {};
  const entityAnims = {};
  const animate = [];

  for (const cat of CATEGORIES) {
    const k = cat.key;
    const shapes = built[cat.id];
    const V = cat.id === "top" ? 2 : 1;
    const S = VAL(k, "s");
    const T = VAL(k, "t");
    const variantIdx = V === 2 ? `((${S} - 1) * 2 + v.gmslim)` : `(${S} - 1)`;
    const geoArr = [], mgeoArr = [], baseArr = [], detailArr = [];
    const maskArr = Array.from({ length: LIMITS.maxRegions }, () => []);
    let surfaces = null;
    for (const sh of shapes) {
      for (let vi = 0; vi < V; vi++) {
        const variant = sh.variants[Math.min(vi, sh.variants.length - 1)];
        const tag = `${sh.texKey}${variant.tag}`;
        geometry[`gm_${tag}`] = variant.geoId;
        geometry[`gm_${tag}_m`] = `${variant.geoId}.motif`;
        geoArr.push(`Geometry.gm_${tag}`);
        mgeoArr.push(`Geometry.gm_${tag}_m`);
        textures[`gm_${tag}_base`] = `textures/gm/cloth/${tag}/base`;
        textures[`gm_${tag}_detail`] = `textures/gm/cloth/${tag}/detail`;
        baseArr.push(`Texture.gm_${tag}_base`);
        detailArr.push(`Texture.gm_${tag}_detail`);
        TEMPLATES.forEach((tpl, ti) => {
          for (let r = 0; r < LIMITS.maxRegions; r++) {
            if (r < tpl.regions) {
              const key = `gm_${tag}_t${ti}_r${r}`;
              textures[key] = `textures/gm/cloth/${tag}/t${String(ti).padStart(2, "0")}_r${String(r).padStart(2, "0")}`;
              maskArr[r].push(`Texture.${key}`);
            } else maskArr[r].push("Texture.gm_blank");
          }
        });
        surfaces = variant.surfaces;
        variant.proBones = variant.proBones || [];
      }
    }
    const armor = `(q.is_in_ui || !v.gma${k})`;
    const proBones = [...new Set(shapes.flatMap((s) => s.variants.flatMap((v) => v.proBones)))];
    const partVis = [{ "*": true }, ...proBones.map((b) => ({ [b]: armor }))];
    const visible = `${S} > 0 && ${THIRD}`;
    const mainIdx = `${variantIdx}`;
    const maskIdx = `(${variantIdx} * 25 + ${T})`;

    rcs[`controller.render.gm.${k}.base`] = {
      arrays: { geometries: { "Array.g": geoArr }, textures: { "Array.t": baseArr } },
      geometry: `Array.g[${mainIdx}]`,
      materials: [{ "*": "Material.gm" }],
      textures: [`Array.t[${mainIdx}]`],
      part_visibility: partVis,
    };
    entityRCs.push({ [`controller.render.gm.${k}.base`]: visible });

    for (let r = 0; r < LIMITS.maxRegions; r++) {
      const K = VAL(k, `k${r}`);
      const id = `controller.render.gm.${k}.r${r}`;
      rcs[id] = {
        arrays: { geometries: { "Array.g": geoArr }, textures: { "Array.t": maskArr[r] } },
        geometry: `Array.g[${mainIdx}]`,
        materials: [{ "*": "Material.gm" }],
        textures: [`Array.t[${maskIdx}]`],
        part_visibility: partVis,
        overlay_color: rgbExpr(K),
      };
      entityRCs.push({ [id]: `${visible} && ${K} > 0` });
    }

    rcs[`controller.render.gm.${k}.detail`] = {
      arrays: { geometries: { "Array.g": geoArr }, textures: { "Array.t": detailArr } },
      geometry: `Array.g[${mainIdx}]`,
      materials: [{ "*": "Material.gm" }],
      textures: [`Array.t[${mainIdx}]`],
      part_visibility: partVis,
    };
    entityRCs.push({ [`controller.render.gm.${k}.detail`]: visible });

    // Motif yuvaları: her yuva × renk kanalı ayrı geçiş. Sonraki yuva dışa doğru çok az ötelenir (üstte görünür).
    const motArr = MCH.map((_, ch) => MOTIFS.map((m) => (ch < m.ch ? `Texture.gm_mot_${m.id}_${ch}` : "Texture.gm_blank")));
    for (let m = 0; m < LIMITS.maxMotifs; m++) {
      const I = VAL(k, `m${m}i`);
      const F = VAL(k, `m${m}f`);
      const vis = [{ "*": false }];
      surfaces.forEach((s, si) => {
        vis.push({ [motifBoneName(cat.id, m, si)]: s.pro ? `${F} == ${si} && ${armor}` : `${F} == ${si}` });
      });
      for (let ch = 0; ch < 3; ch++) {
        const C = VAL(k, `m${m}${MCH[ch]}`);
        const id = `controller.render.gm.${k}.m${m}.${ch}`;
        rcs[id] = {
          arrays: { geometries: { "Array.g": mgeoArr }, textures: { "Array.t": motArr[ch] } },
          geometry: `Array.g[${mainIdx}]`,
          materials: [{ "*": "Material.gm" }],
          textures: [`Array.t[${I} - 1]`],
          part_visibility: vis,
          overlay_color: rgbExpr(C),
        };
        entityRCs.push({ [id]: `${visible} && ${I} > 0 && ${C} > 0` });
      }
    }

    // Motif konum animasyonu: x,y ∈ 0..15 yüzey içinde merkezden ±aralık; sınır dışına çıkamaz.
    const bones = {};
    const motifSize = shapes[0].motifSize;
    for (let m = 0; m < LIMITS.maxMotifs; m++) {
      const X = VAL(k, `m${m}x`);
      const Y = VAL(k, `m${m}y`);
      surfaces.forEach((s, si) => {
        const ra = Math.max(0, (s.a[1] - s.a[0] - motifSize) / 2);
        const rb = Math.max(0, (s.b[1] - s.b[0] - motifSize) / 2);
        const oa = `((${X} / 7.5 - 1) * ${ra.toFixed(3)})`;
        const ob = `((1 - ${Y} / 7.5) * ${rb.toFixed(3)})`;
        let pos;
        if (s.face === "north") pos = [`${ANIM_X_SIGN} * ${oa}`, ob, "0"];
        else if (s.face === "south") pos = [`${-ANIM_X_SIGN} * ${oa}`, ob, "0"];
        else if (s.face === "east") pos = ["0", ob, `-${oa}`];
        else pos = ["0", ob, oa];
        bones[motifBoneName(cat.id, m, si)] = { position: pos };
      });
    }
    animations[`animation.gm.motif.${k}`] = { loop: true, bones };
    entityAnims[`gm_motif_${k}`] = `animation.gm.motif.${k}`;
    animate.push({ [`gm_motif_${k}`]: `${S} > 0` });
  }

  animations["animation.gm.sync"] = { loop: true, animation_length: 1, bones: {} };
  animations["animation.gm.preview"] = { loop: true, bones: { root: { rotation: [0, "v.gqyaw", 0] } } };
  entityAnims.gm_preview = "animation.gm.preview";
  animate.push({ gm_preview: "q.is_in_ui && v.gqyaw != 0" });

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
  Object.assign(d.textures, r.textures);
  Object.assign(d.geometry, r.geometry);
  Object.assign(d.animations, r.entityAnims);
  d.scripts.animate = [...d.scripts.animate, ...r.animate];
  d.render_controllers = [...d.render_controllers, ...r.entityRCs];
  return e;
}
