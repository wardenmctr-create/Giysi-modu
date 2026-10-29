// Doğrulama kapısı için ayrıntılı prototip şekiller (her kategoriden bir tane).
// Koordinatlar Bedrock oyuncu modeli birimindedir; parçalar dış ölçüleriyle verilir.
// role: şablonların giysiye oturması için anlamsal bölge. pro: zırhta gizlenir. under: üst giyilince gizlenir.
import { box, mirror } from "./garment.mjs";
import { lighting, knit, jersey, denim, canvas, rubber, stitch, segDist, gauss, gx, noise } from "./fabric.mjs";

const both = (parts) => [...parts, ...parts.map(mirror)];

// ------------------------------------------------------------------ Şapka: Bere
function hatBere() {
  const parts = [
    // Katmanlar: skin şapka katmanı 0,5 · tepe 0,7 · katlama 0,85 · kask 1,0 (aralar ≥ 0,15)
    box("head", [-4.7, 29.9, -4.7], [4.7, 32.65, 4.7], { role: "crown", skip: ["down"] }),
    box("head", [-4.2, 32.65, -4.2], [4.2, 33.15, 4.2], { role: "crown", pro: true, skip: ["down"] }),
    box("head", [-3.2, 33.15, -3.2], [3.2, 33.6, 3.2], { role: "crown", pro: true, skip: ["down"] }),
    box("head", [-4.85, 28.05, -4.85], [4.85, 30.05, 4.85], { role: "cuff" }),
  ];
  const d = 4.85, dc = 4.7;
  const surfaces = [
    { name: "Katlama ön", bone: "head", face: "north", plane: -d, a: [-4.75, 4.75], b: [28.15, 29.95] },
    { name: "Katlama arka", bone: "head", face: "south", plane: d, a: [-4.75, 4.75], b: [28.15, 29.95] },
    { name: "Katlama sağ", bone: "head", face: "east", plane: -d, a: [-4.75, 4.75], b: [28.15, 29.95] },
    { name: "Katlama sol", bone: "head", face: "west", plane: d, a: [-4.75, 4.75], b: [28.15, 29.95] },
    { name: "Tepe ön", bone: "head", face: "north", plane: -dc, a: [-4.55, 4.55], b: [30.15, 32.55] },
    { name: "Tepe arka", bone: "head", face: "south", plane: dc, a: [-4.55, 4.55], b: [30.15, 32.55] },
  ];
  const def = {
    parts, surfaces, topY: 33.6, bottomY: 28.05, motifSize: 1.6, trims: ["label"],
    tp: { stripeW: 1.5, bandH: 0.9, check: 1.3, dot: 1.6, focusV: 2.8, band: [1.5, 2.3], patch: [2.2, 1.4], mosaic: 1.2 },
    zones(c) {
      if (c.role === "cuff" && c.face === "north" && Math.abs(c.x) < 0.95 && c.y > 28.6 && c.y < 29.5) c.role = "label";
    },
    shade(c) {
      let s = lighting(c);
      if (c.role === "label") {
        s = c.edge * 2 < 1 ? -0.28 : 0.2;
        if (Math.abs(c.y - 29.05) < 0.12 && Math.abs(c.x) < 0.6) s = -0.2;
        return s;
      }
      if (c.role === "cuff") {
        s += knit(c, true);
        if (c.face !== "up" && c.face !== "down") {
          if (c.j === 0) s += 0.18;
          if (c.j === c.h - 1) s -= 0.14;
        }
        if (c.face === "up") s -= 0.14;
      } else {
        s += knit(c, false);
        if (c.face !== "up" && c.face !== "down" && c.y < 30.75) s -= 0.16 * Math.max(0, 1 - (c.y - 30.05) / 0.7);
        if (c.face === "up") s -= 0.06 * Math.min(1, Math.hypot(c.x, c.z) / 4.6);
        if (c.y > 32.4 && c.face !== "up") s += 0.06;
        if (c.y > 33.15 && c.face !== "up") s += 0.04;
      }
      return s;
    },
    detail: () => null,
  };
  return { std: def };
}

