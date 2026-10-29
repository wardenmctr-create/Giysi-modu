// Çakışma (z-fighting) dedektörü: aynı yöne bakan, birbirine çok yakın ve üst üste binen yüzleri bulur.
// Giysi yüzleri; skin, skin dış katmanı, zırh, diğer giysiler ve motif katmanlarıyla karşılaştırılır.
// Oyuncu modeli dinlenme pozunda kabul edilir (kemik pivotları hareketsiz).

export const MIN_GAP = 0.1; // birim; bundan yakın paralel yüzler titreyebilir

const AXES = { north: [2, -1], south: [2, 1], east: [0, -1], west: [0, 1], down: [1, -1], up: [1, 1] };

// Kutu → yüz dörtgenleri. rect: diğer iki eksendeki aralıklar.
export function boxQuads(from, to, owner, skip = []) {
  const out = [];
  for (const [face, [axis, sign]] of Object.entries(AXES)) {
    if (skip.includes(face)) continue;
    const others = [0, 1, 2].filter((k) => k !== axis);
    out.push({
      axis, sign, plane: sign > 0 ? to[axis] : from[axis],
      rect: [from[others[0]], to[others[0]], from[others[1]], to[others[1]]],
      owner: { ...owner, face },
    });
  }
  return out;
}

const inflate = (from, to, d) => [from.map((v) => v - d), to.map((v) => v + d)];

// Vanilla oyuncu: skin, dış katman ve zırh kutuları.
export function vanillaQuads(slim) {
  const q = [];
  const arm = slim ? { r: [[-7, 11.5, -2], [-4, 23.5, 2]], l: [[4, 11.5, -2], [7, 23.5, 2]] } : { r: [[-8, 12, -2], [-4, 24, 2]], l: [[4, 12, -2], [8, 24, 2]] };
  const parts = {
    head: [[-4, 24, -4], [4, 32, 4]], body: [[-4, 12, -2], [4, 24, 2]],
    rightArm: arm.r, leftArm: arm.l, rightLeg: [[-3.9, 0, -2], [0.1, 12, 2]], leftLeg: [[-0.1, 0, -2], [3.9, 12, 2]],
  };
  // yRange: zırh dokusunun gerçekten kapladığı yükseklik (çizme yalnızca alt bacak, dizlik belde yalnızca kemer).
  const add = (bone, d, kind, armor, yRange) => {
    let [f, t] = inflate(...parts[bone], d);
    if (yRange) { f = [f[0], Math.max(f[1], yRange[0]), f[2]]; t = [t[0], Math.min(t[1], yRange[1]), t[2]]; }
    q.push(...boxQuads(f, t, { kind, bone, armor }));
  };
  for (const b of Object.keys(parts)) add(b, 0, "skin");
  add("head", 0.5, "overlay");
  add("body", 0.25, "overlay");
  for (const b of ["rightArm", "leftArm"]) add(b, 0.25, "overlay");
  for (const b of ["rightLeg", "leftLeg"]) add(b, 0.25, "overlay");
  add("head", 1.0, "armor", "hat");
  add("body", 1.0, "armor", "top");
  for (const b of ["rightArm", "leftArm"]) add(b, 1.0, "armor", "top");
  add("body", 0.5, "armor", "pants", [11.5, 15.5]);
  for (const b of ["rightLeg", "leftLeg"]) add(b, 0.5, "armor", "pants");
  for (const b of ["rightLeg", "leftLeg"]) add(b, 1.0, "armor", "shoes", [-1, 5.5]);
  return q;
}

const KEY_CAT = { h: "hat", t: "top", p: "pants", s: "shoes" };
const CAT_KEY = { hat: "h", top: "t", pants: "p", shoes: "s" };

// layout verilirse yalnızca gerçekten çizilen yüzler (tamamen gizli olduğu için atlananlar hariç) denetlenir.
export function garmentQuads(cat, def, layout) {
  const q = [];
  def.parts.forEach((p, pi) => {
    const hide = new Set((p.hideArmor ?? []).map((k) => KEY_CAT[k]));
    if (p.pro) hide.add(cat);
    let skip = p.skip ?? [];
    if (layout) {
      const present = new Set(layout.faces.filter((f) => f.part === pi).map((f) => f.face));
      skip = ["north", "south", "east", "west", "up", "down"].filter((f) => !present.has(f));
    }
    q.push(...boxQuads(p.from, p.to, { kind: "garment", cat, part: pi, role: p.role, pro: hide.size > 0, hide, under: !!p.under, bone: p.bone }, skip));
  });
  return q;
}

