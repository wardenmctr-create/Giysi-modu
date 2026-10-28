// Giysi Modu derleyicisi: katalogdan davranış + kaynak paketlerini üretir ve .mcaddon oluşturur.
// Kullanım: node tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { CATEGORIES, SHAPES, TEMPLATES, MOTIFS, DYES, SETS, LIMITS, validateCatalog } from "./catalog.mjs";
import { MOTIF_ART } from "./motif_art.mjs";
import { PROTO_SHAPES, MOTIF_SIZE } from "./gen/shapes_proto.mjs";
import { TEMPLATE_FN } from "./gen/templates.mjs";
import { layoutGarment, texels, buildGeometry, TEX } from "./gen/garment.mjs";
import { buildRender, patchPlayerEntity } from "./gen/render.mjs";
import { renderIso, lockedIcon, pixelIcon, SAMPLE } from "./gen/icons.mjs";
import { Canvas, shade } from "./lib/png.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "build");
const BP = path.join(OUT, "GiysiModu_BP");
const RP = path.join(OUT, "GiysiModu_RP");
const VERSION = [0, 1, 0];
const MIN_ENGINE = [1, 26, 0];
const ITEM_FMT = "1.21.90";
const UUID = {
  bp: "ba3d3cb8-1dce-4183-bc08-044bd0c952f5",
  bpData: "6eee8a05-a9ef-46ef-b508-6cad3ab72e25",
  bpScript: "6e8b2131-1cc8-4e27-aa90-d2f579b0cffe",
  rp: "ba591a77-4cb7-4d2d-805d-6929c3d53d54",
  rpRes: "f55a80f3-8fe2-417c-a256-a090146fbb45",
};
const DEPS = { server: "2.11.0", ui: "2.3.0" };

const report = { warnings: [], adaptations: [], counts: {} };
let fileCount = 0;

function write(base, rel, data) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 1));
  fileCount++;
}
const png = (base, rel, cv) => write(base, rel + ".png", cv.toPNG());

// ---------------------------------------------------------------- doğrulama
const errs = validateCatalog();
for (const m of MOTIFS) {
  const art = MOTIF_ART[m.id];
  if (!art) { errs.push(`motif çizimi yok: ${m.id}`); continue; }
  if (art.length !== 12 || art.some((r) => r.length !== 12)) errs.push(`motif ${m.id}: 12×12 değil`);
  const used = new Set(art.join("").replace(/\./g, ""));
  if (used.size !== m.ch) errs.push(`motif ${m.id}: ${used.size} kanal çizilmiş, katalogda ${m.ch}`);
}
for (const t of TEMPLATES) if (!TEMPLATE_FN[t.id]) errs.push(`şablon fonksiyonu yok: ${t.id}`);
if (errs.length) {
  console.error("Katalog hataları:\n  " + errs.join("\n  "));
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });

// ---------------------------------------------------------------- giysiler
const built = {};
const builtIndex = {};
const shapeData = {};
const BASE_WHITE = 0xf2f2f2;