// ------------------------------------------------------------------ Üst: Kısa kollu tişört
function topTshirt() {
  const out = {};
  const ARMS = { std: { x: -8, top: 24, pivotY: 22 }, slim: { x: -7, top: 23.5, pivotY: 21.5 } };
  for (const [v, A] of Object.entries(ARMS)) {
    // Katmanlar: skin ceket/kol katmanı 0,25 · gövde 0,375 · kol 0,4 · dizlik kemeri 0,5 · etek bandı 0,525 · manşet 0,55 · göğüslük 1,0.
    // Kol, gövdenin dış yüzünde (x = ±4,375) biter; gövdeyle üst üste binmediği için ince kalabilir.
    // Etek bandı dizlik kemerine değeceği için dizlik takılınca gizlenir. Motifler kemer hizasının (y 15,5) üstünde kalır.
    const sTop = A.top + 0.4;
    const sBot = A.top - 4.0;
    const parts = [
      box("body", [-4.375, 11.625, -2.375], [4.375, 24.375, 2.375], { role: "body", skip: ["down"] }),
      box("body", [-4.525, 11.475, -2.525], [4.525, 12.475, 2.525], { role: "hem", hideArmor: ["p"], skip: ["up"] }),
      ...both([
        box("rightArm", [A.x - 0.4, sBot, -2.4], [-4.375, sTop, 2.4], { role: "sleeve", skip: ["down", "west"] }),
        box("rightArm", [A.x - 0.55, sBot - 0.45, -2.55], [-4.375, sBot + 0.45, 2.55], { role: "cuff", skip: ["up", "west"] }),
      ]),
    ];
    const neckDepth = (face) => (face === "north" ? 1.7 : 0.55);
    const neckCurve = (x, face) => 24.375 - neckDepth(face) * (1 - (x / 2.35) ** 2);
    const surfaces = [
      { name: "Ön", bone: "body", face: "north", plane: -2.375, a: [-3.3, 3.3], b: [15.7, 22.5] },
      { name: "Arka", bone: "body", face: "south", plane: 2.375, a: [-3.3, 3.3], b: [15.7, 23.7] },
      { name: "Sağ kol", bone: "rightArm", face: "east", plane: A.x - 0.4, a: [-2.3, 2.3], b: [sBot + 0.55, sTop - 0.1] },
      { name: "Sol kol", bone: "leftArm", face: "west", plane: -A.x + 0.4, a: [-2.3, 2.3], b: [sBot + 0.55, sTop - 0.1] },
    ];
    // Oyun içi çizim hücreleri: gövde önü ve arkası, 1 birim (skin pikseli) çözünürlük.
    const drawCells = [];
    for (const face of ["north", "south"]) {
      for (let row = 0; row < 12; row++) for (let col = 0; col < 8; col++) {
        const x0 = face === "north" ? -4 + col : 3 - col;
        const y0 = 23 - row;
        const cx = x0 + 0.5, cy = y0 + 0.5;
        if (Math.abs(cx) < 2.35 && cy > neckCurve(cx, face)) continue;
        drawCells.push({ bone: "body", face, plane: face === "north" ? -2.375 - 0.04 : 2.375 + 0.04, x0, x1: x0 + 1, y0, y1: y0 + 1, row, col });
      }
    }
    out[v] = {
      parts, surfaces, drawCells, topY: 24.375, bottomY: 11.475, pivotY: A.pivotY, slim: v === "slim", motifSize: 4.4,
      trims: ["collar", "cuff", "hem"],
      tp: { stripeW: 1.5, bandH: 1.6, check: 2.0, dot: 2.2, focusV: 5.6, band: [3.6, 5.6], patch: [2.4, 2.2], mosaic: 1.9 },
      zones(c) {
        if (c.role !== "body") return;
        if (c.face === "north" || c.face === "south") {
          if (Math.abs(c.x) < 2.35) {
            const cy = neckCurve(c.x, c.face);
            if (c.y > cy) c.hole = true;
            else if (c.y > cy - 0.55) c.role = "collar";
            c.neckDist = cy - 0.55 - c.y;
          }
        }
        if (c.face === "up" && Math.abs(c.x) < 2.35) c.hole = true;
      },
      shade(c) {
        let s = lighting(c) + jersey(c);
        const ax = Math.abs(c.x);
        if (c.role === "collar") return s + (gx(c) % 2 ? -0.11 : 0.06) + (c.edge * 2 < 1 ? -0.06 : 0);
        if (c.role === "cuff" || c.role === "hem") {
          if (c.face !== "up" && c.face !== "down") {
            if (c.j === 0) s -= 0.1;
            if (c.j === 1) s += stitch(true, c.U * 2, -0.22);
            if (c.j === c.h - 1) s += 0.05;
          }
          return s;
        }
        if (c.role === "sleeve") {
          const fromTorso = ax - 4.375;
          if (fromTorso < 0.45) s -= 0.15 * (1 - fromTorso / 0.45);
          if (c.face === "north" || c.face === "south") s -= 0.09 * gauss(segDist(ax, c.y, 5.0, sTop - 0.6, 7.4, sBot + 1.4), 0.3);
          if (c.y < sBot + 0.9 && c.face !== "up") s -= 0.06;
          if (c.face === "up") s += stitch(Math.abs(c.z) < 0.25, ax * 2, -0.14);
          return s;
        }
        // gövde
        if (c.neckDist !== undefined && c.neckDist >= 0 && c.neckDist < 0.5) s -= 0.13 * (1 - c.neckDist / 0.5);
        if (c.face === "north") {
          s -= 0.11 * gauss(segDist(ax, c.y, 4.0, 21.2, 1.3, 16.2), 0.32);
          s += 0.05 * gauss(segDist(ax, c.y, 3.6, 21.6, 1.0, 16.6), 0.28);
          s += 0.06 * gauss(Math.hypot(ax - 2.0, c.y - 20.4), 1.4);
        }
        if (c.face === "south") {
          s -= 0.05 * gauss(c.x, 0.45) * (c.y > 15 && c.y < 22 ? 1 : 0);
          s += 0.05 * gauss(Math.hypot(ax - 2.2, c.y - 21.0), 1.3);
        }
        if (c.face !== "up" && c.face !== "down") {
          const sideF = c.face === "east" || c.face === "west" ? 1 : Math.max(0, (ax - 2.8) / 1.5);
          s -= 0.08 * sideF * (gauss(c.y - 13.5, 0.16) + gauss(c.y - 14.7, 0.16));
          if (c.y < 12.875) s -= 0.12 * Math.max(0, 1 - (c.y - 12.475) / 0.4);
          if (ax > 3.95 && c.y > 20.2) s -= 0.07;
        }
        if (c.face === "up") s += stitch(Math.abs(c.z) < 0.25 && ax > 3.9, ax * 2, -0.14);
        return s;
      },
      detail: () => null,
    };
  }
  return out;
}

