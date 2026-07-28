import type { CardMeta } from "@/lib/types";

type CardsCache = { cards: CardMeta[]; total: number; offset: number };
type DefaultStyle = { slug: string; label: string; preview_url: string };
type SavedSample = { sample_id: string; label: string; sample_url: string; created_at: string };
type SamplesCache = { defaults: DefaultStyle[]; saved: SavedSample[] };

let cardsCache: CardsCache | null = null;
let samplesCache: SamplesCache | null = null;

export const dashboardCache = {
  getCards: () => cardsCache,
  setCards: (v: CardsCache) => {
    cardsCache = v;
  },
  invalidateCards: () => {
    cardsCache = null;
  },
  getSamples: () => samplesCache,
  setSamples: (v: SamplesCache) => {
    samplesCache = v;
  },
};
