// Shared "is this venue worth putting on an itinerary?" filter.
//
// Google Places will happily return a Dollar General, a gas station, or a bank as
// the nearest "point of interest" when a small town has few real attractions. Those
// must never surface as an activity. We reject any venue whose Google `types` are
// dominated by errand/retail/utility categories — UNLESS it also carries a genuine
// experience type (a museum gift shop is still a museum; a market is still a market).

// Types that, on their own, mean "this is an errand, not an experience."
const JUNK_TYPES = new Set<string>([
  "convenience_store", "grocery_store", "supermarket", "gas_station",
  "department_store", "discount_store", "variety_store", "warehouse_store",
  "wholesaler", "drugstore", "pharmacy", "hardware_store", "home_improvement_store",
  "home_goods_store", "furniture_store", "clothing_store", "shoe_store",
  "electronics_store", "cell_phone_store", "liquor_store", "auto_parts_store",
  "car_dealer", "car_repair", "car_wash", "car_rental", "gym", "fitness_center",
  "bank", "atm", "finance", "accounting", "insurance_agency", "real_estate_agency",
  "parking", "storage", "post_office", "moving_company", "plumber", "electrician",
  "laundry", "lodging", "hotel", "motel", "rv_park", "gas_station",
]);

// Types that redeem an otherwise-junk venue — a real reason to stop and experience it.
const EXPERIENCE_TYPES = new Set<string>([
  "tourist_attraction", "museum", "art_gallery", "historical_landmark", "monument",
  "park", "national_park", "state_park", "botanical_garden", "beach", "garden",
  "market", "restaurant", "cafe", "bakery", "bar", "night_club", "winery", "brewery",
  "performing_arts_theater", "movie_theater", "aquarium", "zoo", "amusement_park",
  "hindu_temple", "church", "mosque", "synagogue", "place_of_worship", "casino",
  "spa", "scenic_spot", "hiking_area", "campground", "marina", "stadium",
]);

/**
 * True when a venue is an errand/retail/utility stop with no redeeming experience
 * type — i.e. something we should never recommend as an activity.
 */
export function isJunkVenue(types: string[] | undefined): boolean {
  if (!types || types.length === 0) return false;
  const hasJunk = types.some((t) => JUNK_TYPES.has(t));
  if (!hasJunk) return false;
  const hasExperience = types.some((t) => EXPERIENCE_TYPES.has(t));
  return !hasExperience;
}