// ------------------------------------------------------------------ Pantolon: Düz paça (kot)
function pantsStraight() {
  // Katmanlar: skin pantolon katmanı 0,25 · bacak 0,375 · dizlik zırh 0,5 (aralar 0,125).
  // Paça, arka cep, bel ve kemer köprüleri dizliğe değeceği için dizlik takılınca gizlenir;
  // bel ve köprüler üst giyilince de gizlenir. Sağ ve sol bacak ortada birbirine binmez.
  const loops = [];
  for (const x of [-2.8, 2.8]) loops.push(box("body", [x - 0.22, 11.75, -2.62], [x + 0.22, 13.3, -2.5], { role: "loop", under: true, pro: true, skip: ["south"] }));
  for (const x of [-2.2, 0, 2.2]) loops.push(box("body", [x - 0.22, 11.75, 2.5], [x + 0.22, 13.3, 2.62], { role: "loop", under: true, pro: true, skip: ["north"] }));
  const parts = [
    ...both([
      box("rightLeg", [-4.275, 0.0, -2.375], [0.0, 12.0, 2.375], { role: "leg", skip: ["up", "down"] }),
      box("rightLeg", [-4.425, -0.1, -2.525], [-0.1, 0.9, 2.525], { role: "hem", pro: true, skip: ["up", "down"] }),
      box("rightLeg", [-3.5, 7.6, 2.375], [-0.8, 10.6, 2.5], { role: "pocket", pro: true, skip: ["north", "down"] }),
    ]),
    box("body", [-4.5, 11.5, -2.5], [4.5, 13.4, 2.5], { role: "waist", under: true, pro: true, skip: ["up", "down"] }),
    ...loops,
  ];
  const lz = 2.375;
  const surfaces = [
    { name: "Sağ uyluk", bone: "rightLeg", face: "north", plane: -lz, a: [-4.1, -0.2], b: [4.2, 11.3] },
    { name: "Sol uyluk", bone: "leftLeg", face: "north", plane: -lz, a: [0.2, 4.1], b: [4.2, 11.3] },
    { name: "Sağ arka", bone: "rightLeg", face: "south", plane: lz, a: [-4.1, -0.2], b: [4.2, 7.4] },
    { name: "Sol arka", bone: "leftLeg", face: "south", plane: lz, a: [0.2, 4.1], b: [4.2, 7.4] },
  ];
  const legCx = (c) => (c.x < 0 ? -2.15 : 2.15);
  const outerX = (c) => (c.x < 0 ? -4.275 : 4.275);
  const def = {
    parts, surfaces, topY: 13.4, bottomY: 0, motifSize: 2.8, trims: ["waist", "hem", "loop"],
    tp: { stripeW: 1.2, bandH: 1.5, check: 1.6, dot: 2.0, focusV: 7.0, band: [7.2, 8.8], patch: [2.0, 2.4], mosaic: 1.7 },
    zones(c) {
      if (c.role === "leg" && c.face === "north") {
        const dx = Math.abs(c.x - outerX(c)), dy = 12.0 - c.y;
        const r = Math.sqrt((dx / 2.2) ** 2 + (dy / 2.1) ** 2);
        if (r < 1) c.role = "pocketFront";
        c.pocketArc = Math.abs(r - 1) * 2.1;
      }
      if (c.role === "pocket" && c.face === "south") {
        const cx = c.x < 0 ? -2.15 : 2.15;
        const tip = 7.6 + 0.55 * (1 - Math.abs(c.x - cx) / 1.35);
        if (c.y < tip) c.hole = true;
        c.pocketEdge = Math.min(c.y - tip, 10.6 - c.y, 1.35 - Math.abs(c.x - cx));
      }
    },
    shade(c) {
      let s = lighting(c) + denim(c);
      const lc = legCx(c);
      if (c.role === "leg" || c.role === "pocketFront") {
        if (c.face === "north") {
          s += 0.1 * gauss(c.y - 5.6, 1.2) * gauss(c.x - lc, 1.5);
          const inner = c.x < 0 ? 0 : 0;
          const dir = c.x < 0 ? -1 : 1;
          for (let k = 0; k < 3; k++) {
            const y0 = 10.9 - k * 0.55;
            s += 0.12 * gauss(segDist(c.x, c.y, inner + dir * 0.2, y0, inner + dir * 1.7, y0 - 0.4), 0.11);
          }
          if (c.x > 0) {
            const jd = c.y > 9.6 ? Math.abs(c.x - 0.75) : Math.abs(Math.hypot(c.x - 0.0, c.y - 9.6) - 0.75);
            if (c.y > 8.85 && c.y < 13 && c.x < 0.8) s += stitch(jd < 0.12, c.y * 2, 0.2);
          }
          if (Math.abs(c.x) < 0.25) s -= 0.1;
        }
        if (c.face === "south") {
          if (c.y > 4.2 && c.y < 5.9 && Math.sin((c.x - lc) * 4.5 + (c.y - 5) * 2.2) > 0.65) s -= 0.1;
          s -= 0.06 * gauss(c.y - 7.4, 0.25);
        }
        if (c.face === "east" || c.face === "west") {
          const outer = (c.x < 0 && c.face === "east") || (c.x > 0 && c.face === "west");
          const seamZ = -1.2;
          if (outer) s += stitch(Math.abs(c.z - seamZ) < 0.15 || Math.abs(c.z - seamZ - 0.4) < 0.12, c.y * 2, 0.17);
          else s -= 0.06;
        }
        if (c.y > 11.2) s -= 0.12 * (c.y - 11.2) / 0.8;
        if (c.y < 1.25) s -= 0.05;
        if (c.role === "pocketFront") {
          if (c.pocketArc < 0.18) s -= 0.26;
          else if (c.pocketArc < 0.4) s += stitch(true, c.x * 2 + c.y * 2, 0.18);
          else s -= 0.03;
        }
        return s;
      }
      if (c.role === "waist") {
        if (c.face !== "up" && c.face !== "down") {
          if (c.j === 1 || c.j === c.h - 2) s += stitch(true, c.U * 2, 0.19);
          if (c.j === 0) s += 0.08;
          if (c.j === c.h - 1) s -= 0.12;
        }
        return s;
      }
      if (c.role === "hem") {
        if (c.j === 0) s += 0.1;
        if (c.j === 1) s += stitch(true, c.U * 2, 0.18);
        return s;
      }
      if (c.role === "pocket") {
        if (c.pocketEdge !== undefined) {
          if (c.pocketEdge < 0.18) s -= 0.12;
          else if (c.pocketEdge < 0.4) s += stitch(true, c.x * 2 + c.y * 2, 0.2);
          const arc = Math.abs(c.y - (9.2 + 0.45 * Math.cos((c.x - (c.x < 0 ? -2.15 : 2.15)) * 2.2)));
          if (arc < 0.12 && c.pocketEdge > 0.4) s += 0.18;
        } else s -= 0.15;
        return s;
      }
      if (c.role === "loop") return s - 0.04 + (c.j === 0 || c.j === c.h - 1 ? -0.14 : 0.05);
      return s;
    },
    detail(c) {
      if (c.role === "waist" && c.face === "north" && Math.abs(c.x) < 0.5 && c.y > 12.15 && c.y < 13.0) {
        return Math.abs(c.x) < 0.25 && c.y > 12.35 && c.y < 12.8 ? 0xe2bf5a : 0x9a7a2c;
      }
      if (c.role === "pocketFront" && c.pocketArc < 0.5 && c.y > 11.55) return 0xb87333;
      if (c.role === "waist" && c.face === "south" && c.x > -3.3 && c.x < -1.7 && c.y > 12.25 && c.y < 13.2) {
        return c.edge * 2 < 1 || c.x < -3.1 || c.x > -1.9 ? 0x5c3a1a : 0x8b5a2b;
      }
      return null;
    },
  };
  return { std: def };
}

