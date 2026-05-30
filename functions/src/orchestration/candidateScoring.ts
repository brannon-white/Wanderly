import { type PlaceCandidate, type StopCandidatePool } from "./types";
import { type TasteProfile } from "../itinerarySchemas";

function baseScore(p: PlaceCandidate): number {
  return (p.rating / 5) * Math.log1p(p.reviewCount / 100);
}

function scoreNightlife(p: PlaceCandidate, nightlife: number): number {
  return baseScore(p) * (0.4 + 0.6 * nightlife);
}

function scoreScenic(p: PlaceCandidate, nature: number, adventure: number): number {
  return baseScore(p) * (0.3 + 0.7 * (nature * 0.6 + adventure * 0.4));
}

function scoreFood(p: PlaceCandidate, foodie: number): number {
  const editorial = p.editorialSummary ? 1.3 : 1.0;
  return baseScore(p) * editorial * (0.5 + 0.5 * foodie);
}

function scoreAttraction(p: PlaceCandidate, hiddenGems: number): number {
  // hidden gems preference: penalise very high review counts (overtouristed)
  const crowdPenalty = hiddenGems > 0.6 && p.reviewCount > 5000 ? 0.8 : 1.0;
  const gemBoost = hiddenGems > 0.6 && p.reviewCount < 500 && p.rating >= 4.3 ? 1.2 : 1.0;
  return baseScore(p) * crowdPenalty * gemBoost;
}

function applyLuxuryModifier(p: PlaceCandidate, luxury: number): number {
  if (p.priceLevel === 0) return 1.0;
  if (p.priceLevel >= 3) return luxury > 0.6 ? 1.2 : luxury < 0.3 ? 0.6 : 1.0;
  if (p.priceLevel <= 1) return luxury > 0.7 ? 0.8 : 1.0;
  return 1.0;
}

function rank<T extends PlaceCandidate>(candidates: T[], scorer: (p: T) => number): T[] {
  return [...candidates].sort((a, b) => scorer(b) - scorer(a));
}

function trim(candidates: PlaceCandidate[], count: number): PlaceCandidate[] {
  return candidates.slice(0, Math.max(4, count));
}

export function scoreCandidatePool(
  pool: StopCandidatePool,
  taste: TasteProfile | undefined,
  nightCount: number,
): StopCandidatePool {
  if (!taste) return pool;

  const {
    nightlife = 0.5,
    nature = 0.5,
    adventure = 0.5,
    foodie = 0.5,
    hiddenGems = 0.5,
    luxury = 0.5,
  } = taste;

  // Pool size scales with nightCount (same as contextBuilder) but also with taste
  const baseSize = Math.max(15, Math.min(30, 8 + nightCount * 4));

  const nightlifeSize = Math.round(baseSize * (0.3 + 0.7 * nightlife));
  const scenicSize = Math.round(baseSize * (0.4 + 0.6 * Math.max(nature, adventure)));
  const attractionSize = baseSize;

  return {
    breakfast: rank(pool.breakfast, (p) => scoreFood(p, foodie) * applyLuxuryModifier(p, luxury)),
    food: rank(pool.food, (p) => scoreFood(p, foodie) * applyLuxuryModifier(p, luxury)),
    nightlife: trim(
      rank(pool.nightlife, (p) => scoreNightlife(p, nightlife) * applyLuxuryModifier(p, luxury)),
      nightlifeSize,
    ),
    attractions: trim(
      rank(pool.attractions, (p) => scoreAttraction(p, hiddenGems) * applyLuxuryModifier(p, luxury)),
      attractionSize,
    ),
    scenic: trim(
      rank(pool.scenic, (p) => scoreScenic(p, nature, adventure)),
      scenicSize,
    ),
  };
}
