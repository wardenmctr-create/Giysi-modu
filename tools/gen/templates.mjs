// 25 ortak renk şablonunun bölge fonksiyonları.
// ctx: { face, p:[x,y,z], fu, fv (yüz içi 0..1), xn, yn, zn (giysi kutusu içi 0..1, yn=0 üst),
//        h (yüz yatay ekseni, birim), y, around (gövde çevresi 0..1), edge (yüz kenarına uzaklık, birim) }
// Dönüş: 0 tabanlı bölge numarası.

const fl = Math.floor;
const mod = (a, n) => ((a % n) + n) % n;
const hash = (a, b, c) => {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
};
const FACE_ID = { north: 0, south: 1, east: 2, west: 3, up: 4, down: 5 };

function swirl(c, arms, tight) {
  const du = c.fu - 0.5;
  const dv = c.fv - 0.5;
  const r = Math.hypot(du, dv);
  const th = Math.atan2(dv, du) / (2 * Math.PI) + 0.5;
  return mod(fl(th * arms + r * tight), arms);
}

export const TEMPLATE_FN = {
  duz: () => 0,
  ust_alt: (c) => (c.yn < 0.5 ? 0 : 1),
  on_arka: (c) => {
    if (c.face === "north") return 0;
    if (c.face === "south") return 1;
    return c.zn < 0.5 ? 0 : 1;
  },
  sag_sol: (c) => (c.xn < 0.5 ? 0 : 1),
  kenarlik: (c) => (c.edge < 0.75 ? 1 : 0),
  orta_serit: (c) => (Math.abs(c.yn - 0.5) < 0.17 ? 1 : 0),
  ikili_dikey: (c) => mod(fl(c.h / 1.5), 2),
  uclu_dikey: (c) => mod(fl(c.h / 1.5), 3),
  ikili_yatay: (c) => mod(fl(c.y / 1.5), 2),
  uclu_yatay: (c) => mod(fl(c.y / 1.5), 3),
  capraz: (c) => (c.fu + c.fv < 1 ? 0 : 1),
  cift_capraz: (c) => (Math.abs(c.fu - c.fv) < 0.18 || Math.abs(c.fu + c.fv - 1) < 0.18 ? 1 : 0),
  dama: (c) => mod(fl(c.h / 1.5) + fl(c.y / 1.5), 2),
  dort_dama: (c) => mod(fl(c.h / 1.5), 2) + 2 * mod(fl(c.y / 1.5), 2),
  baklava: (c) => (Math.abs(mod(c.h, 4) - 2) + Math.abs(mod(c.y, 4) - 2) < 1.5 ? 1 : 0),
  zikzak: (c) => mod(fl((c.y + Math.abs(mod(c.h, 3) - 1.5)) / 1.5), 2),
  sevron: (c) => mod(fl((c.y + Math.abs(c.p[0]) * 0.9) / 2), 2),
  benek: (c) => (Math.hypot(mod(c.h, 3) - 1.5, mod(c.y, 3) - 1.5) < 0.8 ? 1 : 0),
  dalga: (c) => mod(fl((c.y + Math.sin((c.h * Math.PI) / 2.5) * 0.9) / 1.5), 2),
  kisa_girdap: (c) => swirl(c, 3, 2),
  uzun_girdap: (c) => swirl(c, 4, 5),
  kose: (c) => {
    const k = 0.34;
    if (c.fu < k && c.fv < k) return 1;
    if (c.fu > 1 - k && c.fv < k) return 2;
    if (c.fu < k && c.fv > 1 - k) return 3;
    if (c.fu > 1 - k && c.fv > 1 - k) return 4;
    return 0;
  },
  yamali: (c) => hash(fl(c.h / 2.5) + 50, fl(c.y / 2.5) + 50, FACE_ID[c.face]) % 6,
  mozaik: (c) => hash(fl(c.h / 1.5) + 99, fl(c.y / 1.5) + 99, FACE_ID[c.face] + 7) % 8,
  on_alti: (c) => {
    const col = Math.min(3, fl(c.around * 4));
    const row = c.face === "up" ? 0 : c.face === "down" ? 3 : Math.min(3, fl(c.yn * 4));
    return row * 4 + col;
  },
};