for (const cat of CATEGORIES) {
  built[cat.id] = [];
  builtIndex[cat.id] = SHAPES[cat.id].map(() => -1);
  shapeData[cat.id] = [];
  SHAPES[cat.id].forEach((shape, si) => {
    const gen = PROTO_SHAPES[cat.id][si];
    const nn = String(si + 1).padStart(2, "0");
    if (!gen) {
      png(RP, `textures/gm/ui/shape_${cat.key}${nn}`, lockedIcon());
      shapeData[cat.id].push({ name: shape.name, style: shape.style, sets: shape.sets, built: -1, surfaces: [] });
      return;
    }
    const defs = gen();
    const variants = [];
    const texKey = `${cat.key}${nn}`;
    for (const [vtag, def] of Object.entries(defs)) {
      const tag = vtag === "std" ? "" : "s";
      const layout = layoutGarment(def.parts);
      const geoId = `geometry.gm.${texKey}${tag}`;
      const { geo, motifGeo } = buildGeometry(geoId, layout, {
        cat: cat.id, surfaces: def.surfaces, motifSize: MOTIF_SIZE[cat.id], maxMotifs: LIMITS.maxMotifs, armPivotY: def.pivotY,
      });
      write(RP, `models/entity/gm/${texKey}${tag}.geo.json`, geo);
      write(RP, `models/entity/gm/${texKey}${tag}.motif.geo.json`, motifGeo);
      const all = [...texels(layout)];
      const dir = `textures/gm/cloth/${texKey}${tag}`;
      const base = new Canvas(TEX, TEX);
      const detail = new Canvas(TEX, TEX);
      for (const t of all) {
        base.set(t.tx, t.ty, shade(BASE_WHITE, t.faceEdge ? 0.9 : 1));
        if (t.bottom && t.face !== "up" && t.face !== "down" && t.tx % 2 === 0) detail.set(t.tx, t.ty, 0x5a5a5a);
      }
      png(RP, `${dir}/base`, base);
      png(RP, `${dir}/detail`, detail);
      TEMPLATES.forEach((tpl, ti) => {
        const masks = Array.from({ length: tpl.regions }, () => new Canvas(TEX, TEX));
        const override = def.templateOverrides?.[tpl.id];
        const fn = override ?? TEMPLATE_FN[tpl.id];
        if (override) report.adaptations.push(`${cat.id}/${shape.name}${tag ? " (ince kol)" : ""}: "${tpl.name}" modele özel uyarlandı`);
        const seen = new Set();
        for (const t of all) {
          const r = fn(t);
          if (r < 0 || r >= tpl.regions) throw new Error(`${tpl.id} geçersiz bölge ${r}`);
          seen.add(r);
          masks[r].set(t.tx, t.ty, 0xffffff);
        }
        masks.forEach((m, r) => png(RP, `${dir}/t${String(ti).padStart(2, "0")}_r${String(r).padStart(2, "0")}`, m));
        if (seen.size !== tpl.regions)
          report.warnings.push(`${cat.id}/${shape.name}${tag ? " (ince kol)" : ""}: "${tpl.name}" ${seen.size}/${tpl.regions} bölge görünür — özel uyarlama gerekli`);
        if (!tag) {
          const iso = all.map((t) => ({ p: t.p, face: t.face, color: SAMPLE[fn(t)] }));
          png(RP, `textures/gm/ui/tpl_${texKey}_${String(ti).padStart(2, "0")}`, renderIso(iso));
          if (ti === 0) {
            const plain = all.map((t) => ({ p: t.p, face: t.face, color: 0xe8e8e8 }));
            png(RP, `textures/gm/ui/shape_${texKey}`, renderIso(plain));
          }
        }
      });
      const proBones = [...new Set(def.parts.filter((p) => p.pro).map((p) => `gm_${cat.id}_pro_${p.bone}`))];
      variants.push({ tag, geoId, surfaces: def.surfaces, proBones });
    }
    builtIndex[cat.id][si] = built[cat.id].length;
    shapeData[cat.id].push({
      name: shape.name, style: shape.style, sets: shape.sets, built: built[cat.id].length,
      surfaces: variants[0].surfaces.map((s) => s.name),
    });
    built[cat.id].push({ texKey, variants, motifSize: MOTIF_SIZE[cat.id] });
  });
}

// ---------------------------------------------------------------- motifler
for (const m of MOTIFS) {
  const art = MOTIF_ART[m.id];
  for (let ch = 0; ch < m.ch; ch++) {
    const cv = new Canvas(12, 12);
    art.forEach((row, y) => [...row].forEach((c, x) => { if (c === String(ch + 1)) cv.set(x, y, 0xffffff); }));
    png(RP, `textures/gm/motif/${m.id}_${ch}`, cv);
  }
  png(RP, `textures/gm/ui/motif_${m.id}`, pixelIcon(art, { 1: 0x2b2b2b, 2: 0xd23c3c, 3: 0xf2c230 }, 4));
}
png(RP, "textures/gm/blank", new Canvas(4, 4));

