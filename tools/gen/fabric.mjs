// Kumaş gölgelendirme yardımcıları. Gölge değeri s: negatif koyulaştırır, pozitif aydınlatır (−1..1).
// Oyunda karışımlı bir katman olarak her boya renginin üstüne biner; böylece doku her renkte korunur.

export function hash2(x, y, seed = 0) {
  let h = Math.imul((x | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul((y | 0) + seed * 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

export function noise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed = 0) {
  return noise(x, y, seed) * 0.6 + noise(x * 2.1, y * 2.1, seed + 7) * 0.3 + noise(x * 4.3, y * 4.3, seed + 13) * 0.1;
}

// Doksel tamsayı koordinatı (yüzler arası sürekli): gövde çevresi ve yükseklik birimden dokselleri.
export const gx = (c) => Math.floor((c.U + 64) * 2);
export const gy = (c) => Math.floor(c.V * 2);

const gauss = (d, w) => Math.exp(-(d * d) / (w * w));

// Bir çizgi parçasına uzaklık (2B).
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Kesikli dikiş: çizgiye yakın dokselde, adım boyunca 2 dolu 1 boş.
export function stitch(onLine, along, strength = -0.26) {
  if (!onLine) return 0;
  return Math.floor(along * 2) % 3 === 2 ? 0 : strength;
}

// Ortak ışık: üst yüzler aydınlık, alt yüzler gölgede, yüz kenarlarında ince koyu hat.
export function lighting(c) {
  let s = 0;
  if (c.face === "up") s += 0.07;
  if (c.face === "down") s -= 0.22;
  if (c.face === "east" || c.face === "west") s -= 0.03;
  if (c.face === "south") s -= 0.02;
  // Yüzün en dış doksel sırası (kutu kenarı) ince koyu hat.
  if ((c.et ?? Math.floor(c.edge * 2)) === 0) s -= 0.1;
  return s;
}

// Örgü (bere): dikey ilmek sütunları ve V biçimli ilmekler.
export function knit(c, rib = false) {
  const X = gx(c), Y = gy(c);
  if (c.face === "up" || c.face === "down") {
    // Tepede merkeze toplanan ilmek çizgileri
    const ang = Math.atan2(c.z, c.x);
    const k = Math.floor(((ang / (2 * Math.PI)) + 1) * 24) % 2;
    return (k ? -0.07 : 0.03) + (noise(c.x * 3, c.z * 3, 5) - 0.5) * 0.06;
  }
  if (rib) return (X % 2 === 0 ? 0.09 : -0.11) + (noise(X * 0.5, Y * 0.3, 2) - 0.5) * 0.05;
  const col = X % 2;
  const v = (Y + (col ? 1 : 0)) % 2;
  return (col ? -0.05 : 0.04) + (v ? -0.04 : 0.03) + (noise(X * 0.4, Y * 0.4, 3) - 0.5) * 0.05;
}

// Penye (tişört): ince lif gürültüsü.
export function jersey(c) {
  const X = gx(c), Y = gy(c);
  return (hash2(X, Y, 11) - 0.5) * 0.05 + (noise(X * 0.25, Y * 0.25, 4) - 0.5) * 0.05;
}

// Kot: çapraz dimi örgüsü ve dikine iplik dalgalanması.
export function denim(c) {
  const X = gx(c), Y = gy(c);
  const tw = ((X + Y) % 3 + 3) % 3 === 0 ? -0.07 : 0.02;
  const slub = (noise(X * 0.15, Y * 0.9, 9) - 0.5) * 0.12;
  return tw + slub + (hash2(X, Y, 21) - 0.5) * 0.04;
}

// Kanvas (spor ayakkabı): ızgara dokuma.
export function canvas(c) {
  const X = gx(c), Y = gy(c);
  return ((X + Y) % 2 ? -0.03 : 0.02) + (hash2(X, Y, 31) - 0.5) * 0.04;
}

// Kauçuk taban: yatay diş çizgileri.
export function rubber(c) {
  const Y = Math.floor(c.y * 4);
  return (Y % 2 ? -0.06 : 0.03) + (hash2(gx(c), Y, 41) - 0.5) * 0.03;
}

export { gauss };
