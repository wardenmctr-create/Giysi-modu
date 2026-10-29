// Vektör motifler: büyütüldüğünde/döndürüldüğünde bozulmayan, yüksek çözünürlükte çizilen şekiller.
// Her motif (x, y) ∈ [0,1]² (y aşağı) için kanal döndürür: 0 boş, 1..3 renk kanalı.
// rasterize() 4×4 alt örnekleme ile çoğunluk kanalını seçer (keskin, alfa testine uygun kenarlar).

const TAU = Math.PI * 2;
const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function starPts(cx, cy, rOut, rIn, n, rotDeg = -90) {
  const pts = [];
  for (let k = 0; k < n * 2; k++) {
    const r = k % 2 ? rIn : rOut;
    const a = ((rotDeg + (k * 180) / n) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Türk Bayrağı Kanunu oranları (G = bayrak eni): dış hilal dairesi çapı G/2, merkezler arası G/16,
// iç daire çapı 2G/5, yıldız dairesi çapı G/4. Yıldızın bir ucu hilale bakar.
// Koordinatlar G=60000 birimlik resmî çizimden: dış merkez x=30000, iç merkez x=33750, yıldız merkezi x=49250.
function turkEmblem(x, y, ox, oy, G) {
  const u = (x - ox) / G * 60000, v = (y - oy) / G * 60000;
  const inOuter = (u - 30000) ** 2 + v * v <= 15000 * 15000;
  const inInner = (u - 33750) ** 2 + v * v <= 12000 * 12000;
  if (inOuter && !inInner) return true;
  return inPoly(u, v, starPts(49250, 0, 7500, 7500 * 0.382, 5, 180));
}

export const VECTOR_MOTIFS = {
  yildiz: (x, y) => (inPoly(x, y, starPts(0.5, 0.53, 0.48, 0.19, 5)) ? 1 : 0),
  kalp: (x, y) => {
    const X = (x - 0.5) * 2.5, Y = (0.42 - y) * 2.5;
    return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0 ? 1 : 0;
  },
  simsek: (x, y) => (inPoly(x, y, [[0.6, 0.02], [0.22, 0.55], [0.47, 0.55], [0.36, 0.98], [0.8, 0.4], [0.54, 0.4], [0.72, 0.02]]) ? 1 : 0),
  hilal: (x, y) => (inCircle(x, y, 0.47, 0.5, 0.45) && !inCircle(x, y, 0.62, 0.45, 0.37) ? 1 : 0),
  gunes: (x, y) => {
    if (inCircle(x, y, 0.5, 0.5, 0.24)) return 1;
    const a = Math.atan2(y - 0.5, x - 0.5), r = Math.hypot(x - 0.5, y - 0.5);
    const k = ((a / TAU) * 12 + 12) % 1;
    return r > 0.3 && r < 0.48 && Math.abs(k - 0.5) < 0.18 * (1 - (r - 0.3) / 0.18) + 0.02 ? 1 : 0;
  },
  bulut: (x, y) => (y < 0.72 && (inCircle(x, y, 0.3, 0.55, 0.18) || inCircle(x, y, 0.5, 0.42, 0.24) || inCircle(x, y, 0.72, 0.55, 0.17) || inRect(x, y, 0.3, 0.5, 0.72, 0.72)) ? 1 : 0),
  yagmur: (x, y) => {
    if (y < 0.55 && (inCircle(x, y, 0.3, 0.4, 0.16) || inCircle(x, y, 0.5, 0.3, 0.21) || inCircle(x, y, 0.72, 0.4, 0.15) || inRect(x, y, 0.3, 0.36, 0.72, 0.55))) return 1;
    for (const [dx, dy] of [[0.3, 0.68], [0.5, 0.78], [0.7, 0.68], [0.4, 0.92], [0.6, 0.92]]) if (segDist(x, y, dx + 0.04, dy - 0.06, dx - 0.03, dy + 0.04) < 0.03) return 1;
    return 0;
  },
  yaprak: (x, y) => {
    const u = (x - 0.5) * 0.7071 + (y - 0.5) * 0.7071, v = -(x - 0.5) * 0.7071 + (y - 0.5) * 0.7071;
    const lens = inCircle(u, v, 0, 0.3, 0.42) && inCircle(u, v, 0, -0.3, 0.42);
    if (lens && Math.abs(v) < 0.022 && Math.abs(u) < 0.36) return 0;
    if (segDist(u, v, 0.32, 0, 0.47, 0) < 0.03) return 1;
    return lens ? 1 : 0;
  },
  kar: (x, y) => {
    const X = x - 0.5, Y = y - 0.5;
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a);
      const u = X * ca + Y * sa, v = -X * sa + Y * ca;
      if (u > -0.02 && u < 0.46 && Math.abs(v) < 0.035) return 1;
      if (segDist(u, v, 0.26, 0, 0.36, 0.1) < 0.03 || segDist(u, v, 0.26, 0, 0.36, -0.1) < 0.03) return 1;
    }
    return inCircle(x, y, 0.5, 0.5, 0.07) ? 1 : 0;
  },
  dalga: (x, y) => {
    for (const y0 of [0.38, 0.62]) if (Math.abs(y - y0 - 0.1 * Math.sin(x * TAU * 1.5)) < 0.065) return 1;
    return 0;
  },
  girdap: (x, y) => {
    const X = x - 0.5, Y = y - 0.5, r = Math.hypot(X, Y);
    if (r > 0.47) return 0;
    const a = (Math.atan2(Y, X) / TAU + 1) % 1;
    const t = (r / 0.47) * 3 - a;
    return Math.abs(t - Math.round(t)) < 0.17 ? 1 : 0;
  },
  disli: (x, y) => {
    const X = x - 0.5, Y = y - 0.5, r = Math.hypot(X, Y);
    if (r < 0.13) return 0;
    const a = Math.atan2(Y, X);
    const tooth = Math.cos(a * 8) > 0.2 ? 0.47 : 0.37;
    return r < tooth ? 1 : 0;
  },
  pusula: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    if (r > 0.41 && r < 0.48) return 1;
    return inPoly(x, y, starPts(0.5, 0.5, 0.38, 0.09, 4)) ? 1 : 0;
  },
  cift_serit: (x, y) => (inRect(x, y, 0.04, 0.24, 0.96, 0.4) || inRect(x, y, 0.04, 0.6, 0.96, 0.76) ? 1 : 0),
  pati: (x, y) => (inEllipse(x, y, 0.5, 0.66, 0.22, 0.18) || inEllipse(x, y, 0.22, 0.42, 0.09, 0.12) || inEllipse(x, y, 0.4, 0.26, 0.09, 0.12) || inEllipse(x, y, 0.6, 0.26, 0.09, 0.12) || inEllipse(x, y, 0.78, 0.42, 0.09, 0.12) ? 1 : 0),

  // ---- yeni vektör motifler
  ay_yildiz: (x, y) => (turkEmblem(x, y, -0.32, 0.5, 1.4) ? 1 : 0),
  turk_bayragi: (x, y) => {
    if (y < 1 / 6 || y > 5 / 6) return 0;
    const G = 2 / 3;
    return turkEmblem(x, y, 0, 0.5, G) ? 2 : 1;
  },
  nazar: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    if (r > 0.48) return 0;
    if (r < 0.1) return 1;
    if (r < 0.21) return 3;
    if (r < 0.33) return 2;
    return 1;
  },
  lale: (x, y) => {
    const cup = inEllipse(x, y, 0.5, 0.36, 0.22, 0.26) && y > 0.18;
    const petals = inPoly(x, y, [[0.28, 0.32], [0.33, 0.06], [0.42, 0.26], [0.5, 0.04], [0.58, 0.26], [0.67, 0.06], [0.72, 0.32]]);
    if (cup || petals) return 1;
    if (Math.abs(x - 0.5) < 0.03 && y > 0.55 && y < 0.97) return 2;
    if (inPoly(x, y, [[0.5, 0.9], [0.24, 0.6], [0.3, 0.58], [0.5, 0.8]]) || inPoly(x, y, [[0.5, 0.88], [0.76, 0.66], [0.7, 0.64], [0.5, 0.78]])) return 2;
    return 0;
  },
  selcuklu: (x, y) => {
    const X = x - 0.5, Y = y - 0.5;
    const sq = (u, v, s) => Math.abs(u) <= s && Math.abs(v) <= s;
    const r45 = (u, v) => [(u + v) * 0.7071, (v - u) * 0.7071];
    const outer = sq(X, Y, 0.34) || sq(...r45(X, Y), 0.34);
    const inner = sq(X, Y, 0.24) || sq(...r45(X, Y), 0.24);
    if (outer && !inner) return 1;
    return Math.hypot(X, Y) < 0.12 && Math.hypot(X, Y) > 0.06 ? 1 : 0;
  },
  nota: (x, y) => {
    if (inEllipse((x - 0.38) * 0.94 + (y - 0.76) * 0.34 + 0.38, -(x - 0.38) * 0.34 + (y - 0.76) * 0.94 + 0.76, 0.38, 0.76, 0.16, 0.11)) return 1;
    if (inRect(x, y, 0.5, 0.12, 0.56, 0.74)) return 1;
    if (inPoly(x, y, [[0.53, 0.1], [0.82, 0.3], [0.8, 0.44], [0.56, 0.28]])) return 1;
    return 0;
  },
  baris: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    if (r > 0.38 && r < 0.47) return 1;
    if (r > 0.4) return 0;
    if (Math.abs(x - 0.5) < 0.04) return 1;
    if (y > 0.5 && (segDist(x, y, 0.5, 0.5, 0.22, 0.78) < 0.04 || segDist(x, y, 0.5, 0.5, 0.78, 0.78) < 0.04)) return 1;
    return 0;
  },
  gulen_yuz: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    if (r > 0.47) return 0;
    if (inEllipse(x, y, 0.36, 0.38, 0.05, 0.08) || inEllipse(x, y, 0.64, 0.38, 0.05, 0.08)) return 2;
    const sr = Math.hypot(x - 0.5, y - 0.5);
    if (y > 0.55 && sr > 0.22 && sr < 0.29) return 2;
    return 1;
  },
  yonca: (x, y) => {
    for (const [cx, cy] of [[0.5, 0.27], [0.27, 0.5], [0.73, 0.5], [0.5, 0.73]]) if (inCircle(x, y, cx, cy, 0.19)) return 1;
    return segDist(x, y, 0.55, 0.6, 0.78, 0.97) < 0.035 ? 1 : 0;
  },
  sonsuz: (x, y) => {
    const X = (x - 0.5) * 2.4, Y = (y - 0.5) * 2.4;
    const v = (X * X + Y * Y) ** 2 - 2 * 0.95 * 0.95 * (X * X - Y * Y);
    return Math.abs(v) < 0.42 ? 1 : 0;
  },
  damla: (x, y) => {
    if (inCircle(x, y, 0.5, 0.64, 0.3)) return 1;
    return inPoly(x, y, [[0.5, 0.04], [0.23, 0.55], [0.77, 0.55]]) ? 1 : 0;
  },
  gezegen: (x, y) => {
    const X = x - 0.5, Y = y - 0.5;
    const u = X * 0.94 + Y * 0.34, v = -X * 0.34 + Y * 0.94;
    const ringO = (u / 0.48) ** 2 + (v / 0.14) ** 2 <= 1, ringI = (u / 0.36) ** 2 + (v / 0.08) ** 2 <= 1;
    const ball = Math.hypot(X, Y) < 0.27;
    if (ringO && !ringI && !(ball && v < 0)) return 2;
    return ball ? 1 : 0;
  },
  gokkusagi: (x, y) => {
    if (y > 0.72) return 0;
    const r = Math.hypot(x - 0.5, y - 0.72);
    if (r > 0.46) return 0;
    if (r > 0.36) return 1;
    if (r > 0.26) return 2;
    if (r > 0.16) return 3;
    return 0;
  },
  ok: (x, y) => {
    if (inPoly(x, y, [[0.95, 0.5], [0.6, 0.18], [0.6, 0.38], [0.06, 0.38], [0.06, 0.62], [0.6, 0.62], [0.6, 0.82]])) return 1;
    return 0;
  },
  futbol: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    if (r > 0.47) return 0;
    if (inPoly(x, y, starPts(0.5, 0.5, 0.15, 0.15 * 0.81, 5).filter((_, k) => k % 2 === 0))) return 2;
    for (let k = 0; k < 5; k++) {
      const a = ((-90 + 36 + k * 72) * Math.PI) / 180;
      const cx = 0.5 + Math.cos(a) * 0.42, cy = 0.5 + Math.sin(a) * 0.42;
      if (inCircle(x, y, cx, cy, 0.11) && r < 0.47) return 2;
      if (segDist(x, y, 0.5 + Math.cos(a) * 0.16, 0.5 + Math.sin(a) * 0.16, cx, cy) < 0.018) return 2;
    }
    return 1;
  },
  oyun_kolu: (x, y) => {
    const body = inRect(x, y, 0.22, 0.3, 0.78, 0.62) || inCircle(x, y, 0.24, 0.52, 0.17) || inCircle(x, y, 0.76, 0.52, 0.17);
    if (!body) return 0;
    if (inRect(x, y, 0.19, 0.41, 0.33, 0.47) || inRect(x, y, 0.23, 0.37, 0.29, 0.51)) return 2;
    if (inCircle(x, y, 0.7, 0.4, 0.035) || inCircle(x, y, 0.78, 0.48, 0.035) || inCircle(x, y, 0.62, 0.48, 0.035) || inCircle(x, y, 0.7, 0.56, 0.035)) return 2;
    return 1;
  },

  // ---- ayarlanabilir şekiller (en/boy ayrı ayrı uzatılabilir)
  sekil_kare: () => 1,
  sekil_daire: (x, y) => (inCircle(x, y, 0.5, 0.5, 0.5) ? 1 : 0),
  sekil_ucgen: (x, y) => (inPoly(x, y, [[0.5, 0.0], [1.0, 1.0], [0.0, 1.0]]) ? 1 : 0),
  sekil_halka: (x, y) => {
    const r = Math.hypot(x - 0.5, y - 0.5);
    return r <= 0.5 && r >= 0.32 ? 1 : 0;
  },
  sekil_baklava: (x, y) => (Math.abs(x - 0.5) + Math.abs(y - 0.5) <= 0.5 ? 1 : 0),
  sekil_yarim: (x, y) => (y >= 0.5 ? 0 : inCircle(x, y, 0.5, 0.5, 0.5) ? 1 : 0),
};

export function rasterize(fn, size, channels) {
  const out = Array.from({ length: channels }, () => new Uint8Array(size * size));
  const SS = 4;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const votes = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      votes[fn((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)]++;
    }
    let best = 0;
    for (let k = 1; k <= channels; k++) if (votes[k] > votes[best]) best = k;
    if (best && votes[best] >= (SS * SS) / 2 - 2 && votes[0] < (SS * SS) / 2 + 2) out[best - 1][py * size + px] = 1;
    else if (best && votes[0] <= SS * SS / 2) out[best - 1][py * size + px] = 1;
  }
  return out;
}