// ---------------------------------------------------------------- boyalar (arayüz simgeleri)
for (const d of DYES) {
  const cv = new Canvas(16, 16);
  cv.fill(3, 3, 10, 10, shade(d.rgb, 0.6));
  cv.fill(4, 4, 8, 8, d.rgb);
  cv.fill(5, 5, 3, 2, shade(d.rgb, 1.25));
  png(RP, `textures/gm/ui/dye_${d.id}`, cv);
}
const btn = (rgb, glyph) => {
  const cv = new Canvas(16, 16);
  cv.fill(1, 1, 14, 14, shade(rgb, 0.6));
  cv.fill(2, 2, 12, 12, rgb);
  glyph.forEach((row, y) => [...row].forEach((c, x) => c === "#" && cv.set(x + 3, y + 3, 0xffffff)));
  return cv;
};
png(RP, "textures/gm/ui/btn_motif", btn(0x3aa335, ["....#.....", "...###....", "..#####...", ".#######..", "..#####...", "...###....", "....#....."]));
png(RP, "textures/gm/ui/btn_done", btn(0x3aa335, [".........#", "........##", ".......##.", "#.....##..", "##...##...", ".##.##....", "..###....."]));
png(RP, "textures/gm/ui/btn_cancel", btn(0xb02e26, ["#........#", ".#......#.", "..#....#..", "...#..#...", "...#..#...", "..#....#..", ".#......#."]));
png(RP, "textures/gm/ui/btn_left", btn(0x555555, ["...#......", "..##......", ".#########", "##########", ".#########", "..##......", "...#......"]));
png(RP, "textures/gm/ui/btn_right", btn(0x555555, ["......#...", "......##..", "#########.", "##########", "#########.", "......##..", "......#..."]));
png(RP, "textures/gm/ui/btn_up", btn(0x555555, ["....##....", "...####...", "..######..", ".########.", "....##....", "....##....", "....##...."]));
png(RP, "textures/gm/ui/btn_down", btn(0x555555, ["....##....", "....##....", "....##....", ".########.", "..######..", "...####...", "....##...."]));
png(RP, "textures/gm/ui/btn_rotate", btn(0x3c44aa, ["..#####...", ".#.....#..", "#.......#.", "#.......#.", "#.....###.", ".#.....#..", "..##......"]));

// ---------------------------------------------------------------- eşya simgeleri
const ITEM_ART = {
  hat: ["................", "................", "................", "......####......", "....########....", "...##########...", "...##########...", "..############..", "..############..", "..############..", "..############..", "..++++++++++++..", "..++++++++++++..", "................", "................", "................"],
  top: ["................", "...####..####...", "..######..#####.", ".##############.", "################", "################", "####.######.####", "###..######..###", ".....######.....", ".....######.....", ".....######.....", ".....######.....", ".....######.....", ".....++++++.....", "................", "................"],
  pants: ["................", "...++++++++++...", "...##########...", "...##########...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...####..####...", "...++++..++++...", "................", "................"],
  shoes: ["................", "................", "................", "................", "................", "...####.........", "...####.........", "...####.........", "...######.......", "..#########.....", "..##########....", "..###########...", "..+++++++++++...", "................", "................", "................"],
};
for (const cat of CATEGORIES) {
  png(RP, `textures/gm/items/${cat.id}_base`, pixelIcon(ITEM_ART[cat.id], { "#": 0xf0f0f0, "+": 0xbdbdbd }));
  png(RP, `textures/gm/items/${cat.id}`, pixelIcon(ITEM_ART[cat.id], { "#": 0x3c44aa, "+": 0xfed83d }));
}
const BAG_ART = ["................", "......####......", ".....#....#.....", "......####......", ".....######.....", "...##########...", "..############..", "..####++++####..", "..####+..+####..", "..####++++####..", "..############..", "..############..", "..############..", "...##########...", "................", "................"];
const BAG_OPEN_BACK = ["................", "................", "................", "................", "................", "...##########...", "..############..", "..############..", "..############..", "..############..", "..############..", "..############..", "..############..", "...##########...", "................", "................"];
const BAG_OPEN_FRONT = ["................", "................", "................", "................", "................", "................", "................", "..############..", "..####++++####..", "..####+..+####..", "..####++++####..", "..############..", "..############..", "...##########...", "................", "................"];
for (const d of DYES) {
  const pal = { "#": d.rgb, "+": shade(d.rgb, 0.65) };
  png(RP, `textures/gm/items/bag_${d.id}`, pixelIcon(BAG_ART, pal));
  png(RP, `textures/gm/items/bag_${d.id}_open_back`, pixelIcon(BAG_OPEN_BACK, { "#": shade(d.rgb, 0.55) }));
  png(RP, `textures/gm/items/bag_${d.id}_open_front`, pixelIcon(BAG_OPEN_FRONT, pal));
}

