// 25 ortak renk şablonu — kategori atlasının kanonik haritası üzerinde hesaplanır (atlas.mjs chartTexels).
// Desenler kutu yüzlerine tek tek değil, gövde çevresi (U) ve yükseklik (V) üzerinde süreklidir; ön ortaya göre
// simetriktir. Kenar parçaları (yaka, manşet, etek bandı, taban, bağcık...) haritada desen alır ama ayrıca
// "vurgu" geçişiyle boyanır: TEMPLATE_ACCENT şablon başına kenarların hangi bölgenin rengini alacağını söyler
// (-1: kenarlar bulundukları yerin desenini izler, 0: düz ana renk, 1: ikinci renk).
// ctx alanları: atlas.mjs chartTexels(); G = { cat, tp }

const fl = Math.floor;
const mod = (a, n) => ((a % n) + n) % n;
const tri = (t) => Math.abs(mod(t, 2) - 1); // 0..1 üçgen dalga

// Kategori başına desen ölçüleri (birim).
export const TP = {
  hat: { stripeW: 1.5, bandH: 0.9, check: 1.3, dot: 1.6, focusV: 1.2, band: [0.8, 1.8], patch: [2.2, 1.4], mosaic: 1.2 },
  top: { stripeW: 1.5, bandH: 1.6, check: 2.0, dot: 2.2, focusV: 5.7, band: [3.7, 5.7], patch: [2.4, 2.2], mosaic: 1.9 },
  pants: { stripeW: 1.2, bandH: 1.5, check: 1.6, dot: 2.0, focusV: 7.1, band: [7.3, 8.9], patch: [2.0, 2.4], mosaic: 1.7 },
  shoes: { stripeW: 1.0, bandH: 0.6, check: 0.9, dot: 1.1, focusV: 9.95, band: [9.8, 10.6], patch: [1.4, 1.0], mosaic: 1.1 },
};

// Uzuv/gövde içi çeyrek: 0 arka-sağ, 1 ön-sağ, 2 ön-sol, 3 arka-sol (giyenin bakışıyla).
function quarter(c) {
  const P = c.P;
  if (c.bone === "body" || c.bone === "head") {
    if (c.U < -P / 4) return 0;
    if (c.U < 0) return 1;
    if (c.U < P / 4) return 2;
    return 3;
  }
  const right = c.x < 0;
  if (right) return c.front ? 1 : 0;
  return c.front ? 2 : 3;
}

function swirl(c, G, arms, tight) {
  // Odak: gövdede göğüs ortası; bacakta/ayakkabıda her uzvun ön ortası; şapkada alın ortası.
  const du = c.U / 1.6;
  const dv = (c.V - G.tp.focusV) / 1.6;
  const r = Math.hypot(du, dv);
  const th = Math.atan2(dv, du) / (2 * Math.PI) + 0.5;
  return mod(fl(th * arms + r * tight), arms);
}

const WIDTH = { hat: 9.8, top: 9.0, pants: 8.6 };

