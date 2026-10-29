// Giysi parçalarını 128×128 dokuya yerleştirir, her dokselin 3B konumunu ve giysiye göre
// sürekli koordinatlarını (gövde çevresi U, yükseklik V) hesaplar, Bedrock geometrisini üretir.

export const TEX = 128;
export const DENSITY = 2; // birim başına doksel (64'lük skin çözünürlüğünün iki katı)
// Motif dörtgeni giysi yüzeyinden MOTIF_BASE kadar dışarıda; her sonraki yuva MOTIF_STEP daha dışarıda (üstte).
// Çakışma (titreme) olmaması için giysi yüzeyine en az 0,1 birim uzaklık gerekir.
export const MOTIF_BASE = 0.12;
export const MOTIF_STEP = 0.02;

const FACES = ["north", "south", "east", "west", "up", "down"];
export const NORMAL = {
  north: [0, 0, -1], south: [0, 0, 1], east: [-1, 0, 0], west: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0],
};

// Parça: dış ölçüleriyle kutu. Sağ taraf için tanımlanıp mirror() ile sola kopyalanabilir.
export function box(bone, from, to, extra = {}) {
  return { bone, from, to, role: "body", ...extra };
}

const SWAP = { rightArm: "leftArm", leftArm: "rightArm", rightLeg: "leftLeg", leftLeg: "rightLeg" };
const FACE_SWAP = { east: "west", west: "east" };
export function mirror(part) {
  return {
    ...part, bone: SWAP[part.bone] ?? part.bone,
    from: [-part.to[0], part.from[1], part.from[2]], to: [-part.from[0], part.to[1], part.to[2]],
    skip: part.skip?.map((f) => FACE_SWAP[f] ?? f), mirrored: !part.mirrored,
  };
}

// Çevre koordinatı için kemik grubunun kesiti (oyuncu modeli dinlenme pozu).
export function groups(slim = false) {
  const aw = slim ? 1.5 : 2;
  const ax = slim ? 5.5 : 6;
  return {
    head: { cx: 0, cz: 0, hw: 4, hd: 4 },
    body: { cx: 0, cz: 0, hw: 4, hd: 2 },
    rightArm: { cx: -ax, cz: 0, hw: aw, hd: 2 },
    leftArm: { cx: ax, cz: 0, hw: aw, hd: 2 },
    rightLeg: { cx: -1.9, cz: 0, hw: 2, hd: 2 },
    leftLeg: { cx: 1.9, cz: 0, hw: 2, hd: 2 },
  };
}

function dims(p, face) {
  const s = [p.to[0] - p.from[0], p.to[1] - p.from[1], p.to[2] - p.from[2]];
  if (face === "north" || face === "south") return [s[0], s[1]];
  if (face === "east" || face === "west") return [s[2], s[1]];
  return [s[0], s[2]];
}

// Kutu-UV yönelimi: north'ta u: x küçükten büyüğe (giyenin sağından soluna), v: yukarıdan aşağı.
function facePoint(p, face, u, v) {
  const [x0, y0, z0] = p.from;
  const [x1, y1, z1] = p.to;
  const L = (a, b, t) => a + (b - a) * t;
  switch (face) {
    case "north": return [L(x0, x1, u), L(y1, y0, v), z0];
    case "south": return [L(x1, x0, u), L(y1, y0, v), z1];
    case "east": return [x0, L(y1, y0, v), L(z1, z0, u)];
    case "west": return [x1, L(y1, y0, v), L(z0, z1, u)];
    case "up": return [L(x0, x1, u), y1, L(z1, z0, v)];
    case "down": return [L(x0, x1, u), y0, L(z0, z1, v)];
  }
}

function pack(rects) {
  const sorted = [...rects].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, rowH = 0;
  for (const r of sorted) {
    if (x + r.w > TEX) { x = 0; y += rowH + 1; rowH = 0; }
    r.x = x; r.y = y;
    x += r.w + 1;
    rowH = Math.max(rowH, r.h);
  }
  if (y + rowH > TEX) throw new Error(`Doku alanı yetersiz (${y + rowH} > ${TEX})`);
}

export function layoutGarment(parts) {
  const faces = [];
  parts.forEach((p, pi) => {
    for (const f of FACES) {
      if (p.skip?.includes(f)) continue;
      const [w, h] = dims(p, f);
      faces.push({ part: pi, face: f, w: Math.max(1, Math.round(w * DENSITY)), h: Math.max(1, Math.round(h * DENSITY)) });
    }
  });
  pack(faces);
  return { parts, faces };
}