// ---------------------------------------------------------------- çanta (3B, 128×128, 16 renk)
{
  const parts = [
    { origin: [-4, 0, -3], size: [8, 7, 6] },
    { origin: [-3, 7, -2], size: [6, 1.5, 4] },
    { origin: [-3.5, 8.5, -2.5], size: [7, 1, 5] },
    { origin: [-4.5, 3, -3.5], size: [9, 4, 0.5] },
    { origin: [-1, 3.5, -3.75], size: [2, 2, 0.25] },
  ];
  const layout = layoutGarment(parts);
  const cubes = parts.map((p, pi) => {
    const uv = {};
    for (const f of layout.faces.filter((f) => f.part === pi)) {
      uv[f.face] = f.face === "up" ? { uv: [f.x + f.w, f.y + f.h], uv_size: [-f.w, -f.h] }
        : f.face === "down" ? { uv: [f.x + f.w, f.y], uv_size: [-f.w, f.h] } : { uv: [f.x, f.y], uv_size: [f.w, f.h] };
    }
    return { origin: p.origin, size: p.size, uv };
  });
  write(RP, "models/entity/gm/bag.geo.json", {
    format_version: "1.16.0",
    "minecraft:geometry": [{
      description: { identifier: "geometry.gm.bag", texture_width: 128, texture_height: 128, visible_bounds_width: 1, visible_bounds_height: 1 },
      bones: [{ name: "bag", pivot: [0, 0, 0], cubes }],
    }],
  });
  const all = [...texels(layout)];
  for (const d of DYES) {
    const cv = new Canvas(128, 128);
    for (const t of all) {
      let c = d.rgb;
      if (t.part === 3) c = shade(d.rgb, 0.75);
      if (t.part === 1 || t.part === 2) c = 0x7a4a24;
      if (t.part === 4) c = 0xd8b030;
      if (t.faceEdge) c = shade(c, 0.8);
      if ((t.tx + t.ty) % 7 === 0 && t.part === 0) c = shade(c, 0.93);
      cv.set(t.tx, t.ty, c);
    }
    png(RP, `textures/gm/entity/bag_${d.id}`, cv);
  }
}

// ---------------------------------------------------------------- tezgâh bloğu
{
  write(RP, "models/blocks/gm_workbench.geo.json", {
    format_version: "1.16.0",
    "minecraft:geometry": [{
      description: { identifier: "geometry.gm.workbench", texture_width: 32, texture_height: 32 },
      bones: [{
        name: "wb", pivot: [0, 0, 0], cubes: [
          { origin: [-8, 12, -8], size: [16, 4, 16], uv: { north: { uv: [0, 0], uv_size: [16, 4] }, south: { uv: [0, 0], uv_size: [16, 4] }, east: { uv: [0, 0], uv_size: [16, 4] }, west: { uv: [0, 0], uv_size: [16, 4] }, up: { uv: [16, 16], uv_size: [16, 16] }, down: { uv: [0, 16], uv_size: [16, 16] } } },
          ...[[-7, -7], [5, -7], [-7, 5], [5, 5]].map(([x, z]) => ({ origin: [x, 0, z], size: [2, 12, 2], uv: { north: { uv: [0, 4], uv_size: [2, 12] }, south: { uv: [0, 4], uv_size: [2, 12] }, east: { uv: [0, 4], uv_size: [2, 12] }, west: { uv: [0, 4], uv_size: [2, 12] }, down: { uv: [0, 4], uv_size: [2, 2] } } })),
          { origin: [-1, 16, 2], size: [2, 10, 2], uv: { north: { uv: [4, 4], uv_size: [2, 10] }, south: { uv: [4, 4], uv_size: [2, 10] }, east: { uv: [4, 4], uv_size: [2, 10] }, west: { uv: [4, 4], uv_size: [2, 10] }, up: { uv: [4, 4], uv_size: [2, 2] } } },
          { origin: [-4, 20, 1.5], size: [8, 6, 3], uv: { north: { uv: [8, 4], uv_size: [8, 6] }, south: { uv: [8, 4], uv_size: [8, 6] }, east: { uv: [16, 4], uv_size: [3, 6] }, west: { uv: [16, 4], uv_size: [3, 6] }, up: { uv: [8, 10], uv_size: [8, 3] }, down: { uv: [8, 10], uv_size: [8, 3] } } },
        ],
      }],
    }],
  });
  const cv = new Canvas(32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) cv.set(x, y, shade(0xa0784a, 0.9 + ((x * 7 + y * 3) % 5) * 0.03));
  cv.fill(4, 4, 2, 12, 0x6b4a2a);
  cv.fill(8, 4, 8, 6, 0xf2f2f2);
  cv.fill(10, 6, 4, 2, 0x3c44aa);
  cv.fill(16, 4, 3, 6, 0xe0e0e0);
  cv.fill(8, 10, 8, 3, 0xe0e0e0);
  for (let i = 0; i < 16; i += 4) cv.fill(16 + i, 16, 2, 16, 0x8a6338);
  cv.fill(20, 20, 6, 6, 0xb02e26);
  cv.fill(22, 22, 2, 2, 0xfed83d);
  png(RP, "textures/gm/blocks/workbench", cv);
}