export const TEMPLATE_FN = {
  duz: () => 0,

  ust_alt: (c, G) => {
    switch (G.cat) {
      case "hat": return c.V > 2.0 ? 1 : 0; // katlama / siperlik / bant seviyesi
      case "shoes": return c.y < 0.75 ? 1 : 0; // taban
      case "pants": return c.y > 6.6 ? 0 : 1;
      default: return c.vn < 0.42 ? 0 : 1;
    }
  },

  on_arka: (c) => (c.front ? 0 : 1),

  sag_sol: (c) => (c.x < 0 ? 0 : 1),

  kenarlik: (c, G) => {
    // Ana kumaş 0; kenar parçaları vurgu geçişiyle 1. Ayakkabıda burun ucu da kenarlık rengindedir.
    if (G.cat === "shoes") {
      if (c.chart === "up") return c.z < -2.7 ? 1 : 0;
      return c.face === "north" && c.y > 0.75 && c.y < 2.0 ? 1 : 0;
    }
    return 0;
  },

  orta_serit: (c, G) => {
    if (c.chart !== "wrap") return 0;
    return c.V > G.tp.band[0] && c.V < G.tp.band[1] ? 1 : 0;
  },

  ikili_dikey: (c, G) => mod(fl(c.U / G.tp.stripeW + 0.5), 2),
  uclu_dikey: (c, G) => mod(fl(c.U / G.tp.stripeW + 0.5), 3),
  ikili_yatay: (c, G) => mod(fl(c.V / G.tp.bandH), 2),
  uclu_yatay: (c, G) => mod(fl(c.V / G.tp.bandH), 3),

  capraz: (c, G) => {
    if (G.cat === "shoes") return (c.z + 2.6) / 5.4 + (c.y - 1.8) / 3.6 < 0.5 ? 0 : 1;
    return c.x / WIDTH[G.cat] + (c.vn - 0.5) < 0 ? 0 : 1;
  },

  cift_capraz: (c, G) => {
    if (G.cat === "shoes") {
      const a = (c.z + 2.6) / 5.4 - 0.5, b = (c.y - 0.75) / 3.2 - 0.5;
      return Math.abs(a - b) < 0.11 || Math.abs(a + b) < 0.11 ? 1 : 0;
    }
    const a = c.x / WIDTH[G.cat], b = c.vn - 0.5;
    return Math.abs(a - b) < 0.085 || Math.abs(a + b) < 0.085 ? 1 : 0;
  },

  dama: (c, G) => mod(fl(c.U / G.tp.check + 0.5) + fl(c.V / G.tp.check), 2),
  dort_dama: (c, G) => mod(fl(c.U / G.tp.check + 0.5), 2) + 2 * mod(fl(c.V / G.tp.check), 2),

  baklava: (c, G) => {
    const s = G.tp.check * 1.6;
    const a = Math.abs(mod(c.U / s + 0.5, 1) - 0.5);
    const b = Math.abs(mod(c.V / (s * 1.4), 1) - 0.5);
    return a + b < 0.5 ? 1 : 0;
  },

  zikzak: (c, G) => mod(fl((c.V + tri(c.U / (G.tp.stripeW * 1.2)) * G.tp.bandH) / G.tp.bandH), 2),

  sevron: (c, G) => {
    const lateral = G.cat === "shoes" || G.cat === "pants" ? Math.abs(c.U) : Math.abs(c.x);
    return mod(fl((c.V - lateral * 0.75) / (G.tp.bandH * 1.2)), 2);
  },

  benek: (c, G) => {
    const s = G.tp.dot;
    const row = fl(c.V / s);
    const off = row % 2 ? s / 2 : 0;
    const du = mod(c.U + off + s / 2, s) - s / 2;
    const dv = mod(c.V, s) - s / 2;
    return Math.hypot(du, dv) < s * 0.3 ? 1 : 0;
  },

  dalga: (c, G) => mod(fl((c.V + Math.sin((c.U * 2 * Math.PI) / (G.tp.stripeW * 3)) * G.tp.bandH * 0.45) / G.tp.bandH), 2),

  kisa_girdap: (c, G) => swirl(c, G, 3, 1.1),
  uzun_girdap: (c, G) => swirl(c, G, 4, 2.4),

  kose: (c, G) => {
    switch (G.cat) {
      case "top":
        if (Math.abs(c.x) > 1.8 && c.V < 3.9) return c.x < 0 ? 1 : 2;
        if (Math.abs(c.x) > 1.8 && c.V > 9.1 && c.V < 13.5) return c.x < 0 ? 3 : 4;
        return 0;
      case "pants": {
        const outer = c.x < 0 ? c.x < -2.1 : c.x > 2.1;
        if (c.y > 8.6 && outer) return c.x < 0 ? 1 : 2;
        if (c.y < 3.0) return c.x < 0 ? 3 : 4;
        return 0;
      }
      case "hat":
        if (c.V <= 2.0) return 0;
        return [3, 1, 2, 4][quarter(c)];
      case "shoes":
        if (c.y < 0.75) return 0;
        if (c.z < -0.9) return c.x < 0 ? 1 : 3;
        if (c.z > 1.0) return c.x < 0 ? 2 : 4;
        return 0;
    }
    return 0;
  },

  yamali: (c, G) => {
    const [w, h] = G.tp.patch;
    const j = fl(c.V / h);
    const i = fl((c.U + (j % 2 ? w / 2 : 0)) / w + 50);
    return mod(i + 2 * j + (mod(i * 7 + j * 3, 5) === 0 ? 3 : 0), 6);
  },

  mozaik: (c, G) => {
    const s = G.tp.mosaic;
    const i = fl(c.U / s + 50), j = fl(c.V / s);
    const fu = mod(c.U / s, 1), fv = mod(c.V / s, 1);
    const t = (i + j) % 2 ? (fu > fv ? 1 : 0) : (fu + fv > 1 ? 1 : 0);
    return mod(3 * i + 5 * j + 4 * t, 8);
  },

  on_alti: (c, G) => {
    const col = quarter(c);
    let row = Math.max(0, Math.min(3, fl(c.vn * 4)));
    if (G.cat === "hat" && c.chart === "up") row = 0;
    if (G.cat === "shoes") row = Math.max(0, Math.min(3, fl((1 - c.y / 3.95) * 4)));
    return row * 4 + col;
  },
};

// Kenar parçalarının (trim) rengi: bölge numarası ya da -1 (yerinde kalan desen).
export const TEMPLATE_ACCENT = {
  duz: -1, ust_alt: -1, on_arka: -1, sag_sol: -1, capraz: -1, on_alti: -1, kenarlik: 1,
};
export const accentOf = (id) => TEMPLATE_ACCENT[id] ?? 0;