// Motif katmanı: yüzey dikdörtgeni, en alttaki ve en üstteki yuva düzlemlerinde.
export function motifQuads(cat, def, base, step, slots) {
  const q = [];
  def.surfaces.forEach((s, si) => {
    const [axis, sign] = AXES[s.face];
    const rect = axis === 2 ? [s.a[0], s.a[1], s.b[0], s.b[1]] : [s.b[0], s.b[1], s.a[0], s.a[1]];
    // a ekseni: north/south için x, east/west için z; boxQuads sırası: (diğer eksenler artan) → x,y veya y,z
    const r = axis === 2 ? [s.a[0], s.a[1], s.b[0], s.b[1]] : [s.b[0], s.b[1], s.a[0], s.a[1]];
    const hide = new Set([cat, ...[...(s.keys ?? "")].map((k) => KEY_CAT[k])]);
    for (const k of [0, slots - 1]) {
      q.push({ axis, sign, plane: s.plane + sign * (base + k * step), rect: r, owner: { kind: "motif", cat, surface: si, name: s.name, slot: k, pro: true, hide, bone: s.bone } });
    }
    void rect;
  });
  return q;
}

function overlap(a, b) {
  const w = Math.min(a.rect[1], b.rect[1]) - Math.max(a.rect[0], b.rect[0]);
  const h = Math.min(a.rect[3], b.rect[3]) - Math.max(a.rect[2], b.rect[2]);
  return w > 1e-4 && h > 1e-4 ? w * h : 0;
}

const label = (o) => {
  if (o.kind === "garment") return `${o.cat}#${o.part}(${o.role}${o.pro ? ",zırhta gizli" : ""}${o.under ? ",üst varken gizli" : ""}).${o.face}`;
  if (o.kind === "motif") return `${o.cat} motif "${o.name}" yuva ${o.slot + 1}`;
  if (o.kind === "draw") return `${o.cat} ${o.name}`;
  return `${o.kind}${o.armor ? ":" + o.armor : ""}:${o.bone}.${o.face}`;
};

// Bir yüzün belirli bir bölgesi başka bir giysi kutusunun içinde kalıyorsa görünmez.
function hiddenInside(quad, area, boxes) {
  const { axis } = quad;
  const others = [0, 1, 2].filter((k) => k !== axis);
  for (const b of boxes) {
    if (b.owner === quad.owner) continue;
    const lo = b.from, hi = b.to;
    if (quad.plane <= lo[axis] + 1e-4 || quad.plane >= hi[axis] - 1e-4) continue;
    if (area[0] >= lo[others[0]] - 1e-4 && area[1] <= hi[others[0]] + 1e-4 && area[2] >= lo[others[1]] - 1e-4 && area[3] <= hi[others[1]] + 1e-4) return true;
  }
  return false;
}

// Oyun içi çizim hücreleri: motifler gibi kendi kategorisinin (ve keys'teki) zırhıyla gizlenen ince dörtgenler.
export function drawQuads(cat, cells) {
  return (cells ?? []).map((c) => {
    const [axis, sign] = AXES[c.face];
    const r = axis === 2 ? [c.x0, c.x1, c.y0, c.y1] : [c.y0, c.y1, c.x0, c.x1];
    const hide = new Set([cat, ...[...(c.keys ?? "")].map((k) => KEY_CAT[k])]);
    return { axis, sign, plane: c.plane, rect: r, owner: { kind: "draw", cat, name: `çizim ${c.faceIndex}:${c.row},${c.col}`, slot: 0, pro: true, hide, bone: c.bone } };
  });
}

