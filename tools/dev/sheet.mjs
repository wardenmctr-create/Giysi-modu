// Geliştirme aracı: şekilleri şablonlarla önden/arkadan çizip tek bir PNG sayfasına döker.
// Kullanım: node tools/dev/sheet.mjs <kategori> <şekil sırası|all> <çıktı.png> [şablon kimlikleri,virgülle]
import fs from "node:fs";
import { CATEGORIES, TEMPLATES } from "../catalog.mjs";
import { SHAPE_GEN } from "../gen/shapes.mjs";
import { buildAtlas, chartTexels, mapShape, resolveOwners, contactShade } from "../gen/atlas.mjs";
import { TEMPLATE_FN, TP, accentOf } from "../gen/templates.mjs";
import { texels } from "../gen/garment.mjs";
import { Canvas, shade } from "../lib/png.mjs";

const [cat, which, out, tplArg] = process.argv.slice(2);
const tplIds = (tplArg ?? "duz,kenarlik,ikili_dikey,dama,on_alti").split(",");
const PAL = [0xd8d8d8, 0xb02e26, 0x3c44aa, 0xfed83d, 0x5e7c16, 0x8932b8, 0xf9801d, 0x169c9c, 0x835432, 0xf38baa, 0x474f52, 0x80c71f, 0x3ab3da, 0xc74ebd, 0x1d1d21, 0x9d9d97];

const atlas = buildAtlas(cat);
const chart = [...chartTexels(atlas)];
const G = { cat, tp: TP[cat] };
const regionMap = {};
for (const id of tplIds) {
  const m = new Int8Array(atlas.W * atlas.H).fill(-1);
  for (const c of chart) m[c.ty * atlas.W + c.tx] = TEMPLATE_FN[id](c, G);
  regionMap[id] = m;
}

function render(points, size, back) {
  const yaw = ((back ? 210 : 30) * Math.PI) / 180, pitch = (18 * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Bedrock aynalaması: model −x giyenin sağı, önden bakınca solda görünür → dünya x = −model x.
  const proj = ([x, y, z]) => { const X = -x; const a = X * cy - z * sy; const Z1 = X * sy + z * cy; return [a, y * cp + Z1 * sp, -y * sp + Z1 * cp]; };
  const camDir = [sy * cp, -sp, cy * cp]; // derinlik artış yönü (bakış yönü)
  const N = { north: [0, 0, -1], south: [0, 0, 1], east: [-1, 0, 0], west: [1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
  const vis = points.filter((t) => { const n = N[t.face]; const wn = [-n[0], n[1], n[2]]; return wn[0] * -camDir[0] + wn[1] * -camDir[1] + wn[2] * -camDir[2] > 0.05; });
  return { pts: vis.map((t) => ({ ...t, q: proj(t.p) })), size };
}
function draw(cv, ox, oy, R, bounds) {
  const { pts, size } = R;
  const { minX, maxX, minY, maxY } = bounds;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const sc = (size * 0.9) / span;
  const cx = ox + size / 2 - ((minX + maxX) / 2) * sc, cy2 = oy + size / 2 + ((minY + maxY) / 2) * sc;
  const zb = new Float32Array(size * size).fill(Infinity);
  const r = Math.max(1, Math.ceil(sc * 0.3));
  for (const t of pts) {
    const px = Math.round(t.q[0] * sc + cx), py = Math.round(-t.q[1] * sc + cy2);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = px + dx - ox, Y = py + dy - oy;
      if (X < 0 || Y < 0 || X >= size || Y >= size) continue;
      const k = Y * size + X;
      if (t.q[2] < zb[k]) { zb[k] = t.q[2]; cv.set(ox + X, oy + Y, t.color); }
    }
  }
}

const list = which === "all" ? Object.keys(SHAPE_GEN[cat]).map(Number) : [Number(which)];
const SZ = Number(process.env.SZ ?? 150);
const rows = [];
for (const si of list) {
  const def = SHAPE_GEN[cat][si]().std;
  const layout = mapShape(atlas, cat, def.parts, false);
  const raw = [...texels(layout, { slim: false, yRef: atlas.yRef, zones: def.zones })];
  const owners = resolveOwners(cat, layout, raw, false).filter((c) => c.visible);
  for (const c of owners) { c.s = def.shade(c) + contactShade(layout, c); c.d = def.detail(c); }
  rows.push({ si, owners });
}
const cv = new Canvas(SZ * tplIds.length * 2, SZ * rows.length);
cv.fill(0, 0, cv.w, cv.h, 0x2a3236);
rows.forEach(({ owners }, ri) => {
  tplIds.forEach((id, ti) => {
    const acc = accentOf(id);
    const pts = owners.map((c) => {
      let r = c.partDef.trim && acc >= 0 ? acc : c.faceRef.free ? 0 : regionMap[id][c.ty * atlas.W + c.tx];
      if (r < 0) r = 0;
      let col = PAL[r];
      col = c.d ?? (c.s < 0 ? shade(col, 1 + c.s) : (() => { const f = c.s; const ch = (v) => Math.round(v + (255 - v) * f); return (ch((col >> 16) & 255) << 16) | (ch((col >> 8) & 255) << 8) | ch(col & 255); })());
      return { p: c.p, face: c.face, color: col };
    });
    for (const back of [false, true]) {
      const R = render(pts, SZ, back);
      const all = render(owners.map((c) => ({ p: c.p, face: c.face })), SZ, back).pts.concat(R.pts);
      const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      for (const t of all) { b.minX = Math.min(b.minX, t.q[0]); b.maxX = Math.max(b.maxX, t.q[0]); b.minY = Math.min(b.minY, t.q[1]); b.maxY = Math.max(b.maxY, t.q[1]); }
      draw(cv, (ti * 2 + (back ? 1 : 0)) * SZ, ri * SZ, R, b);
    }
  });
});
fs.writeFileSync(out, cv.toPNG());
console.log(`${out}: ${rows.length} şekil × ${tplIds.length} şablon`);
