// Tezgâh önizleme simgeleri: üst çapraz açıdan nokta-sıçratmalı küçük yazılımsal çizici.
import { Canvas, shade } from "../lib/png.mjs";

const FACE_LIGHT = { up: 1.0, north: 0.86, east: 0.72, west: 0.72, south: 0.6, down: 0.5 };

// Bölgeleri ayırt eden örnek renkler (16 bölgeye kadar).
export const SAMPLE = [
  0xb02e26, 0xfed83d, 0x3c44aa, 0x80c71f, 0xf9801d, 0x8932b8, 0x169c9c, 0xf38baa,
  0x835432, 0x5e7c16, 0x3ab3da, 0xc74ebd, 0x474f52, 0x1d1d21, 0x9d9d97, 0xf9fffe,
];

// texelList: { p:[x,y,z], face, color } — yalnızca kameraya bakan yüzler çizilir.
export function renderIso(texelList, size = 64, bbox) {
  const yaw = (-35 * Math.PI) / 180;
  const pitch = (28 * Math.PI) / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const proj = ([x, y, z]) => {
    // Kamera önden (−Z), biraz yukarıdan ve sağ yandan bakar.
    const X = x * cy - z * sy;
    const Z0 = x * sy + z * cy;
    const Y = y * cp + Z0 * sp;
    const D = -Z0 * cp + y * sp;
    return [X, Y, D];
  };
  const visible = new Set(["up", "north", "east"]);
  const pts = texelList.filter((t) => visible.has(t.face)).map((t) => ({ ...t, q: proj(t.p) }));
  if (!pts.length) return new Canvas(size, size);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of pts) {
    minX = Math.min(minX, t.q[0]); maxX = Math.max(maxX, t.q[0]);
    minY = Math.min(minY, t.q[1]); maxY = Math.max(maxY, t.q[1]);
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const sc = (size * 0.84) / span;
  const ox = size / 2 - ((minX + maxX) / 2) * sc;
  const oy = size / 2 + ((minY + maxY) / 2) * sc;
  const zb = new Float32Array(size * size).fill(Infinity);
  const cv = new Canvas(size, size);
  const r = Math.max(1, Math.ceil(sc * 0.32));
  for (const t of pts) {
    const px = Math.round(t.q[0] * sc + ox);
    const py = Math.round(-t.q[1] * sc + oy);
    const col = shade(t.color, FACE_LIGHT[t.face]);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const i = y * size + x;
      if (t.q[2] < zb[i]) { zb[i] = t.q[2]; cv.set(x, y, col); }
    }
  }
  return cv;
}

// Yapılmamış şekiller için kilitli simge (gri çerçeve + kilit).
export function lockedIcon(size = 64) {
  const cv = new Canvas(size, size);
  cv.fill(4, 4, size - 8, size - 8, 0x3a3a3a);
  cv.fill(6, 6, size - 12, size - 12, 0x5a5a5a);
  const m = size / 2;
  cv.fill(m - 10, m - 2, 20, 16, 0xc8a200);
  cv.fill(m - 7, m - 12, 4, 10, 0xc8a200);
  cv.fill(m + 3, m - 12, 4, 10, 0xc8a200);
  cv.fill(m - 7, m - 14, 14, 4, 0xc8a200);
  cv.fill(m - 2, m + 3, 4, 6, 0x3a2a00);
  return cv;
}

export function pixelIcon(rows, palette, scale = 1) {
  const h = rows.length, w = rows[0].length;
  const cv = new Canvas(w * scale, h * scale);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "." && palette[ch] !== undefined) cv.fill(x * scale, y * scale, scale, scale, palette[ch]);
  }));
  return cv;
}
