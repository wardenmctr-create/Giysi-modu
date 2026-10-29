// Kategori atlası: bir kategorideki 25 şeklin hepsi aynı 128×128 doku haritasını kullanır.
// Böylece 25 renk şablonunun bölge maskeleri şekiller arasında paylaşılır (100 şekil × 83 maske yerine
// 4 kategori × 58 maske). Şekle özel olan tek doku gölge + ayrıntı katmanıdır.
//
// Harita türleri (her kemik grubu için):
//   wrap — gövdeyi saran dikey yüzler: x = çevre koordinatı U (sağ yan → ön → sol yan → arka), y = yükseklik V
//   up / down — yukarı/aşağı bakan yüzler: x, z düzlemi
// Haritalarda kalan boşluk "serbest alan"dır: desen almayan aksesuar yüzleri (kanat, kristal, ponpon...) buraya
// şekil başına ayrı ayrı yerleşir. Görünür iki yüz aynı harita dokselini paylaşırsa küçük olan serbest alana taşınır.
import { facePoint, NORMAL, FACES, dims, hideKeys, perimRaw, perimPoint, DENSITY as D } from "./garment.mjs";

export const SIZE = 128;

// Kategori haritaları. yRef: V = yRef − y. vTop/H: şablonların normalleştirilmiş yüksekliği (vn).
// capV: yatay yüzlerin şablon yüksekliği (ör. şapkada tepe ve siperlik farklı).
// groups: çevre koordinatının kanonik kesitleri — giysinin tipik ölçüsüne yakın seçilir ki harita sıkışmasın
// (çevre P her zaman 0,5'in katı: harita genişliği tam doksel).
const G = (cx, cz, hw, hd) => ({ cx, cz, hw, hd });
const GROUPS = {
  hat: () => ({ head: G(0, 0, 4.625, 4.625) }),
  top: (slim) => ({ body: G(0, 0, 4.375, 2.375), rightArm: slim ? G(-5.875, 0, 1.625, 2.375) : G(-6.375, 0, 2.125, 2.375), leftArm: slim ? G(5.875, 0, 1.625, 2.375) : G(6.375, 0, 2.125, 2.375) }),
  pants: () => ({ rightLeg: G(-2.125, 0, 2.125, 2.375), leftLeg: G(2.125, 0, 2.125, 2.375), body: G(0, 0, 4.5, 2.5) }),
  shoes: () => ({ rightLeg: G(-2.4, -0.35, 2.375, 3.125), leftLeg: G(2.4, -0.35, 2.375, 3.125) }),
};
export const catGroups = (cat, slim = false) => GROUPS[cat](slim);

export const SPEC = {
  hat: {
    yRef: 32, vTop: -1.6, H: 5.55,
    wrap: { head: [-17, 10] },
    caps: { head: { up: [-9.5, 9.5, -9.5, 9.5], down: [-9.5, 9.5, -9.5, 9.5] } },
    capV: (g, dir, x, z) => (dir === "down" ? 4.2 : Math.abs(x) <= 4.75 && Math.abs(z) <= 4.75 ? -1.2 : 3.8),
  },
  top: {
    yRef: 24.5, vTop: 0.125, H: 12.9,
    wrap: { body: [-1.5, 25], rightArm: [-1, 13], leftArm: [-1, 13] },
    caps: {
      body: { up: [-8, 8, -5, 5], down: [-8, 8, -6, 6] },
      rightArm: { up: [-10, -3.5, -3.5, 3.5], down: [-10, -3.5, -3.5, 3.5] },
      leftArm: { up: [3.5, 10, -3.5, 3.5], down: [3.5, 10, -3.5, 3.5] },
    },
    capV: (g, dir, x, z) => {
      if (g === "body") return dir === "up" ? 0 : Math.abs(x) <= 4.7 && Math.abs(z) <= 2.7 ? 13 : 21;
      return dir === "up" ? 0 : 12;
    },
  },
  pants: {
    yRef: 13.5, vTop: 0.1, H: 13.4,
    wrap: { rightLeg: [-0.5, 14], leftLeg: [-0.5, 14], body: [-11.5, 2.5] },
    caps: {
      rightLeg: { up: [-6, 1, -4, 4], down: [-6, 1, -4, 4] },
      leftLeg: { up: [-1, 6, -4, 4], down: [-1, 6, -4, 4] },
      body: { up: [-6, 6, -4, 4], down: [-6, 6, -4, 4] },
    },
    capV: (g, dir) => (g === "body" ? (dir === "up" ? 0 : 2) : dir === "up" ? 0.5 : 13.5),
  },
  shoes: {
    yRef: 12, vTop: 8.05, H: 4.1,
    wrap: { rightLeg: [-0.5, 12.5], leftLeg: [-0.5, 12.5] },
    caps: {
      rightLeg: { up: [-6, 1.5, -8.5, 4.5], down: [-6, 1.5, -8.5, 4.5] },
      leftLeg: { up: [-1.5, 6, -8.5, 4.5], down: [-1.5, 6, -8.5, 4.5] },
    },
    capV: (g, dir, x, z) => {
      if (dir === "down") return 12;
      const cx = g === "rightLeg" ? -1.9 : 1.9;
      return Math.abs(x - cx) <= 2.3 && Math.abs(z) <= 2.3 ? 8.2 : 10.6;
    },
  },
};

