// Şekil kaydı: kategori → şekil sırası (0 tabanlı, catalog.mjs SHAPES ile aynı) → üretici.
import { hatBere, topTshirt, pantsStraight, shoesLowSneaker } from "./shapes_proto.mjs";

export const SHAPE_GEN = {
  hat: { 0: hatBere },
  top: { 0: topTshirt },
  pants: { 1: pantsStraight },
  shoes: { 0: shoesLowSneaker },
};
