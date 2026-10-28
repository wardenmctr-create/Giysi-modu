// Giysi parçalarını 128×128 dokuya yerleştirir, her dokselin 3B konumunu hesaplar
// ve Bedrock geometrisini üretir.

export const TEX = 128;
const SCALE = 2; // birim başına doksel (64'lük skin çözünürlüğünün iki katı)

const FACES = ["north", "south", "east", "west", "up", "down"];

function faceDims(size, face) {
  const [sx, sy, sz] = size;
  if (face === "north" || face === "south") return [sx, sy];
  if (face === "east" || face === "west") return [sz, sy];
  return [sx, sz];
}

// Kutu-UV yönelimiyle yüz dokselinin (u,v ∈ 0..1) 3B noktası.
function facePoint(o, s, face, u, v) {
  const [x0, y0, z0] = o;
  const [x1, y1, z1] = [o[0] + s[0], o[1] + s[1], o[2] + s[2]];
  const lerp = (a, b, t) => a + (b - a) * t;
  switch (face) {
    case "north": return [lerp(x0, x1, u), lerp(y1, y0, v), z0];
    case "south": return [lerp(x1, x0, u), lerp(y1, y0, v), z1];
    case "east": return [x0, lerp(y1, y0, v), lerp(z1, z0, u)];
    case "west": return [x1, lerp(y1, y0, v), lerp(z0, z1, u)];
    case "up": return [lerp(x0, x1, u), y1, lerp(z1, z0, v)];
    case "down": return [lerp(x0, x1, u), y0, lerp(z0, z1, v)];
  }
}

// Raf yöntemiyle yüz dikdörtgenlerini yerleştirir.
function pack(rects) {
  const sorted = [...rects].sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  for (const r of sorted) {
    if (x + r.w > TEX) { x = 0; y += rowH + 1; rowH = 0; }
    r.x = x; r.y = y;
    x += r.w + 1;
    rowH = Math.max(rowH, r.h);
  }
  if (y + rowH > TEX) throw new Error("Doku alanı yetersiz");
}

export function layoutGarment(parts) {
  const faces = [];
  parts.forEach((p, pi) => {
    for (const f of FACES) {
      const [w, h] = faceDims(p.size, f);
      faces.push({ part: pi, face: f, w: Math.round(w * SCALE), h: Math.round(h * SCALE) });
    }
  });
  pack(faces);
  const bbox = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
  for (const p of parts) for (let k = 0; k < 3; k++) {
    bbox[0][k] = Math.min(bbox[0][k], p.origin[k]);
    bbox[1][k] = Math.max(bbox[1][k], p.origin[k] + p.size[k]);
  }
  return { parts, faces, bbox };
}

// Her doksel için şablon bağlamı.
export function* texels(layout) {
  const { parts, faces, bbox } = layout;
  const ext = [0, 1, 2].map((k) => bbox[1][k] - bbox[0][k] || 1);
  const cx = (bbox[0][0] + bbox[1][0]) / 2;
  const cz = (bbox[0][2] + bbox[1][2]) / 2;
  for (const f of faces) {
    const p = parts[f.part];
    const [fw, fh] = faceDims(p.size, f.face);
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const u = (i + 0.5) / f.w;
      const v = (j + 0.5) / f.h;
      const pt = facePoint(p.origin, p.size, f.face, u, v);
      const hcoord = f.face === "east" || f.face === "west" ? pt[2] : pt[0];
      let ang = Math.atan2(pt[2] - cz, pt[0] - cx) / (2 * Math.PI);
      ang = (ang + 1.125) % 1;
      yield {
        tx: f.x + i, ty: f.y + j, part: f.part, pro: !!p.pro,
        face: f.face, p: pt, fu: u, fv: v,
        xn: (pt[0] - bbox[0][0]) / ext[0],
        yn: (bbox[1][1] - pt[1]) / ext[1],
        zn: (pt[2] - bbox[0][2]) / ext[2],
        h: hcoord, y: bbox[1][1] - pt[1], around: ang,
        edge: Math.min(u * fw, (1 - u) * fw, v * fh, (1 - v) * fh),
        faceEdge: i === 0 || j === 0 || i === f.w - 1 || j === f.h - 1, bottom: j === f.h - 1,
      };
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
function skeleton(armPivotY) {
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

export function motifBoneName(cat, m, s) {
  return `gm_${cat}_m${m}_s${s}`;
}

// Motif dörtgeni: yüzey merkezine sıfır kalınlıkta küp; animasyon konumu kaydırır.
function motifCube(surf, size, depthOffset) {
  const ca = (surf.a[0] + surf.a[1]) / 2;
  const cb = (surf.b[0] + surf.b[1]) / 2;
  const h = size / 2;
  const out = surf.face === "north" || surf.face === "east" ? -1 : 1;
  const plane = surf.plane + out * depthOffset;
  const uv = { [surf.face]: { uv: [0, 0], uv_size: [12, 12] } };
  if (surf.face === "north" || surf.face === "south")
    return { origin: [r4(ca - h), r4(cb - h), r4(plane)], size: [size, size, 0], uv };
  return { origin: [r4(plane), r4(cb - h), r4(ca - h)], size: [0, size, size], uv };
}

export function buildGeometry(id, layout, opts) {
  const { cat, surfaces, motifSize, maxMotifs, armPivotY = 22 } = opts;
  const bones = skeleton(armPivotY).map((b) => ({ ...b }));
  const byBone = {};
  layout.parts.forEach((p, pi) => {
    const key = `${p.bone}${p.pro ? "_pro" : ""}`;
    if (!byBone[key]) byBone[key] = { name: `gm_${cat}_${p.pro ? "pro" : "main"}_${p.bone}`, parent: p.bone, pivot: bones.find((b) => b.name === p.bone).pivot, cubes: [] };
    const uv = {};
    for (const f of layout.faces.filter((f) => f.part === pi)) uv[f.face] = faceUV(f);
    byBone[key].cubes.push({ origin: p.origin, size: p.size, inflate: p.inflate, uv });
  });
  bones.push(...Object.values(byBone));
  const motifGeo = {
    format_version: "1.16.0",
    "minecraft:geometry": [{
      description: { identifier: `${id}.motif`, texture_width: 12, texture_height: 12 },
      bones: skeleton(armPivotY).map((b) => ({ ...b })),
    }],
  };
  for (let m = 0; m < maxMotifs; m++) {
    surfaces.forEach((s, si) => {
      const parent = bones.find((b) => b.name === s.bone);
      motifGeo["minecraft:geometry"][0].bones.push({
        name: motifBoneName(cat, m, si), parent: s.bone, pivot: parent.pivot,
        cubes: [motifCube(s, motifSize, 0.004 * m)],
      });
    });
  }
  const geo = {
    format_version: "1.16.0",
    "minecraft:geometry": [{
      description: { identifier: id, texture_width: TEX, texture_height: TEX, visible_bounds_width: 3, visible_bounds_height: 3.5, visible_bounds_offset: [0, 1.25, 0] },
      bones,
    }],
  };
  return { geo, motifGeo };
}