// Raf yerleşimi + kalan boşlukların listesi.
function shelfPack(rects, W, H) {
  const sorted = [...rects].sort((a, b) => b.h - a.h || b.w - a.w);
  const shelves = [];
  let x = 0, y = 0, rowH = 0, cur = [];
  const close = () => { if (cur.length) shelves.push({ y, h: rowH, items: cur, end: x }); };
  for (const r of sorted) {
    if (x + r.w > W) { close(); y += rowH + 1; x = 0; rowH = 0; cur = []; }
    r.x = x; r.y = y;
    x += r.w + 1;
    rowH = Math.max(rowH, r.h);
    cur.push(r);
  }
  close();
  const bottom = y + rowH + 1;
  if (bottom - 1 > H) throw new Error(`Atlas alanı yetersiz (${bottom - 1} > ${H})`);
  const free = [];
  for (const s of shelves) {
    for (const r of s.items) if (s.h - r.h > 1) free.push({ x: r.x, y: r.y + r.h + 1, w: r.w, h: s.h - r.h - 1 });
    if (W - s.end > 0) free.push({ x: s.end, y: s.y, w: W - s.end, h: s.h });
  }
  if (H - bottom > 0) free.push({ x: 0, y: bottom, w: W, h: H - bottom });
  return free;
}

const atlasCache = new Map();
export function buildAtlas(cat) {
  if (atlasCache.has(cat)) return atlasCache.get(cat);
  const s = SPEC[cat];
  const CG = catGroups(cat, false);
  const charts = [];
  for (const [grp, [v0, v1]] of Object.entries(s.wrap)) {
    const g = CG[grp];
    const P = 4 * g.hw + 4 * g.hd;
    charts.push({ kind: "wrap", group: grp, u0: -g.hw - 2 * g.hd, u1: 3 * g.hw + 2 * g.hd, P, v0, v1, w: Math.round(P * D), h: Math.round((v1 - v0) * D) });
  }
  for (const [grp, c] of Object.entries(s.caps)) {
    for (const dir of ["up", "down"]) {
      if (!c[dir]) continue;
      const [x0, x1, z0, z1] = c[dir];
      charts.push({ kind: dir, group: grp, x0, x1, z0, z1, w: Math.round((x1 - x0) * D), h: Math.round((z1 - z0) * D) });
    }
  }
  const free = shelfPack(charts, SIZE, SIZE);
  const atlas = { cat, W: SIZE, H: SIZE, charts, free, spec: s, yRef: s.yRef };
  atlasCache.set(cat, atlas);
  return atlas;
}

