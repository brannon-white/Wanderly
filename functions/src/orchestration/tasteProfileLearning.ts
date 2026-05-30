import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { FAST_MODEL_NAME } from "../constants";
import { type TasteProfile } from "../itinerarySchemas";

export interface TasteSignal {
  dimension: keyof TasteProfile;
  delta: number;
}

type LearnedAdjustments = Partial<Record<keyof TasteProfile, number>>;

const TASTE_DIMENSIONS: Array<keyof TasteProfile> = [
  "pace", "foodie", "nature", "nightlife", "hiddenGems",
  "touristTolerance", "walkingTolerance", "structurePreference", "adventure", "luxury",
];

const MAX_DRIFT = 0.25;

// Deterministic signals from optimizeDay modes — no LLM needed
export function signalsFromOptimizeMode(mode: string): TasteSignal[] {
  const map: Record<string, TasteSignal[]> = {
    relax_mode:           [{ dimension: "pace", delta: -0.08 }],
    minimize_walking:     [{ dimension: "walkingTolerance", delta: -0.08 }],
    minimize_cost:        [{ dimension: "luxury", delta: -0.08 }],
    maximize_sightseeing: [{ dimension: "touristTolerance", delta: 0.06 }, { dimension: "pace", delta: 0.04 }],
    foodie_mode:          [{ dimension: "foodie", delta: 0.08 }],
  };
  return map[mode] ?? [];
}

const SIGNAL_SCHEMA = {
  type: "object" as const,
  required: ["signals"],
  properties: {
    signals: {
      type: "array",
      items: {
        type: "object",
        required: ["dimension", "delta"],
        properties: {
          dimension: { type: "string", enum: TASTE_DIMENSIONS },
          delta: { type: "number", description: "Between -0.15 and 0.15" },
        },
      },
    },
  },
};

// Extract signals from free-text user feedback using Haiku
export async function signalsFromText(text: string): Promise<TasteSignal[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `Extract travel preference signals from this user action: "${text}"

DIMENSIONS:
- pace: low=relaxed/few activities, high=packed/many activities
- foodie: low=food is fuel, high=food is the point
- nature: low=city, high=outdoors/nature
- nightlife: low=early nights, high=out late
- hiddenGems: low=iconic attractions, high=local/off-beat spots
- touristTolerance: low=avoid tourist areas, high=ok with popular spots
- walkingTolerance: low=minimize walking, high=walk everywhere
- structurePreference: low=spontaneous, high=planned/structured
- adventure: low=culture/food focus, high=outdoor adventure
- luxury: low=budget/local, high=comfort/upscale

Return signals for any dimension clearly implied. Return [] if no clear signal.
Max 3 signals. Delta: -0.15 (strongly less) to +0.15 (strongly more).`;

  try {
    const response = await client.messages.create({
      model: FAST_MODEL_NAME,
      max_tokens: 256,
      tools: [{ name: "record_signals", description: "Record taste preference signals", input_schema: SIGNAL_SCHEMA }],
      tool_choice: { type: "tool", name: "record_signals" },
      messages: [{ role: "user", content: prompt }],
    });

    const tool = response.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") return [];

    const raw = tool.input as { signals?: Array<{ dimension: string; delta: number }> };
    return (raw.signals ?? [])
      .filter((s) => TASTE_DIMENSIONS.includes(s.dimension as keyof TasteProfile) && typeof s.delta === "number")
      .map((s) => ({ dimension: s.dimension as keyof TasteProfile, delta: Math.max(-0.15, Math.min(0.15, s.delta)) }));
  } catch {
    return [];
  }
}

// Apply signals to the user's learnedTasteAdjustments in Firestore
export async function recordSignals(uid: string, signals: TasteSignal[]): Promise<void> {
  if (signals.length === 0) return;

  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.data() ?? {};
    const baseline = (data.tasteProfile ?? {}) as Partial<TasteProfile>;
    const learned = { ...((data.learnedTasteAdjustments ?? {}) as LearnedAdjustments) };

    for (const signal of signals) {
      const current = learned[signal.dimension] ?? 0;
      const proposed = current + signal.delta;
      const baselineVal = baseline[signal.dimension] ?? 0.5;
      // Cap total drift and ensure baseline + delta stays in [0, 1]
      const maxNeg = Math.max(-MAX_DRIFT, -baselineVal);
      const maxPos = Math.min(MAX_DRIFT, 1 - baselineVal);
      learned[signal.dimension] = Math.max(maxNeg, Math.min(maxPos, proposed));
    }

    tx.update(userRef, { learnedTasteAdjustments: learned });
  });

  logger.info("tasteProfileLearning: signals recorded", { uid, signals });
}

// Blend baseline + learned adjustments into the effective profile used at generation
export function getEffectiveTasteProfile(
  baseline: TasteProfile | undefined,
  learned: LearnedAdjustments,
): TasteProfile | undefined {
  if (!baseline) return undefined;
  const result = { ...baseline };
  for (const dim of TASTE_DIMENSIONS) {
    const adj = learned[dim] ?? 0;
    result[dim] = Math.max(0, Math.min(1, baseline[dim] + adj));
  }
  return result;
}
