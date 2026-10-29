// Şekil yapım kiti: birçok şeklin paylaştığı geometri yardımcıları.
// Doku delikleri yerine geometrik açıklıklar kullanılır (şablon maskeleri şekiller arasında paylaşıldığı için).
import { box } from "./garment.mjs";

export const snap = (v, s = 0.25) => Math.round(v / s) * s;

// Üst kenarı eğri izleyen plaka: x0..x1 aralığı şeritlere bölünür, her şeridin tepesi curve(xc); yükseklikler
// ref'ten 0,25'lik adımlarla (ref = giysinin üst kenarı: skin katmanlarının 0,25'lik düzlemlerine denk gelmez).
// Aynı yükseklikteki komşu şeritler birleştirilir. yBase altı ana kutuda kalır.
export function curvedTop({ bone, x0, x1, yBase, curve, z0, z1, step = 0.5, ref = 0, opts = {} }) {
  const out = [];
  const n = Math.max(1, Math.round((x1 - x0) / step));
  const w = (x1 - x0) / n;
  let run = null;
  for (let k = 0; k < n; k++) {
    const a = x0 + k * w, b = a + w;
    const top = ref + snap(curve((a + b) / 2) - ref);
    if (run && Math.abs(run.top - top) < 1e-6) { run.b = b; continue; }
    if (run) out.push(run);
    run = { a, b, top };
  }
  if (run) out.push(run);
  return out.filter((r) => r.top > yBase + 0.05).map((r) => box(bone, [r.a, yBase, z0], [r.b, r.top, z1], { ...opts }));
}

// Eğri boyunca şerit (yaka bandı gibi): her şeridin üstü curve(xc), yüksekliği h.
export function curvedBand({ bone, x0, x1, curve, h, z0, z1, step = 0.5, ref = 0, opts = {} }) {
  const out = [];
  const n = Math.max(1, Math.round((x1 - x0) / step));
  const w = (x1 - x0) / n;
  let run = null;
  for (let k = 0; k < n; k++) {
    const a = x0 + k * w, b = a + w;
    const top = ref + snap(curve((a + b) / 2) - ref);
    if (run && Math.abs(run.top - top) < 1e-6) { run.b = b; continue; }
    if (run) out.push(run);
    run = { a, b, top };
  }
  if (run) out.push(run);
  return out.map((r) => box(bone, [r.a, r.top - h, z0], [r.b, r.top, z1], { ...opts }));
}

// Yuvarlak köşeli düz plaka (siperlik, şapka kenarı): x0..x1, z0..z1, köşeler r yarıçapında basamaklı.
export function roundedSlab({ bone, x0, x1, z0, z1, y0, y1, r = 1, steps = 2, opts = {} }) {
  const out = [];
  if (r <= 0 || steps <= 0) return [box(bone, [x0, y0, z0], [x1, y1, z1], opts)];
  const s = r / steps;
  // merkez gövde
  out.push(box(bone, [x0, y0, z0 + r], [x1, y1, z1 - r], opts));
  for (let k = 0; k < steps; k++) {
    // k. basamak: köşeden içeri doğru daire yaklaşımı
    const t = (k + 0.5) / steps;
    const inset = r - Math.sqrt(Math.max(0, r * r - (r - t * r) ** 2));
    const za = z0 + k * s, zb = z0 + (k + 1) * s;
    const zc = z1 - (k + 1) * s, zd = z1 - k * s;
    out.push(box(bone, [x0 + snap(inset, 0.125), y0, za], [x1 - snap(inset, 0.125), y1, zb], opts));
    out.push(box(bone, [x0 + snap(inset, 0.125), y0, zc], [x1 - snap(inset, 0.125), y1, zd], opts));
  }
  return out;
}

// Ortaya doğru incelen kademeli kule (koni, sivri şapka, boynuz): her katman bir kutu.
// levels: [{ y0, y1, hw, hd, dx, dz }] — merkez kayması (dx, dz) ile eğim/kıvrım verilir.
export function stack({ bone, cx = 0, cz = 0, levels, opts = {}, each }) {
  return levels.map((L, i) => box(bone, [cx + (L.dx ?? 0) - L.hw, L.y0, cz + (L.dz ?? 0) - L.hd], [cx + (L.dx ?? 0) + L.hw, L.y1, cz + (L.dz ?? 0) + L.hd], { ...opts, ...(each?.(i, L) ?? {}) }));
}

// Halka (bir kutunun çevresinde dört kenar): şapka bandı, bilek manşeti gibi; iç boşluk korunur.
export function ring({ bone, x0, x1, z0, z1, y0, y1, t, opts = {} }) {
  return [
    box(bone, [x0, y0, z0], [x1, y1, z0 + t], { ...opts, skip: [...(opts.skip ?? []), "south"] }),
    box(bone, [x0, y0, z1 - t], [x1, y1, z1], { ...opts, skip: [...(opts.skip ?? []), "north"] }),
    box(bone, [x0, y0, z0 + t], [x0 + t, y1, z1 - t], { ...opts, skip: [...(opts.skip ?? []), "west"] }),
    box(bone, [x1 - t, y0, z0 + t], [x1, y1, z1 - t], { ...opts, skip: [...(opts.skip ?? []), "east"] }),
  ];
}