// Haritadaki her dokselin kanonik bağlamı (şablon maskeleri bununla hesaplanır).
export function* chartTexels(atlas) {
  const s = atlas.spec;
  const CG = catGroups(atlas.cat, false);
  for (const ch of atlas.charts) {
    const g = CG[ch.group];
    const P = 4 * g.hw + 4 * g.hd;
    for (let j = 0; j < ch.h; j++) for (let i = 0; i < ch.w; i++) {
      let x, y, z, face, Uraw, V;
      if (ch.kind === "wrap") {
        const Uc = ch.u0 + (i + 0.5) / D;
        Uraw = Uc < 0 ? Uc + P : Uc;
        const q = perimPoint(g, Uraw);
        x = g.cx + q.qx; z = g.cz + q.qz; face = q.face;
        V = ch.v0 + (j + 0.5) / D;
        y = s.yRef - V;
      } else {
        x = ch.x0 + (i + 0.5) / D;
        z = ch.kind === "up" ? ch.z1 - (j + 0.5) / D : ch.z0 + (j + 0.5) / D;
        face = ch.kind;
        Uraw = perimRaw(g, x, z);
        V = s.capV(ch.group, ch.kind, x, z);
        y = s.yRef - V;
      }
      const U = Uraw > P / 2 ? Uraw - P : Uraw;
      yield {
        tx: ch.x + i, ty: ch.y + j, x, y, z, p: [x, y, z], face, n: NORMAL[face], U, V, P, vn: (V - s.vTop) / s.H,
        bone: ch.group, group: g, front: z < g.cz, side: x < 0 ? -1 : 1, role: "body", chart: ch.kind,
      };
    }
  }
}