// ------------------------------------------------------------------ Ayakkabı: Alçak spor
function shoesLowSneaker() {
  // Katmanlar: dizlik 0,5 · ayakkabı üstü 0,7 · taban/bilek 0,85 · çizme 1,0 (aralar ≥ 0,15).
  // Sağ ve sol ayakkabı ortada 0,1 aralıkla ayrılır; taban yerin biraz altına iner.
  // Burun, bağcık ve topuk çizmeye değeceği için çizme takılınca gizlenir.
  const parts = both([
    box("rightLeg", [-4.75, -0.15, -2.85], [-0.05, 0.75, 2.85], { role: "sole" }),
    box("rightLeg", [-4.6, 0.75, -2.7], [-0.05, 3.0, 2.7], { role: "upper", skip: ["down"] }),
    box("rightLeg", [-4.75, 2.95, -1.6], [-0.2, 3.6, 2.85], { role: "collar", skip: ["down"] }),
    box("rightLeg", [-3.15, 2.2, -2.85], [-1.05, 3.95, -2.7], { role: "tongue", skip: ["south"] }),
    box("rightLeg", [-4.6, 0.75, -3.4], [-0.05, 2.0, -2.7], { role: "toe", pro: true, skip: ["south", "down"] }),
    box("rightLeg", [-4.75, -0.15, -3.55], [-0.05, 0.75, -2.85], { role: "sole", pro: true, skip: ["south"] }),
    box("rightLeg", [-3.05, 2.3, -3.0], [-1.15, 2.56, -2.85], { role: "laces", pro: true, skip: ["south"] }),
    box("rightLeg", [-3.05, 2.85, -3.0], [-1.15, 3.11, -2.85], { role: "laces", pro: true, skip: ["south"] }),
    box("rightLeg", [-3.05, 3.4, -3.0], [-1.15, 3.66, -2.85], { role: "laces", pro: true, skip: ["south"] }),
    box("rightLeg", [-2.6, 2.6, 2.85], [-1.2, 3.95, 3.0], { role: "heel", pro: true, skip: ["north"] }),
  ]);
  const surfaces = [
    { name: "Sağ dış yan", bone: "rightLeg", face: "east", plane: -4.6, a: [-2.5, 2.5], b: [0.85, 2.85] },
    { name: "Sol dış yan", bone: "leftLeg", face: "west", plane: 4.6, a: [-2.5, 2.5], b: [0.85, 2.85] },
    { name: "Sağ burun", bone: "rightLeg", face: "north", plane: -3.4, a: [-4.45, -0.2], b: [0.85, 1.9], pro: true },
    { name: "Sol burun", bone: "leftLeg", face: "north", plane: -3.4, a: [0.2, 4.45], b: [0.85, 1.9], pro: true },
    { name: "Sağ topuk", bone: "rightLeg", face: "south", plane: 2.7, a: [-4.45, -0.2], b: [0.85, 2.5] },
    { name: "Sol topuk", bone: "leftLeg", face: "south", plane: 2.7, a: [0.2, 4.45], b: [0.85, 2.5] },
  ];
  const def = {
    parts, surfaces, topY: 3.95, bottomY: -0.15, motifSize: 1.6, trims: ["sole", "collar", "laces", "tongue", "heel"],
    tp: { stripeW: 1.0, bandH: 0.6, check: 0.9, dot: 1.1, focusV: 1.9, band: "stripe", patch: [1.4, 1.0], mosaic: 1.1 },
    zones(c) {
      if (c.role === "upper" && (c.face === "east" || c.face === "west")) {
        const t = (c.z + 2.7) / 5.4;
        const yc = 1.15 + 1.1 * t;
        const half = 0.16 + 0.22 * Math.max(0, 1 - Math.abs(t - 0.55) / 0.55);
        if (Math.abs(c.y - yc) < half && t > 0.1 && t < 0.93) {
          c.role = "stripe";
          c.stripeEdge = half - Math.abs(c.y - yc);
        }
      }
    },
    shade(c) {
      let s = lighting(c);
      switch (c.role) {
        case "sole":
          s += rubber(c);
          if (c.face !== "up" && c.face !== "down") {
            if (c.y > 0.5 && c.y < 0.62) s -= 0.2;
            if (c.y < 0.2) s -= 0.12;
            if (c.y > 0.62) s += 0.05;
          }
          return s;
        case "upper":
        case "toe":
        case "stripe":
          s += canvas(c);
          if (c.y < 1.1 && c.face !== "up") s -= 0.15 * (1 - (c.y - 0.75) / 0.35);
          if (c.role === "toe") {
            if (c.face === "up") s += 0.06;
            if (c.face === "north" && c.y > 1.75) s -= 0.08;
            if (c.face !== "north" && c.z > -2.9) s += stitch(true, c.y * 2, -0.18);
          }
          if (c.role === "stripe") s += c.stripeEdge < 0.1 ? -0.16 : 0.04;
          if ((c.face === "east" || c.face === "west") && c.z < -1.2 && c.y > 1.5 && c.y < 2.1 && Math.sin(c.z * 9) > 0.7) s -= 0.1;
          if (c.face === "north" && c.y > 2.1) s -= 0.1;
          return s;
        case "collar":
          s += canvas(c);
          if (c.face === "up") return s - 0.25 + (noise(c.x * 3, c.z * 3, 2) - 0.5) * 0.05;
          if (c.j === 0) s += 0.13;
          if (c.j === Math.floor(c.h / 2)) s -= 0.1;
          return s;
        case "tongue":
          return s + canvas(c) + (c.j === 0 ? 0.12 : 0) + (c.edge * 2 < 1 ? -0.1 : 0);
        case "laces":
          return s + (c.i % 2 ? -0.09 : 0.07);
        case "heel":
          return s + 0.04 + (c.edge * 2 < 1 ? -0.14 : 0) + stitch(c.edge < 0.5 && c.edge > 0.2, c.y * 2, -0.15);
      }
      return s;
    },
    detail(c) {
      if (c.role === "laces" && c.face === "north" && (c.i === 0 || c.i === c.w - 1)) return 0x9a9a9a;
      return null;
    },
  };
  return { std: def };
}

// Kategori → { şekil sırası (0 tabanlı): üretici }
export const PROTO_SHAPES = {
  hat: { 0: hatBere },
  top: { 0: topTshirt },
  pants: { 1: pantsStraight },
  shoes: { 0: shoesLowSneaker },
};