// İnce bir katman (motif/çizim) hangi zırhlarla gizlenmeli? Zırh yüzüne MIN_GAP'ten yakın ya da zırhın
// dışında kalıyorsa o zırh takılınca gizlenir. quad: { axis, sign, plane(ler), rect, bone }
export function overlayHideKeys(q, slim) {
  const keys = new Set();
  for (const v of vanillaQuads(slim)) {
    if (v.owner.kind !== "armor" || v.axis !== q.axis || v.sign !== q.sign || v.owner.bone !== q.bone) continue;
    if (!overlap(q, v)) continue;
    const outer = Math.max(...q.planes.map((p) => p * q.sign));
    if (v.plane * q.sign - outer < MIN_GAP) keys.add(CAT_KEY[v.owner.armor]);
  }
  return [...keys].sort().join("");
}
export function surfaceQuad(s, motifBase, motifStep, slots) {
  const [axis, sign] = AXES[s.face];
  const rect = axis === 2 ? [s.a[0], s.a[1], s.b[0], s.b[1]] : [s.b[0], s.b[1], s.a[0], s.a[1]];
  return { axis, sign, rect, bone: s.bone, planes: [s.plane + sign * motifBase, s.plane + sign * (motifBase + (slots - 1) * motifStep)] };
}
export function cellQuad(c) {
  const [axis, sign] = AXES[c.face];
  const rect = axis === 2 ? [c.x0, c.x1, c.y0, c.y1] : [c.y0, c.y1, c.x0, c.x1];
  return { axis, sign, rect, bone: c.bone, planes: [c.plane] };
}

// garments: [{ cat, def, drawCells }] — aynı anda giyilenler.
export function detect(garments, slim, motifBase = 0.12, motifStep = 0.02) {
  const issues = [];
  const vanilla = vanillaQuads(slim);
  const gq = garments.flatMap(({ cat, def, layout }) => garmentQuads(cat, def, layout));
  const mq = [
    ...garments.flatMap(({ cat, def }) => motifQuads(cat, def, motifBase, motifStep, 16)),
    ...garments.flatMap(({ cat, drawCells }) => drawQuads(cat, drawCells)),
  ];
  const boxes = garments.flatMap(({ cat, def }) => def.parts.map((p, pi) => ({ from: p.from, to: p.to, owner: { cat, part: pi } })));
  const topWorn = garments.some((g) => g.cat === "top");
  const visibleWith = (o, other) => {
    // Kurallar: zırhta gizlenen parça/motif o zırhla çakışmaz; "üst varken gizli" parça üst giysiyle çakışmaz.
    if (other.kind === "armor" && o.hide?.has(other.armor)) return false;
    if (o.under && topWorn) return false;
    return true;
  };
  const pairs = [];
  for (const a of [...gq, ...mq]) {
    if (a.owner.under && topWorn) continue;
    for (const b of [...vanilla, ...gq]) {
      if (a === b || a.axis !== b.axis || a.sign !== b.sign) continue;
      if (b.owner.kind === "garment" && a.owner.kind === "garment" && b.owner.cat === a.owner.cat && b.owner.part === a.owner.part) continue;
      if (b.owner.under && topWorn) continue;
      const gap = Math.abs(a.plane - b.plane);
      if (gap >= MIN_GAP - 1e-6) continue;
      if (!visibleWith(a.owner, b.owner)) continue;
      if (b.owner.kind === "garment" && !visibleWith(b.owner, a.owner)) continue;
      const area = overlap(a, b);
      if (!area) continue;
      // Çakışan bölge başka bir giysi kutusunun içindeyse görünmez.
      const reg = [Math.max(a.rect[0], b.rect[0]), Math.min(a.rect[1], b.rect[1]), Math.max(a.rect[2], b.rect[2]), Math.min(a.rect[3], b.rect[3])];
      if (hiddenInside(a, reg, boxes) || hiddenInside(b, reg, boxes)) continue;
      // Skin yüzü giysinin içinde kalıyorsa (giysi dışarıda) sorun değil: yalnızca aynı düzleme yakınlık önemlidir.
      const key = [label(a.owner), label(b.owner)].sort().join(" ↔ ");
      if (pairs.includes(key)) continue;
      pairs.push(key);
      issues.push({ a: label(a.owner), b: label(b.owner), gap: +gap.toFixed(3), area: +area.toFixed(3) });
    }
  }
  return issues;
}
