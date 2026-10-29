// Motif yüzey yuvaları: kategori başına sabit (kemik + yüz yönü). Her şeklin yüzeyleri bu yuvalardan birine
// oturur; motif kemiği ve konum animasyonu yuvaya göredir, yüzey ölçüleri şekle göre script tarafından uygulanır.
export const SLOTS = {
  hat: [
    { bone: "head", face: "north", name: "ön (alt)" },
    { bone: "head", face: "south", name: "arka (alt)" },
    { bone: "head", face: "east", name: "sağ" },
    { bone: "head", face: "west", name: "sol" },
    { bone: "head", face: "north", name: "ön (üst)" },
    { bone: "head", face: "south", name: "arka (üst)" },
  ],
  top: [
    { bone: "body", face: "north", name: "ön" },
    { bone: "body", face: "south", name: "arka" },
    { bone: "rightArm", face: "east", name: "sağ kol" },
    { bone: "leftArm", face: "west", name: "sol kol" },
    { bone: "rightLeg", face: "north", name: "etek ön sağ" },
    { bone: "leftLeg", face: "north", name: "etek ön sol" },
    { bone: "rightLeg", face: "south", name: "etek arka sağ" },
    { bone: "leftLeg", face: "south", name: "etek arka sol" },
    { bone: "gm_cape", face: "south", name: "pelerin" },
  ],
  pants: [
    { bone: "rightLeg", face: "north", name: "sağ ön" },
    { bone: "leftLeg", face: "north", name: "sol ön" },
    { bone: "rightLeg", face: "south", name: "sağ arka" },
    { bone: "leftLeg", face: "south", name: "sol arka" },
    { bone: "rightLeg", face: "east", name: "sağ yan" },
    { bone: "leftLeg", face: "west", name: "sol yan" },
    { bone: "body", face: "north", name: "göğüs" },
  ],
  shoes: [
    { bone: "rightLeg", face: "east", name: "sağ dış yan" },
    { bone: "leftLeg", face: "west", name: "sol dış yan" },
    { bone: "rightLeg", face: "north", name: "sağ ön" },
    { bone: "leftLeg", face: "north", name: "sol ön" },
    { bone: "rightLeg", face: "south", name: "sağ arka" },
    { bone: "leftLeg", face: "south", name: "sol arka" },
  ],
};

export function checkSurfaces(cat, surfaces) {
  const errs = [];
  const used = new Set();
  for (const s of surfaces) {
    const slot = SLOTS[cat][s.slot];
    if (!slot) { errs.push(`${s.name}: geçersiz yuva ${s.slot}`); continue; }
    if (slot.bone !== s.bone || slot.face !== s.face) errs.push(`${s.name}: yuva ${s.slot} ${slot.bone}/${slot.face} bekliyor, ${s.bone}/${s.face} verildi`);
    if (used.has(s.slot)) errs.push(`${s.name}: yuva ${s.slot} iki kez kullanıldı`);
    used.add(s.slot);
  }
  return errs;
}
