// 25 ortak renk şablonu — giysiye oturan sürümler.
// Desenler kutu yüzlerine tek tek değil, gövde çevresi (U) ve yükseklik (V) üzerinde sürekli uygulanır;
// ön ortaya göre simetriktir. Yaka, manşet, etek bandı, taban gibi kenar parçaları desenli
// şablonlarda düz kalır (bölge 0), "Kenarlık" şablonunda ise ayrı renk alır.
// ctx alanları: garment.mjs texels(); G = { cat, trims:Set, tp:{...} }

const fl = Math.floor;
const mod = (a, n) => ((a % n) + n) % n;
const tri = (t) => Math.abs(mod(t, 2) - 1); // 0..1 üçgen dalga

// Uzuv/gövde içi "ön" koordinatı: ayakkabı ve pantolonda her bacak kendi ön ortasına göre.
function quarter(c) {
  // 0: arka-sağ, 1: ön-sağ, 2: ön-sol, 3: arka-sol (giyenin bakışıyla)
  const P = c.P;
  if (c.bone === "body" || c.bone === "head") {
    if (c.U < -P / 4) return 0;
    if (c.U < 0) return 1;
    if (c.U < P / 4) return 2;
    return 3;
  }
  const right = c.x < 0;
  const front = c.front;
  if (right) return front ? 1 : 0;
  return front ? 2 : 3;
}

const trimSolid = (fn) => (c, G) => (G.trims.has(c.role) ? 0 : fn(c, G));

function swirl(c, G, arms, tight) {
  // Odak: gövdede göğüs ortası; bacakta/ayakkabıda her uzvun ön ortası; şapkada alın ortası.
  const du = c.U / 1.6;
  const dv = (c.V - G.tp.focusV) / 1.6;
  const r = Math.hypot(du, dv);
  const th = Math.atan2(dv, du) / (2 * Math.PI) + 0.5;
  return mod(fl(th * arms + r * tight), arms);
}