// Dikdörtgen kesitin çevresinde, ön ortadan giyenin soluna (+x) doğru yay uzunluğu.
function perimeterU(g, x, z) {
  const dx = x - g.cx, dz = z - g.cz;
  const P = 4 * g.hw + 4 * g.hd;
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return { U: 0, P };
  const t = Math.min(Math.abs(dx) > 1e-9 ? g.hw / Math.abs(dx) : Infinity, Math.abs(dz) > 1e-9 ? g.hd / Math.abs(dz) : Infinity);
  const qx = dx * t, qz = dz * t;
  let U;
  if (Math.abs(qz + g.hd) < 1e-6 && qx >= 0) U = qx; // ön, sol yarı
  else if (Math.abs(qx - g.hw) < 1e-6) U = g.hw + (qz + g.hd); // sol yan
  else if (Math.abs(qz - g.hd) < 1e-6) U = g.hw + 2 * g.hd + (g.hw - qx); // arka
  else if (Math.abs(qx + g.hw) < 1e-6) U = 3 * g.hw + 2 * g.hd + (g.hd - qz); // sağ yan
  else U = 3 * g.hw + 4 * g.hd + (qx + g.hw); // ön, sağ yarı
  U = ((U % P) + P) % P;
  if (U > P / 2) U -= P;
  return { U, P };
}

// Her doksel için şablon/gölge bağlamı. def: { topY, bottomY, slim, zones(ctx) }
export function* texels(layout, def) {
  const G = groups(def.slim);
  const H = def.topY - def.bottomY;
  for (const f of layout.faces) {
    const p = layout.parts[f.part];
    const [fw, fh] = dims(p, f.face);
    const g = G[p.group ?? p.bone] ?? G.body;
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const u = (i + 0.5) / f.w;
      const v = (j + 0.5) / f.h;
      const pt = facePoint(p, f.face, u, v);
      const { U, P } = perimeterU(g, pt[0], pt[2]);
      const ctx = {
        tx: f.x + i, ty: f.y + j, part: f.part, partDef: p, role: p.role, bone: p.bone, face: f.face,
        fu: u, fv: v, fw, fh, i, j, w: f.w, h: f.h,
        p: pt, x: pt[0], y: pt[1], z: pt[2], n: NORMAL[f.face],
        U, P, group: g,
        V: def.topY - pt[1], H, vn: (def.topY - pt[1]) / H,
        side: pt[0] < 0 ? -1 : 1, front: pt[2] < g.cz,
        edge: Math.min(u * fw, (1 - u) * fw, v * fh, (1 - v) * fh),
        hole: false, mirrored: !!p.mirrored,
      };
      if (def.zones) def.zones(ctx);
      yield ctx;
    }
  }
}

function faceUV(f) {
  if (f.face === "up") return { uv: [f.x + f.w, f.y + f.h], uv_size: [-f.w, -f.h] };
  if (f.face === "down") return { uv: [f.x + f.w, f.y], uv_size: [-f.w, f.h] };
  return { uv: [f.x, f.y], uv_size: [f.w, f.h] };
}

const r4 = (n) => Math.round(n * 10000) / 10000;

// Oyuncu kemik hiyerarşisi (geometry.humanoid.custom ile aynı adlar ve pivotlar).
export function skeleton(armPivotY = 22) {
  return [
    { name: "root", pivot: [0, 0, 0] },
    { name: "waist", parent: "root", pivot: [0, 12, 0] },
    { name: "body", parent: "waist", pivot: [0, 24, 0] },
    { name: "head", parent: "body", pivot: [0, 24, 0] },
    { name: "rightArm", parent: "body", pivot: [-5, armPivotY, 0] },
    { name: "leftArm", parent: "body", pivot: [5, armPivotY, 0] },
    { name: "rightLeg", parent: "root", pivot: [-1.9, 12, 0] },
    { name: "leftLeg", parent: "root", pivot: [1.9, 12, 0] },
  ];
}

const CAT_KEY = { hat: "h", top: "t", pants: "p", shoes: "s" };

// Parçanın gizlendiği zırh kategorileri: pro → kendi kategorisinin zırhı, hideArmor → ek kategoriler.
export function hideKeys(cat, part) {
  const keys = new Set(part.hideArmor ?? []);
  if (part.pro) keys.add(CAT_KEY[cat]);
  return [...keys].sort();
}