// ---------------------------------------------------------------- render (oyuncu)
const vanillaPlayer = JSON.parse(fs.readFileSync(path.join(ROOT, "src/vanilla/player.entity.json"), "utf8"));
const R = buildRender({ CATEGORIES, TEMPLATES, MOTIFS, built, LIMITS });
write(RP, "entity/player.entity.json", patchPlayerEntity(vanillaPlayer, R));
write(RP, "render_controllers/gm_player.render_controllers.json", R.rcFile);
write(RP, "animations/gm_player.animation.json", R.animFile);
write(RP, "models/entity/gm/empty.geo.json", {
  format_version: "1.16.0",
  "minecraft:geometry": [{ description: { identifier: "geometry.gm.empty", texture_width: 16, texture_height: 16 }, bones: [{ name: "root", pivot: [0, 0, 0] }] }],
});
report.counts.renderControllers = Object.keys(R.rcFile.render_controllers).length;
report.counts.playerTextures = Object.keys(R.textures).length;

// ---------------------------------------------------------------- yerleştirilmiş çanta varlığı
write(RP, "entity/gm_placed_bag.entity.json", {
  format_version: "1.10.0",
  "minecraft:client_entity": {
    description: {
      identifier: "gm:placed_bag",
      materials: { default: "entity_alphatest" },
      textures: Object.fromEntries(DYES.map((d) => [d.id, `textures/gm/entity/bag_${d.id}`])),
      geometry: { default: "geometry.gm.bag" },
      render_controllers: ["controller.render.gm.placed_bag"],
      spawn_egg: { base_color: "#835432", overlay_color: "#f9fffe" },
    },
  },
});
write(RP, "render_controllers/gm_bag.render_controllers.json", {
  format_version: "1.10.0",
  render_controllers: {
    "controller.render.gm.placed_bag": {
      arrays: { textures: { "Array.c": DYES.map((d) => `Texture.${d.id}`) } },
      geometry: "Geometry.default",
      materials: [{ "*": "Material.default" }],
      textures: ["Array.c[q.property('gm:color')]"],
    },
  },
});
write(BP, "entities/gm_placed_bag.json", {
  format_version: ITEM_FMT,
  "minecraft:entity": {
    description: {
      identifier: "gm:placed_bag", is_spawnable: false, is_summonable: true,
      properties: { "gm:color": { type: "int", range: [0, 15], default: 0, client_sync: true } },
    },
    components: {
      "minecraft:type_family": { family: ["gm_bag", "inanimate"] },
      "minecraft:collision_box": { width: 0.6, height: 0.6 },
      "minecraft:health": { value: 1, max: 1 },
      "minecraft:damage_sensor": { triggers: [{ cause: "all", deals_damage: "no" }] },
      "minecraft:inventory": { container_type: "container", inventory_size: LIMITS.bagSlots },
      "minecraft:persistent": {},
      "minecraft:physics": {},
      "minecraft:pushable": { is_pushable: false, is_pushable_by_piston: false },
      "minecraft:knockback_resistance": { value: 1 },
      "minecraft:movement": { value: 0 },
      "minecraft:fire_immune": {},
      "minecraft:nameable": { always_show: false, allow_name_tag_renaming: false },
    },
  },
});

