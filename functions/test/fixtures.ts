import type { GeneratedItinerary } from "../src/itinerarySchemas";

type Activity = GeneratedItinerary["stops"][number]["days"][number]["activities"][number];

let idSeq = 0;

export function activity(partial: Partial<Activity> & { name: string }): Activity {
  idSeq += 1;
  return {
    id: partial.id ?? `act-${idSeq}`,
    category: "attraction",
    description: "",
    time: "09:00 AM - 10:00 AM",
    image: "",
    transport: [{ mode: "walk", time: "5 min" }],
    ...partial,
  };
}

// Build a hub itinerary with the given days of activities.
export function itinerary(
  days: Activity[][],
  opts: { location?: string; destinationName?: string } = {}
): GeneratedItinerary {
  const location = opts.location ?? "Portland, Oregon";
  return {
    id: "itin-test",
    title: "Test Trip",
    subtitle: "Sub",
    destinationId: "dest-test",
    destinationName: opts.destinationName ?? location,
    heroImage: "",
    source: "ai_generated",
    tripType: "hub",
    stops: [
      {
        stopIndex: 0,
        location,
        overnightAnchor: { location, overnightType: "unknown" },
        days: days.map((acts, i) => ({
          label: `Day ${i + 1}`,
          title: `Day ${i + 1}`,
          activities: acts,
        })),
      },
    ],
  };
}

// Build a coordinate at a tiny offset (km-ish) from a base, for distance tests.
export function coordsAt(lat: number, lng: number) {
  return { latitude: lat, longitude: lng };
}