// Parça kemiği adı: aynı gizleme kuralını paylaşan parçalar aynı kemikte toplanır.
export function partBoneName(cat, part) {
  const keys = hideKeys(cat, part);
  const tag = keys.length || part.under ? `g${keys.join("")}${part.under ? "u" : ""}` : "main";
  return `gm_${cat}_${tag}_${part.bone}`;
}

export function motifBoneName(cat, m, s) {
  return `gm_${cat}_m${m}_s${s}`;
}

export function drawBoneName(cat, n) {
  return `gm_${cat}_d${n}`;
}

// Motif dörtgeni: pivot dörtgen merkezinde (ölçek ve dönme merkez etrafında), sıfır kalınlık.
function motifCube(surf, size, depthOffset) {
  const ca = (surf.a[0] + surf.a[1]) / 2;
  const cb = (surf.b[0] + surf.b[1]) / 2;
  const h = size / 2;
  const out = surf.face === "north" || surf.face === "east" ? -1 : 1;
  const plane = surf.plane + out * depthOffset;
  const uv = { [surf.face]: { uv: [0, 0], uv_size: [16, 16] } };
  if (surf.face === "north" || surf.face === "south")
    return { pivot: [r4(ca), r4(cb), r4(plane)], cube: { origin: [r4(ca - h), r4(cb - h), r4(plane)], size: [size, size, 0], uv } };
  return { pivot: [r4(plane), r4(cb), r4(ca)], cube: { origin: [r4(plane), r4(cb - h), r4(ca - h)], size: [0, size, size], uv } };
}

export function buildGeometry(id, layout, opts) {
  const { cat, surfaces, motifSize, maxMotifs, armPivotY = 22, drawCells = [] } = opts;
  const base = skeleton(armPivotY);
  const bones = base.map((b) => ({ ...b }));
  const byBone = new Map();
  layout.parts.forEach((p, pi) => {
    const name = partBoneName(cat, p);
    if (!byBone.has(name)) byBone.set(name, { name, parent: p.bone, pivot: base.find((b) => b.name === p.bone).pivot, cubes: [] });
    const uv = {};
    for (const f of layout.faces.filter((f) => f.part === pi)) uv[f.face] = faceUV(f);
    const size = [0, 1, 2].map((k) => r4(p.to[k] - p.from[k]));
    byBone.get(name).cubes.push({ origin: p.from.map(r4), size, uv });
  });
  bones.push(...byBone.values());
  const geo = {
    format_version: "1.16.0",
    "minecraft:geometry": [{
      description: { identifier: id, texture_width: TEX, texture_height: TEX, visible_bounds_width: 3, visible_bounds_height: 3.5, visible_bounds_offset: [0, 1.25, 0] },
      bones,
    }],
  };

  const mbones = base.map((b) => ({ ...b }));
  for (let m = 0; m < maxMotifs; m++) {
    surfaces.forEach((s, si) => {
      const { pivot, cube } = motifCube(s, motifSize, MOTIF_BASE + MOTIF_STEP * m);
      mbones.push({ name: motifBoneName(cat, m, si), parent: s.bone, pivot, cubes: [cube] });
    });
  }
  const motifGeo = {
    format_version: "1.16.0",
    "minecraft:geometry": [{ description: { identifier: `${id}.motif`, texture_width: 16, texture_height: 16, visible_bounds_width: 3, visible_bounds_height: 3.5, visible_bounds_offset: [0, 1.25, 0] }, bones: mbones }],
  };

  let drawGeo = null;
  if (drawCells.length) {
    const dbones = base.map((b) => ({ ...b }));
    drawCells.forEach((c, n) => {
      const uv = { [c.face]: { uv: [0, 0], uv_size: [1, 1] } };
      const cube = c.face === "north" || c.face === "south"
        ? { origin: [r4(c.x0), r4(c.y0), r4(c.plane)], size: [r4(c.x1 - c.x0), r4(c.y1 - c.y0), 0], uv }
        : { origin: [r4(c.plane), r4(c.y0), r4(c.x0)], size: [0, r4(c.y1 - c.y0), r4(c.x1 - c.x0)], uv };
      dbones.push({ name: drawBoneName(cat, n), parent: c.bone, pivot: base.find((b) => b.name === c.bone).pivot, cubes: [cube] });
    });
    drawGeo = {
      format_version: "1.16.0",
      "minecraft:geometry": [{ description: { identifier: `${id}.draw`, texture_width: 1, texture_height: 1, visible_bounds_width: 3, visible_bounds_height: 3.5, visible_bounds_offset: [0, 1.25, 0] }, bones: dbones }],
    };
  }
  return { geo, motifGeo, drawGeo };
}