// ---------------------------------------------------------------- eşyalar
const itemTex = {};
const itemFile = (id, icon, components, category = "equipment") => ({
  format_version: ITEM_FMT,
  "minecraft:item": {
    description: { identifier: id, menu_category: { category } },
    components: { "minecraft:icon": icon, "minecraft:display_name": { value: `item.${id.replace(":", ".")}` }, ...components },
  },
});
for (const cat of CATEGORIES) {
  itemTex[`gm_${cat.id}_base`] = { textures: `textures/gm/items/${cat.id}_base` };
  itemTex[`gm_${cat.id}`] = { textures: `textures/gm/items/${cat.id}` };
  write(BP, `items/${cat.id}_base.json`, itemFile(cat.baseItem, `gm_${cat.id}_base`, { "minecraft:max_stack_size": 1 }));
  write(BP, `items/${cat.id}.json`, itemFile(cat.item, `gm_${cat.id}`, {
    "minecraft:max_stack_size": 1,
    "minecraft:storage_weight_modifier": { weight_in_storage_item: 1 },
  }, "none"));
}
const CLOTH_ITEMS = CATEGORIES.map((c) => c.item);
for (const d of DYES) {
  const id = `gm:bag_${d.id}`;
  itemTex[`gm_bag_${d.id}`] = { textures: `textures/gm/items/bag_${d.id}` };
  itemTex[`gm_bag_${d.id}_open_back`] = { textures: `textures/gm/items/bag_${d.id}_open_back` };
  itemTex[`gm_bag_${d.id}_open_front`] = { textures: `textures/gm/items/bag_${d.id}_open_front` };
  write(BP, `items/bag_${d.id}.json`, {
    format_version: ITEM_FMT,
    "minecraft:item": {
      description: { identifier: id, menu_category: { category: "equipment" } },
      components: {
        "minecraft:icon": { textures: { default: `gm_bag_${d.id}`, bundle_open_back: `gm_bag_${d.id}_open_back`, bundle_open_front: `gm_bag_${d.id}_open_front` } },
        "minecraft:display_name": { value: `item.gm.bag_${d.id}` },
        "minecraft:max_stack_size": 1,
        "minecraft:storage_item": { max_slots: LIMITS.bagSlots, allow_nested_storage_items: false, allowed_items: CLOTH_ITEMS },
        "minecraft:storage_weight_limit": { max_weight_limit: LIMITS.bagSlots },
        "minecraft:bundle_interaction": { num_viewable_slots: LIMITS.bagSlots },
        "gm:bag": {},
      },
    },
  });
}
write(RP, "textures/item_texture.json", { resource_pack_name: "GiysiModu", texture_name: "atlas.items", texture_data: itemTex });

// ---------------------------------------------------------------- blok
write(BP, "blocks/workbench.json", {
  format_version: ITEM_FMT,
  "minecraft:block": {
    description: { identifier: "gm:workbench", menu_category: { category: "items" } },
    components: {
      "minecraft:geometry": "geometry.gm.workbench",
      "minecraft:material_instances": { "*": { texture: "gm_workbench", render_method: "alpha_test" } },
      "minecraft:collision_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
      "minecraft:selection_box": { origin: [-8, 0, -8], size: [16, 16, 16] },
      "minecraft:destructible_by_mining": { seconds_to_destroy: 1.2 },
      "minecraft:destructible_by_explosion": { explosion_resistance: 3 },
      "minecraft:flammable": { catch_chance_modifier: 5, destroy_chance_modifier: 20 },
      "minecraft:map_color": "#a0784a",
      "minecraft:display_name": "tile.gm.workbench.name",
      "minecraft:light_dampening": 0,
      "gm:workbench": {},
    },
  },
});
write(RP, "textures/terrain_texture.json", {
  resource_pack_name: "GiysiModu", texture_name: "atlas.terrain", padding: 8, num_mip_levels: 4,
  texture_data: { gm_workbench: { textures: "textures/gm/blocks/workbench" } },
});
write(RP, "blocks.json", { format_version: [1, 1, 0], "gm:workbench": { sound: "wood" } });

