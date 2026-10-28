// Doğrulama kapısı için üretilen dört prototip şekil (her kategoriden bir tane).
// Koordinatlar Bedrock oyuncu modeli birimindedir (geometry.humanoid.custom).
// part.pro = zırh takılınca gizlenen çıkıntı. surface = motif yerleştirme yüzeyi.

const ARMS = {
  std: { rx: -8, lx: 4, w: 4, y: 12, pivotY: 22 },
  slim: { rx: -7, lx: 4, w: 3, y: 11.5, pivotY: 21.5 },
};

export const MOTIF_SIZE = { hat: 3, top: 4, pants: 3, shoes: 2 };

function hatBere() {
  const parts = [
    { bone: "head", origin: [-4, 29, -4], size: [8, 3, 8], inflate: 0.6 },
    { bone: "head", origin: [-4, 29, -4], size: [8, 1, 8], inflate: 0.85 },
  ];
  const d = 4.85 + 0.02;
  const surfaces = [
    { name: "Ön", bone: "head", face: "north", plane: -d, a: [-4.5, 4.5], b: [28.2, 32.6] },
    { name: "Arka", bone: "head", face: "south", plane: d, a: [-4.5, 4.5], b: [28.2, 32.6] },
    { name: "Sağ yan", bone: "head", face: "east", plane: -d, a: [-4.5, 4.5], b: [28.2, 32.6] },
    { name: "Sol yan", bone: "head", face: "west", plane: d, a: [-4.5, 4.5], b: [28.2, 32.6] },
  ];
  return { std: { parts, surfaces } };
}

function topTshirt() {
  const out = {};
  for (const [v, A] of Object.entries(ARMS)) {
    const sleeveY = A.y + 8;
    const ti = 0.35;
    const si = 0.4;
    const parts = [
      { bone: "body", origin: [-4, 12, -2], size: [8, 12, 4], inflate: ti },
      { bone: "rightArm", origin: [A.rx, sleeveY, -2], size: [A.w, 4, 4], inflate: si },
      { bone: "leftArm", origin: [A.lx, sleeveY, -2], size: [A.w, 4, 4], inflate: si },
    ];
    const tz = 2 + ti + 0.02;
    const sx = (x) => x;
    const surfaces = [
      { name: "Ön", bone: "body", face: "north", plane: -tz, a: [-4.3, 4.3], b: [11.7, 24.3] },
      { name: "Arka", bone: "body", face: "south", plane: tz, a: [-4.3, 4.3], b: [11.7, 24.3] },
      { name: "Sağ kol", bone: "rightArm", face: "east", plane: sx(A.rx - si - 0.02), a: [-2.4, 2.4], b: [sleeveY - 0.4, sleeveY + 4.4] },
      { name: "Sol kol", bone: "leftArm", face: "west", plane: sx(A.lx + A.w + si + 0.02), a: [-2.4, 2.4], b: [sleeveY - 0.4, sleeveY + 4.4] },
    ];
    out[v] = { parts, surfaces, pivotY: A.pivotY };
  }
  return out;
}

function pantsStraight() {
  const li = 0.3;
  const parts = [
    { bone: "rightLeg", origin: [-3.9, 0, -2], size: [4, 12, 4], inflate: li },
    { bone: "leftLeg", origin: [-0.1, 0, -2], size: [4, 12, 4], inflate: li },
    { bone: "body", origin: [-4, 12, -2], size: [8, 1.5, 4], inflate: 0.38 },
  ];
  const z = 2 + li + 0.02;
  const surfaces = [
    { name: "Sağ ön", bone: "rightLeg", face: "north", plane: -z, a: [-4.2, 0.4], b: [2.6, 12.3] },
    { name: "Sol ön", bone: "leftLeg", face: "north", plane: -z, a: [-0.4, 4.2], b: [2.6, 12.3] },
    { name: "Sağ arka", bone: "rightLeg", face: "south", plane: z, a: [-4.2, 0.4], b: [2.6, 12.3] },
    { name: "Sol arka", bone: "leftLeg", face: "south", plane: z, a: [-0.4, 4.2], b: [2.6, 12.3] },
  ];
  return { std: { parts, surfaces } };
}

function shoesLowSneaker() {
  const si = 0.55;
  const parts = [
    { bone: "rightLeg", origin: [-3.9, 0, -2], size: [4, 2.5, 4], inflate: si },
    { bone: "leftLeg", origin: [-0.1, 0, -2], size: [4, 2.5, 4], inflate: si },
    { bone: "rightLeg", origin: [-3.9, 0, -3], size: [4, 1.5, 1], inflate: 0.5, pro: true },
    { bone: "leftLeg", origin: [-0.1, 0, -3], size: [4, 1.5, 1], inflate: 0.5, pro: true },
  ];
  const surfaces = [
    { name: "Sağ dış yan", bone: "rightLeg", face: "east", plane: -3.9 - si - 0.02, a: [-2.5, 2.5], b: [-0.5, 3.0] },
    { name: "Sol dış yan", bone: "leftLeg", face: "west", plane: 4.1 + si + 0.02, a: [-2.5, 2.5], b: [-0.5, 3.0] },
    { name: "Sağ burun", bone: "rightLeg", face: "north", plane: -3.52, a: [-4.4, 0.6], b: [-0.5, 2.0], pro: true },
    { name: "Sol burun", bone: "leftLeg", face: "north", plane: -3.52, a: [-0.6, 4.4], b: [-0.5, 2.0], pro: true },
  ];
  // Alçak model: 1,5 birimlik yatay şeritler üç bant oluşturamıyor; bantlar giysi yüksekliğine bölünür.
  const templateOverrides = { uclu_yatay: (c) => Math.min(2, Math.floor(c.yn * 3)) };
  return { std: { parts, surfaces, templateOverrides } };
}

// Kategori → { şekil sırası (0 tabanlı): üretici }
export const PROTO_SHAPES = {
  hat: { 0: hatBere },
  top: { 0: topTshirt },
  pants: { 1: pantsStraight },
  shoes: { 0: shoesLowSneaker },
};