export function inFree(atlas, tx, ty) {
  return atlas.free.some((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
}

// ---------------------------------------------------------------- görünürlük
// Vanilla zırh kabukları (dinlenme pozu): bir parça yalnızca zırhla gizleniyorsa, altındaki yüz o zırh
// takılıyken zırhın içinde kalır ve yine görünmez.
function armorBoxes(slim) {
  const arm = slim ? { r: [[-7, 11.5, -2], [-4, 23.5, 2]], l: [[4, 11.5, -2], [7, 23.5, 2]] } : { r: [[-8, 12, -2], [-4, 24, 2]], l: [[4, 12, -2], [8, 24, 2]] };
  const inf = ([f, t], d, y) => ({ from: [f[0] - d, Math.max(f[1] - d, y?.[0] ?? -99), f[2] - d], to: [t[0] + d, Math.min(t[1] + d, y?.[1] ?? 99), t[2] + d] });
  const head = [[-4, 24, -4], [4, 32, 4]], body = [[-4, 12, -2], [4, 24, 2]];
  const rl = [[-3.9, 0, -2], [0.1, 12, 2]], ll = [[-0.1, 0, -2], [3.9, 12, 2]];
  return {
    h: [{ bone: "head", ...inf(head, 1) }],
    t: [{ bone: "body", ...inf(body, 1) }, { bone: "rightArm", ...inf(arm.r, 1) }, { bone: "leftArm", ...inf(arm.l, 1) }],
    p: [{ bone: "body", ...inf(body, 0.5, [11.5, 15.5]) }, { bone: "rightLeg", ...inf(rl, 0.5) }, { bone: "leftLeg", ...inf(ll, 0.5) }],
    s: [{ bone: "rightLeg", ...inf(rl, 1, [-1, 5.5]) }, { bone: "leftLeg", ...inf(ll, 1, [-1, 5.5]) }],
  };
}
const ARMOR = { std: armorBoxes(false), slim: armorBoxes(true) };

// Oyuncunun kendi gövdesi: içinde kalan giysi yüzü hiçbir zaman görünmez.
function skinBoxes(slim) {
  const arm = slim ? { r: [[-7, 11.5, -2], [-4, 23.5, 2]], l: [[4, 11.5, -2], [7, 23.5, 2]] } : { r: [[-8, 12, -2], [-4, 24, 2]], l: [[4, 12, -2], [8, 24, 2]] };
  const B = (bone, [from, to]) => ({ bone, from, to });
  return [
    B("head", [[-4, 24, -4], [4, 32, 4]]), B("body", [[-4, 12, -2], [4, 24, 2]]),
    B("rightArm", arm.r), B("leftArm", arm.l), B("rightLeg", [[-3.9, 0, -2], [0.1, 12, 2]]), B("leftLeg", [[-0.1, 0, -2], [3.9, 12, 2]]),
  ];
}
const SKIN = { std: skinBoxes(false), slim: skinBoxes(true) };
const strictlyInside = (pt, b) => pt.every((v, a) => v > b.from[a] + EPS && v < b.to[a] - EPS);

const EPS = 1e-3;
function insideBox(pt, q, n) {
  for (let a = 0; a < 3; a++) {
    const lo = q.from[a], hi = q.to[a];
    if (pt[a] < lo - EPS || pt[a] > hi + EPS) return false;
    // Kutunun yüzüyle aynı düzlemde ve aynı yöne bakan yüz gizli sayılmaz (bu bir çakışmadır; dedektör yakalar).
    if (Math.abs(pt[a] - lo) <= EPS && n[a] < 0) return false;
    if (Math.abs(pt[a] - hi) <= EPS && n[a] > 0) return false;
  }
  return true;
}
const within = (pt, b) => pt.every((v, a) => v >= b.from[a] - EPS && v <= b.to[a] + EPS);

// q, p görünürken her zaman görünür mü? (q'nun fazladan gizlendiği zırh, p'nin bu noktasını zaten örter mi?)
function covers(cat, q, p, pt, slim) {
  const kp = new Set(hideKeys(cat, p));
  const armor = ARMOR[slim ? "slim" : "std"];
  for (const k of hideKeys(cat, q)) {
    if (kp.has(k)) continue;
    if (!armor[k].some((b) => b.bone === p.bone && within(pt, b))) return false;
  }
  if (q.under && !p.under) return false;
  return true;
}

export function hiddenAt(cat, parts, pi, pt, n, slim) {
  const p = parts[pi];
  for (const b of SKIN[slim ? "slim" : "std"]) if (b.bone === p.bone && strictlyInside(pt, b)) return true;
  for (let qi = 0; qi < parts.length; qi++) {
    if (qi === pi) continue;
    const q = parts[qi];
    if (q.bone !== p.bone) continue;
    if (insideBox(pt, q, n) && covers(cat, q, p, pt, slim)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- yüz → harita
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function chartRect(atlas, p, face, slim) {
  const grp = p.group ?? p.bone;
  const kind = face === "up" || face === "down" ? face : "wrap";
  const ch = atlas.charts.find((c) => c.group === grp && c.kind === kind);
  if (!ch) return null;
  let a0, a1, b0, b1;
  if (kind === "wrap") {
    const gA = catGroups(atlas.cat, slim)[grp], gS = catGroups(atlas.cat, false)[grp];
    const PA = 4 * gA.hw + 4 * gA.hd, PS = ch.P;
    const Uof = (u) => {
      const pt = facePoint(p, face, u, 0.5);
      let U = (perimRaw(gA, pt[0], pt[2]) * PS) / PA;
      if (U > ch.u1) U -= PS;
      return U;
    };
    // Merkeze ya da yana bakan yüzler (yaka oyuğunun iç duvarı, etek yarılarının iç yüzü) çevre haritasında
    // anlamlı yer tutmaz → serbest alan.
    const n = NORMAL[face];
    const mid = facePoint(p, face, 0.5, 0.5);
    const rx = mid[0] - gA.cx, rz = mid[2] - gA.cz;
    const rl = Math.hypot(rx, rz);
    if (rl < 1e-6 || (n[0] * rx + n[2] * rz) / rl < 0.2) return null;
    let U0 = Uof(0), U1 = Uof(1);
    if (U0 > U1) { if (face === "south") U1 += PS; else U0 -= PS; }
    const [fw] = dims(p, face);
    const span = U1 - U0;
    if ((span < 0.15 * fw && fw > 0.6) || span > 3 * fw + 1) return null;
    a0 = (clamp(U0, ch.u0, ch.u1) - ch.u0) * D;
    a1 = (clamp(U1, ch.u0, ch.u1) - ch.u0) * D;
    b0 = (clamp(atlas.yRef - p.to[1], ch.v0, ch.v1) - ch.v0) * D;
    b1 = (clamp(atlas.yRef - p.from[1], ch.v0, ch.v1) - ch.v0) * D;
    void gS;
  } else {
    a0 = (clamp(p.from[0], ch.x0, ch.x1) - ch.x0) * D;
    a1 = (clamp(p.to[0], ch.x0, ch.x1) - ch.x0) * D;
    if (kind === "up") {
      b0 = (ch.z1 - clamp(p.to[2], ch.z0, ch.z1)) * D;
      b1 = (ch.z1 - clamp(p.from[2], ch.z0, ch.z1)) * D;
    } else {
      b0 = (clamp(p.from[2], ch.z0, ch.z1) - ch.z0) * D;
      b1 = (clamp(p.to[2], ch.z0, ch.z1) - ch.z0) * D;
    }
  }
  let x0 = Math.round(a0), x1 = Math.round(a1), y0 = Math.round(b0), y1 = Math.round(b1);
  if (x1 <= x0) { if (x0 >= ch.w) x0 = ch.w - 1; x1 = x0 + 1; }
  if (y1 <= y0) { if (y0 >= ch.h) y0 = ch.h - 1; y1 = y0 + 1; }
  return { chart: ch, x: ch.x + x0, y: ch.y + y0, w: x1 - x0, h: y1 - y0 };
}

function texelPoints(p, f) {
  const out = [];
  for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) out.push({ i, j, pt: facePoint(p, f.face, (i + 0.5) / f.w, (j + 0.5) / f.h) });
  return out;
}

// Serbest alana raf yerleşimi (gerekirse küçültülür).
function packFree(atlas, faces, parts) {
  if (!faces.length) return;
  for (const scale of [1, 0.75, 0.5, 0.35]) {
    const items = faces.map((f) => {
      const [w, h] = dims(parts[f.part], f.face);
      return { f, w: Math.max(1, Math.round(w * D * scale)), h: Math.max(1, Math.round(h * D * scale)) };
    }).sort((a, b) => b.h - a.h || b.w - a.w);
    const bins = atlas.free.map((r) => ({ ...r, cx: 0, cy: 0, rowH: 0 }));
    let ok = true;
    for (const it of items) {
      let placed = false;
      for (const b of bins) {
        if (b.cx + it.w > b.w) { b.cx = 0; b.cy += b.rowH + 1; b.rowH = 0; }
        if (b.cy + it.h <= b.h && b.cx + it.w <= b.w) {
          it.x = b.x + b.cx; it.y = b.y + b.cy;
          b.cx += it.w + 1; b.rowH = Math.max(b.rowH, it.h);
          placed = true;
          break;
        }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) {
      for (const it of items) Object.assign(it.f, { x: it.x, y: it.y, w: it.w, h: it.h, free: true, scale });
      return scale;
    }
  }
  throw new Error("Serbest atlas alanı yetersiz");
}

// Şeklin tüm yüzlerini atlasa yerleştirir. Dönüş: { parts, faces, report }
export function mapShape(atlas, cat, parts, slim = false) {
  const faces = [];
  let skipped = 0;
  parts.forEach((p, pi) => {
    for (const face of FACES) {
      if (p.skip?.includes(face)) continue;
      const [w, h] = dims(p, face);
      if (w < 1e-6 || h < 1e-6) continue;
      const f = { part: pi, face };
      const r = p.free ? null : chartRect(atlas, p, face, slim);
      if (r) Object.assign(f, r);
      else f.wantFree = true;
      // Tamamen başka parçaların içinde kalan yüz çizilmez.
      const probe = r ? f : { ...f, w: Math.max(1, Math.round(w * D)), h: Math.max(1, Math.round(h * D)) };
      const n = NORMAL[face];
      if (texelPoints(p, probe).every(({ pt }) => hiddenAt(cat, parts, pi, pt, n, slim))) { skipped++; continue; }
      faces.push(f);
    }
  });

  // Görünür iki yüz aynı dokseli paylaşıyorsa küçüğünü serbest alana taşı.
  const moved = [];
  for (let iter = 0; iter < 200; iter++) {
    const own = new Map();
    const conflict = new Map();
    faces.forEach((f, fi) => {
      if (f.wantFree) return;
      const p = parts[f.part];
      const n = NORMAL[f.face];
      for (const { i, j, pt } of texelPoints(p, f)) {
        if (hiddenAt(cat, parts, f.part, pt, n, slim)) continue;
        const key = (f.y + j) * atlas.W + (f.x + i);
        const prev = own.get(key);
        if (prev === undefined) own.set(key, fi);
        else if (prev !== fi) {
          const k = prev < fi ? `${prev},${fi}` : `${fi},${prev}`;
          conflict.set(k, (conflict.get(k) ?? 0) + 1);
        }
      }
    });
    let worst = null;
    for (const [k, c] of conflict) if (c >= 2 && (!worst || c > worst.c)) worst = { k, c };
    if (!worst) break;
    const [a, b] = worst.k.split(",").map(Number);
    const area = (f) => f.w * f.h;
    const victim = area(faces[a]) <= area(faces[b]) ? faces[a] : faces[b];
    if (process.env.GM_DEBUG) console.log(`çakışma ${worst.c}: #${faces[a].part}.${faces[a].face} [${faces[a].x},${faces[a].y} ${faces[a].w}x${faces[a].h}] ↔ #${faces[b].part}.${faces[b].face} [${faces[b].x},${faces[b].y} ${faces[b].w}x${faces[b].h}]`);
    victim.wantFree = true;
    moved.push(`${parts[victim.part].role}#${victim.part}.${victim.face}`);
  }
  const freeFaces = faces.filter((f) => f.wantFree);
  const scale = packFree(atlas, freeFaces, parts);
  for (const f of faces) delete f.wantFree;
  return { parts, faces, report: { skipped, moved, freeFaces: freeFaces.length, freeScale: scale ?? 1 } };
}

// Atlasın her dokseli için tek sahip: görünür yüz önceliklidir. ctxList: texels() çıktısı.
export function resolveOwners(cat, layout, ctxList, slim) {
  const best = new Map();
  for (const c of ctxList) {
    const key = c.ty * SIZE + c.tx;
    const vis = c.faceRef?.free ? true : !hiddenAt(cat, layout.parts, c.part, c.p, c.n, slim);
    c.visible = vis;
    const prev = best.get(key);
    if (!prev || (!prev.visible && vis)) best.set(key, c);
  }
  return [...best.values()];
}

// Temas gölgesi: yüzün hemen önünde dışarı taşan başka bir parça varsa (manşet altı, siperlik altı, cep kenarı)
// yüz kararır. R: etki uzaklığı (birim).
export function contactShade(layout, c, R = 0.6) {
  let s = 0;
  const parts = layout.parts;
  for (let qi = 0; qi < parts.length; qi++) {
    if (qi === c.part) continue;
    const q = parts[qi];
    if (q.bone !== parts[c.part].bone || q.noShadow) continue;
    let d2 = 0;
    for (let a = 0; a < 3; a++) {
      const v = c.p[a];
      const lo = q.from[a], hi = q.to[a];
      if (v < lo) d2 += (lo - v) ** 2;
      else if (v > hi) d2 += (v - hi) ** 2;
    }
    if (d2 === 0 || d2 > R * R) continue;
    // q, yüzün normali yönünde yüzeyin dışına taşıyor mu?
    let ext = -Infinity;
    for (let a = 0; a < 3; a++) {
      if (!c.n[a]) continue;
      ext = c.n[a] > 0 ? q.to[a] - c.p[a] : c.p[a] - q.from[a];
    }
    if (ext < 0.06) continue;
    const d = Math.sqrt(d2);
    s -= 0.13 * (1 - d / R) ** 2;
  }
  return Math.max(-0.26, s);
}