// ---------------------------------------------------------------- tarifler
const recipe = (kind, id, body) => ({
  format_version: "1.20.10",
  [`minecraft:recipe_${kind}`]: { description: { identifier: id }, tags: ["crafting_table"], ...body },
});
const PATTERNS = { hat: ["###", "# #"], top: ["# #", "###", "###"], pants: ["###", "# #", "# #"], shoes: ["# #", "# #"] };
for (const cat of CATEGORIES) {
  write(BP, `recipes/${cat.id}_base.json`, recipe("shaped", `${cat.baseItem}`, {
    pattern: PATTERNS[cat.id], key: { "#": { item: "minecraft:white_wool" } },
    unlock: [{ item: "minecraft:white_wool" }], result: { item: cat.baseItem },
  }));
}
write(BP, "recipes/workbench.json", recipe("shapeless", "gm:workbench", {
  ingredients: [{ tag: "minecraft:planks", count: 2 }, { item: "minecraft:stick", count: 2 }, { item: "minecraft:white_wool" }],
  unlock: [{ item: "minecraft:white_wool" }], result: { item: "gm:workbench" },
}));
for (const d of DYES) {
  write(BP, `recipes/bag_${d.id}.json`, recipe("shapeless", `gm:bag_${d.id}`, {
    ingredients: [{ tag: "minecraft:wool" }, { item: "minecraft:leather" }, { item: `minecraft:${d.id}_dye` }],
    unlock: [{ item: "minecraft:leather" }], result: { item: `gm:bag_${d.id}` },
  }));
}

// ---------------------------------------------------------------- arayüz: form içinde canlı önizleme
write(RP, "ui/server_form.json", {
  namespace: "server_form",
  long_form_scrolling_content: {
    modifications: [{ array_name: "controls", operation: "insert_front", value: [{ "gm_preview@server_form.gm_preview_panel": {} }] }],
  },
  gm_preview_panel: {
    type: "panel",
    size: ["100%", 112],
    bindings: [
      { binding_name: "#title_text" },
      { binding_type: "view", source_property_name: "(not ((#title_text - '§g§m') = #title_text))", target_property_name: "#visible" },
    ],
    controls: [{
      gm_preview_bg: {
        type: "image", texture: "textures/ui/Black", size: [84, 108], layer: 2,
        controls: [{
          gm_preview_renderer_panel: {
            type: "panel", size: [52, 52], offset: [0, -20],
            controls: [{
              gm_preview_renderer: {
                type: "custom", renderer: "live_player_renderer", property_bag: { "#look_at_cursor": false },
                layer: 8, anchor_from: "center", anchor_to: "center",
              },
            }],
          },
        }],
      },
    }],
  },
});

// ---------------------------------------------------------------- dil dosyaları
const LANG = {
  tr_TR: {
    "item.gm.hat_base": "Beyaz Temel Şapka", "item.gm.top_base": "Beyaz Temel Üst",
    "item.gm.pants_base": "Beyaz Temel Pantolon", "item.gm.shoes_base": "Beyaz Temel Ayakkabı",
    "item.gm.hat": "Şapka", "item.gm.top": "Elbise/Üst", "item.gm.pants": "Pantolon", "item.gm.shoes": "Ayakkabı",
    "tile.gm.workbench.name": "Giysi Tezgâhı", "entity.gm:placed_bag.name": "Giysi Çantası",
    ...Object.fromEntries(DYES.map((d) => [`item.gm.bag_${d.id}`, `Giysi Çantası (${d.name})`])),
  },
  en_US: {
    "item.gm.hat_base": "White Base Hat", "item.gm.top_base": "White Base Top",
    "item.gm.pants_base": "White Base Pants", "item.gm.shoes_base": "White Base Shoes",
    "item.gm.hat": "Hat", "item.gm.top": "Dress/Top", "item.gm.pants": "Pants", "item.gm.shoes": "Shoes",
    "tile.gm.workbench.name": "Clothing Workbench", "entity.gm:placed_bag.name": "Clothing Bag",
    ...Object.fromEntries(DYES.map((d) => [`item.gm.bag_${d.id}`, `Clothing Bag (${d.id.replace("_", " ")})`])),
  },
};
for (const [lang, entries] of Object.entries(LANG)) {
  const body = Object.entries(entries).map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
  write(RP, `texts/${lang}.lang`, body);
  write(BP, `texts/${lang}.lang`, `pack.name=Giysi Modu\npack.description=Giysi tasarım addon'u (doğrulama prototipi)\n`);
}
write(RP, "texts/languages.json", Object.keys(LANG));
write(BP, "texts/languages.json", Object.keys(LANG));
for (const [lang] of Object.entries(LANG)) {
  fs.appendFileSync(path.join(RP, `texts/${lang}.lang`), `pack.name=Giysi Modu\npack.description=Giysi tasarım addon'u (doğrulama prototipi)\n`);
}

