import { type PlaceCandidate, type RankedPlace, type TripIntent } from "./types";

// Maps user interest labels to Google Places types
const INTEREST_TYPE_MAP: Record<string, string[]> = {
  food: ["restaurant", "food", "bakery", "cafe", "meal_takeaway", "meal_delivery"],
  museums: ["museum"],
  art: ["art_gallery", "museum"],
  nature: ["park", "natural_feature", "campground", "national_park"],
  shopping: ["shopping_mall", "store", "clothing_store", "market", "department_store"],
  nightlife: ["bar", "night_club", "casino", "liquor_store"],
  culture: ["tourist_attraction", "church", "mosque", "hindu_temple", "synagogue", "place_of_worship", "city_hall"],
  adventure: ["amusement_park", "stadium", "bowling_alley", "gym"],
  wellness: ["spa", "gym", "beauty_salon", "health"],
  history: ["museum", "historic_site", "tourist_attraction", "local_government_office"],
  beaches: ["beach", "natural_feature"],
  architecture: ["tourist_attraction", "church", "city_hall"],
};

// Budget ranges: [minPriceLevel, maxPriceLevel]
const BUDGET_RANGE: Record<string, [number, number]> = {
  budget: [0, 1],
  moderate: [1, 3],
  luxury: [3, 4],
};

function interestMatchScore(place: PlaceCandidate, rankedInterests: string[]): number {
  let score = 0;
  for (let i = 0; i < rankedInterests.length; i++) {
    const interest = rankedInterests[i].toLowerCase();
    const matchTypes = INTEREST_TYPE_MAP[interest] ?? [interest];
    const hasMatch = place.types.some((t) =>
      matchTypes.some((mt) => t.toLowerCase().includes(mt.toLowerCase()))
    );
    if (hasMatch) {
      // Higher priority interest = higher contribution
      score += Math.max(0.1, 1 - i * 0.1);
    }
  }
  return Math.min(1, score);
}

function ratingScore(place: PlaceCandidate): number {
  if (place.rating === 0) return 0.3; // neutral when no rating data
  return Math.min(1, place.rating / 5);
}

function budgetScore(place: PlaceCandidate, budget: string): number {
  const [min, max] = BUDGET_RANGE[budget] ?? [1, 3];
  if (place.priceLevel >= min && place.priceLevel <= max) return 1;
  const overshoot = Math.max(
    Math.abs(place.priceLevel - min),
    Math.abs(place.priceLevel - max)
  );
  return Math.max(0, 1 - overshoot * 0.35);
}

function popularityScore(place: PlaceCandidate): number {
  // Normalize review count — 5000+ reviews is very popular
  return Math.min(1, place.reviewCount / 5000);
}

const TOURIST_TYPES = ["tourist_attraction", "point_of_interest"];

function isTouristHotspot(place: PlaceCandidate): boolean {
  return place.types.some((t) => TOURIST_TYPES.includes(t)) && place.reviewCount > 3000;
}

function tasteProfileMultiplier(place: PlaceCandidate, intent: TripIntent): number {
  if (!intent.tasteProfile) return 1;
  const tp = intent.tasteProfile;
  let multiplier = 1;

  // Hidden gems preference: downweight tourist hotspots
  if (isTouristHotspot(place)) {
    multiplier *= 1 - (tp.hiddenGems - 0.5) * 0.6;
  } else {
    multiplier *= 1 + (tp.hiddenGems - 0.5) * 0.4;
  }

  return Math.max(0.1, multiplier);
}

function isAvoidedCategory(place: PlaceCandidate, avoidActivities?: string[]): boolean {
  if (!avoidActivities || avoidActivities.length === 0) return false;
  const avoidLower = avoidActivities.map((a) => a.toLowerCase());
  return place.types.some((t) =>
    avoidLower.some((a) => t.toLowerCase().includes(a) || a.includes(t.toLowerCase()))
  );
}

function includeBoost(place: PlaceCandidate, includeActivities?: string[]): number {
  if (!includeActivities || includeActivities.length === 0) return 1;
  const includeLower = includeActivities.map((a) => a.toLowerCase());
  const matches = place.types.some((t) =>
    includeLower.some((a) => t.toLowerCase().includes(a) || a.includes(t.toLowerCase()))
  );
  return matches ? 1.5 : 1;
}

export function rankRecommendations(
  candidates: PlaceCandidate[],
  intent: TripIntent
): RankedPlace[] {
  return candidates
    .filter((place) => !isAvoidedCategory(place, intent.avoidActivities))
    .map((place) => {
      const interestMatch = interestMatchScore(place, intent.rankedInterests);
      const rating = ratingScore(place);
      const budget = budgetScore(place, intent.budget);
      const popularity = popularityScore(place);

      const baseScore =
        interestMatch * 0.35 +
        rating * 0.30 +
        budget * 0.20 +
        popularity * 0.15;

      const score = baseScore
        * tasteProfileMultiplier(place, intent)
        * includeBoost(place, intent.includeActivities);

      return {
        ...place,
        score,
        interestMatch,
        budgetCompatible: budget >= 0.65,
      };
    })
    .sort((a, b) => b.score - a.score);
}