export const TEMPLATE_FN = {
  duz: () => 0,

  ust_alt: (c, G) => {
    switch (G.cat) {
      case "hat": return c.role === "cuff" || c.role === "label" ? 1 : 0;
      case "shoes": return c.role === "sole" ? 1 : 0;
      case "pants": return c.y > 6.6 ? 0 : 1;
      default: return c.vn < 0.42 ? 0 : 1;
    }
  },

  on_arka: (c) => (c.front ? 0 : 1),

  sag_sol: (c) => (c.x < 0 ? 0 : 1),

  kenarlik: (c, G) => {
    if (G.trims.has(c.role)) return 1;
    if (G.cat === "hat") return c.role === "cuff" && (c.face === "up" || c.j === 0 || c.j === c.h - 1) ? 1 : 0;
    if (G.cat === "pants") return c.role === "pocket" || (c.role === "pocketFront" && c.pocketArc < 0.3) ? 1 : 0;
    if (G.cat === "shoes") return c.role === "toe" ? 1 : 0;
    return 0;
  },

  orta_serit: (c, G) => {
    if (G.tp.band === "stripe") return c.role === "stripe" ? 1 : 0;
    if (G.trims.has(c.role) && G.cat !== "hat") return 0;
    if (G.cat === "hat") return c.role === "crown" && c.V > G.tp.band[0] && c.V < G.tp.band[1] ? 1 : 0;
    return c.V > G.tp.band[0] && c.V < G.tp.band[1] ? 1 : 0;
  },

  ikili_dikey: trimSolid((c, G) => mod(fl(c.U / G.tp.stripeW + 0.5), 2)),
  uclu_dikey: trimSolid((c, G) => mod(fl(c.U / G.tp.stripeW + 0.5), 3)),
  ikili_yatay: trimSolid((c, G) => mod(fl(c.V / G.tp.bandH), 2)),
  uclu_yatay: trimSolid((c, G) => mod(fl(c.V / G.tp.bandH), 3)),

  capraz: (c, G) => {
    if (G.cat === "shoes") return (c.z + 2.6) / 5.4 + (c.y - 1.8) / 3.6 < 0.5 ? 0 : 1;
    const W = G.cat === "hat" ? 9.8 : G.cat === "pants" ? 8.6 : 9.0;
    return c.x / W + (c.vn - 0.5) < 0 ? 0 : 1;
  },

  cift_capraz: (c, G) => {
    if (G.trims.has(c.role)) return 0;
    if (G.cat === "shoes") {
      const a = (c.z + 2.6) / 5.4 - 0.5, b = (c.y - 0.75) / 3.2 - 0.5;
      return Math.abs(a - b) < 0.11 || Math.abs(a + b) < 0.11 ? 1 : 0;
    }
    const W = G.cat === "hat" ? 9.8 : G.cat === "pants" ? 8.6 : 9.0;
    const a = c.x / W, b = c.vn - 0.5;
    return Math.abs(a - b) < 0.085 || Math.abs(a + b) < 0.085 ? 1 : 0;
  },

  dama: trimSolid((c, G) => mod(fl(c.U / G.tp.check + 0.5) + fl(c.V / G.tp.check), 2)),
  dort_dama: trimSolid((c, G) => mod(fl(c.U / G.tp.check + 0.5), 2) + 2 * mod(fl(c.V / G.tp.check), 2)),

  baklava: trimSolid((c, G) => {
    const s = G.tp.check * 1.6;
    const a = Math.abs(mod(c.U / s + 0.5, 1) - 0.5);
    const b = Math.abs(mod(c.V / (s * 1.4), 1) - 0.5);
    return a + b < 0.5 ? 1 : 0;
  }),

  zikzak: trimSolid((c, G) => mod(fl((c.V + tri(c.U / (G.tp.stripeW * 1.2)) * G.tp.bandH) / G.tp.bandH), 2)),

  sevron: trimSolid((c, G) => {
    const lateral = G.cat === "shoes" || G.cat === "pants" ? Math.abs(c.U) : Math.abs(c.x);
    return mod(fl((c.V - lateral * 0.75) / (G.tp.bandH * 1.2)), 2);
  }),

  benek: trimSolid((c, G) => {
    const s = G.tp.dot;
    const row = fl(c.V / s);
    const off = row % 2 ? s / 2 : 0;
    const du = mod(c.U + off + s / 2, s) - s / 2;
    const dv = mod(c.V, s) - s / 2;
    return Math.hypot(du, dv) < s * 0.3 ? 1 : 0;
  }),

  dalga: trimSolid((c, G) => mod(fl((c.V + Math.sin((c.U * 2 * Math.PI) / (G.tp.stripeW * 3)) * G.tp.bandH * 0.45) / G.tp.bandH), 2)),

  kisa_girdap: trimSolid((c, G) => swirl(c, G, 3, 1.1)),
  uzun_girdap: trimSolid((c, G) => swirl(c, G, 4, 2.4)),

  kose: (c, G) => {
    switch (G.cat) {
      case "top":
        if (G.trims.has(c.role)) return 0;
        if (Math.abs(c.x) > 1.8 && c.V < 3.8) return c.x < 0 ? 1 : 2;
        if (Math.abs(c.x) > 1.8 && c.V > 9.0) return c.x < 0 ? 3 : 4;
        return 0;
      case "pants": {
        if (G.trims.has(c.role)) return 0;
        const outer = c.x < 0 ? c.x < -2.1 : c.x > 2.1;
        if (c.y > 8.6 && outer) return c.x < 0 ? 1 : 2;
        if (c.y < 3.0) return c.x < 0 ? 3 : 4;
        return 0;
      }
      case "hat":
        if (c.role !== "cuff") return 0;
        return [3, 1, 2, 4][quarter(c)];
      case "shoes":
        if (c.role !== "upper" && c.role !== "toe" && c.role !== "stripe") return 0;
        if (c.z < -0.9) return c.x < 0 ? 1 : 3;
        if (c.z > 1.0) return c.x < 0 ? 2 : 4;
        return 0;
    }
    return 0;
  },

  yamali: trimSolid((c, G) => {
    const [w, h] = G.tp.patch;
    const j = fl(c.V / h);
    const i = fl((c.U + (j % 2 ? w / 2 : 0)) / w + 50);
    return mod(i + 2 * j + (mod(i * 7 + j * 3, 5) === 0 ? 3 : 0), 6);
  }),

  mozaik: trimSolid((c, G) => {
    const s = G.tp.mosaic;
    const i = fl(c.U / s + 50), j = fl(c.V / s);
    const fu = mod(c.U / s, 1), fv = mod(c.V / s, 1);
    const t = (i + j) % 2 ? (fu > fv ? 1 : 0) : (fu + fv > 1 ? 1 : 0);
    return mod(3 * i + 5 * j + 4 * t, 8);
  }),

  on_alti: (c, G) => {
    const col = quarter(c);
    let row = Math.max(0, Math.min(3, fl(c.vn * 4)));
    if (G.cat === "hat" && c.face === "up") row = 0;
    if (G.cat === "shoes") row = Math.max(0, Math.min(3, fl((1 - c.y / 3.95) * 4)));
    return row * 4 + col;
  },
};