// ---------------------------------------------------------------- manifestler
write(BP, "manifest.json", {
  format_version: 2,
  header: { name: "pack.name", description: "pack.description", uuid: UUID.bp, version: VERSION, min_engine_version: MIN_ENGINE },
  modules: [
    { type: "data", uuid: UUID.bpData, version: VERSION },
    { type: "script", language: "javascript", uuid: UUID.bpScript, version: VERSION, entry: "scripts/main.js" },
  ],
  dependencies: [
    { uuid: UUID.rp, version: VERSION },
    { module_name: "@minecraft/server", version: DEPS.server },
    { module_name: "@minecraft/server-ui", version: DEPS.ui },
  ],
});
write(RP, "manifest.json", {
  format_version: 2,
  header: { name: "pack.name", description: "pack.description", uuid: UUID.rp, version: VERSION, min_engine_version: MIN_ENGINE },
  modules: [{ type: "resources", uuid: UUID.rpRes, version: VERSION }],
  dependencies: [{ uuid: UUID.bp, version: VERSION }],
});
const icon = renderIso([...texels(layoutGarment([{ origin: [-4, 0, -4], size: [8, 8, 8] }]))].map((t) => ({ p: t.p, face: t.face, color: SAMPLE[TEMPLATE_FN.dama(t)] })), 128);
png(BP, "pack_icon", icon);
png(RP, "pack_icon", icon);

// ---------------------------------------------------------------- scriptler
const dataModule = {
  CATEGORIES: CATEGORIES.map(({ id, key, name, baseItem, item }) => ({ id, key, name, baseItem, item })),
  SHAPES: shapeData,
  TEMPLATES, MOTIFS, SETS, LIMITS,
  DYES: DYES.map(({ id, name, rgb }) => ({ id, name, rgb })),
};
write(BP, "scripts/data.js", `// Otomatik üretildi (tools/build.mjs). Elle düzenlemeyin.\nexport const DATA = ${JSON.stringify(dataModule)};\n`);
const scriptDir = path.join(ROOT, "src/scripts");
for (const f of fs.readdirSync(scriptDir)) write(BP, `scripts/${f}`, fs.readFileSync(path.join(scriptDir, f)));

// ---------------------------------------------------------------- paketleme
const dist = path.join(ROOT, "dist");
fs.mkdirSync(dist, { recursive: true });
const target = path.join(dist, "GiysiModu.mcaddon");
fs.rmSync(target, { force: true });
execFileSync("zip", ["-qr9", target, "GiysiModu_BP", "GiysiModu_RP"], { cwd: OUT });

report.counts.files = fileCount;
report.counts.builtShapes = Object.fromEntries(CATEGORIES.map((c) => [c.id, built[c.id].length]));
report.counts.mcaddonBytes = fs.statSync(target).size;
write(OUT, "report.json", report);
console.log(`Dosya: ${fileCount}, render controller: ${report.counts.renderControllers}, oyuncu dokusu: ${report.counts.playerTextures}`);
console.log(`Üretilen şekiller: ${JSON.stringify(report.counts.builtShapes)}`);
for (const a of report.adaptations) console.log("  uyarlama: " + a);
for (const w of report.warnings) console.log("  UYARI: " + w);
if (report.warnings.length) process.exitCode = 2;
console.log(`→ ${path.relative(ROOT, target)} (${(report.counts.mcaddonBytes / 1024).toFixed(0)} KB)`);
