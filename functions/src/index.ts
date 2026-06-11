import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { rotateFeatured } from "./featuredRotation";

const FREE_MONTHLY_GENERATION_LIMIT = 3;
const FREE_MONTHLY_REGEN_LIMIT = 3;
// Pro is capped (not unlimited) so one subscriber can't run up unbounded API cost.
const PRO_MONTHLY_GENERATION_LIMIT = 20;

// Consumable credit packs: product_id → trip credits granted. Must match
// CREDIT_PRODUCT_IDS / CREDIT_PACK_AMOUNTS in StickerSmash/types/subscription.ts.
const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  wanderly_credits_1: 1,
  wanderly_credits_5: 5,
  wanderly_credits_12: 12,
};

function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

// App Check: confirm the request came from our genuine app binary (App Attest /
// Play Integrity), not a script hitting the public HTTPS endpoint with a stolen or
// self-minted Firebase auth token. Soft by default so the backend can be deployed
// before the client ships tokens; set the APP_CHECK_ENFORCE=true env var to reject.
async function verifyAppCheck(req: { headers: Record<string, unknown> }): Promise<boolean> {
  const enforce = process.env.APP_CHECK_ENFORCE === "true";
  const header = req.headers["x-firebase-appcheck"];
  const token = Array.isArray(header) ? header[0] : (header as string | undefined);
  if (!token) {
    if (enforce) return false;
    logger.warn("App Check token missing (soft mode — allowing)");
    return true;
  }
  try {
    await getAppCheck().verifyToken(token);
    return true;
  } catch (e) {
    logger.warn("App Check token invalid", { enforce, error: String(e) });
    return !enforce;
  }
}

interface GenerationCreditState {
  uid: string;
  isNewMonth: boolean;
  nextReset: Date;
  currentUsageResetAt: Timestamp | null;
  currentRegenCount: number;
  currentRegenResetAt: Timestamp | null;
  // When true, this generation is paid for by a purchased credit, not the monthly
  // allotment — consumeGenerationCredit decrements usage.credits instead of the counter.
  useCredit: boolean;
}

// Throws LIMIT_REACHED if the user has neither monthly allotment nor credits left.
// Does NOT write — call consumeGenerationCredit only after successful generation.
async function checkGenerationCredit(uid: string): Promise<GenerationCreditState> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};

  const tier: string = data.subscription?.tier ?? "free";
  const expiresAt: Timestamp | null = data.subscription?.expiresAt ?? null;
  const isPro = tier === "pro" && expiresAt !== null && expiresAt.toDate() > new Date();
  const monthlyLimit = isPro ? PRO_MONTHLY_GENERATION_LIMIT : FREE_MONTHLY_GENERATION_LIMIT;

  const now = new Date();
  const resetAt: Date = data.usage?.usageResetAt
    ? (data.usage.usageResetAt as Timestamp).toDate()
    : new Date(0);
  const isNewMonth = resetAt <= now;
  const currentCount: number = isNewMonth ? 0 : (data.usage?.generationsThisMonth ?? 0);
  const credits: number = data.usage?.credits ?? 0;

  const base = {
    uid,
    isNewMonth,
    nextReset: getNextMonthStart(),
    currentUsageResetAt: data.usage?.usageResetAt ?? null,
    currentRegenCount: data.usage?.regenCount ?? 0,
    currentRegenResetAt: data.usage?.regenResetAt ?? null,
  };

  // Prefer the included monthly allotment; fall back to purchased credits.
  if (currentCount < monthlyLimit) {
    return { ...base, useCredit: false };
  }
  if (credits > 0) {
    return { ...base, useCredit: true };
  }

  throw Object.assign(new Error("Monthly generation limit reached"), { code: "LIMIT_REACHED" });
}

async function consumeGenerationCredit(state: GenerationCreditState): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(state.uid);
  const nextReset = Timestamp.fromDate(state.nextReset);

  // Credit-funded generation: decrement the purchased balance, leave the monthly
  // counter untouched (but still roll it over if a new month started).
  if (state.useCredit) {
    await userRef.set(
      {
        usage: {
          credits: FieldValue.increment(-1),
          totalGenerations: FieldValue.increment(1),
          ...(state.isNewMonth
            ? { generationsThisMonth: 0, usageResetAt: nextReset, regenCount: 0, regenResetAt: nextReset }
            : {}),
        },
      },
      { merge: true }
    );
    return;
  }

  await userRef.set(
    {
      usage: {
        generationsThisMonth: state.isNewMonth ? 1 : FieldValue.increment(1),
        usageResetAt: state.isNewMonth ? nextReset : (state.currentUsageResetAt ?? nextReset),
        totalGenerations: FieldValue.increment(1),
        regenCount: state.isNewMonth ? 0 : state.currentRegenCount,
        regenResetAt: state.isNewMonth ? nextReset : (state.currentRegenResetAt ?? nextReset),
      },
    },
    { merge: true }
  );
}

async function checkAndConsumeRegenCredit(uid: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};

  const tier: string = data.subscription?.tier ?? "free";
  const expiresAt: Timestamp | null = data.subscription?.expiresAt ?? null;
  const isPro = tier === "pro" && expiresAt !== null && expiresAt.toDate() > new Date();

  if (isPro) return;

  const now = new Date();
  const regenResetAt: Date = data.usage?.regenResetAt
    ? (data.usage.regenResetAt as Timestamp).toDate()
    : new Date(0);
  const isNewMonth = regenResetAt <= now;
  const currentRegens: number = isNewMonth ? 0 : (data.usage?.regenCount ?? 0);

  if (currentRegens >= FREE_MONTHLY_REGEN_LIMIT) {
    throw Object.assign(new Error("Monthly regeneration limit reached"), { code: "REGEN_LIMIT_REACHED" });
  }

  const nextReset = getNextMonthStart();
  await userRef.set(
    {
      usage: {
        regenCount: isNewMonth ? 1 : FieldValue.increment(1),
        regenResetAt: isNewMonth ? Timestamp.fromDate(nextReset) : (data.usage?.regenResetAt ?? Timestamp.fromDate(nextReset)),
      },
    },
    { merge: true }
  );
}

import Anthropic from "@anthropic-ai/sdk";
import {
  signalsFromText,
  signalsFromOptimizeMode,
  recordSignals,
  getEffectiveTasteProfile,
} from "./orchestration/tasteProfileLearning";
import {
  generateItineraryFlow,
  regenerateActivity,
  regenerateDay,
  getSuggestedReplacements,
  editItineraryWithLanguage,
  optimizeDay,
  MODEL_NAME,
  PROMPT_VERSION,
} from "./itineraryGeneration";
import { extractSeedDays, type SeedDay } from "./orchestration/tripPlanning";
import { FAST_MODEL_NAME } from "./constants";
import {
  callableGenerateItineraryResponseSchema,
  regenerateActivityRequestSchema,
  regenerateDayRequestSchema,
  getSuggestedReplacementsRequestSchema,
  confirmActivityReplacementRequestSchema,
  editItineraryWithLanguageRequestSchema,
  optimizeDayRequestSchema,
  recalculateDayTransportRequestSchema,
  suggestStopAlternativesRequestSchema,
  reworkStopRequestSchema,
  type CallableGenerateItineraryResponse,
  type GenerateItineraryRequest,
} from "./itinerarySchemas";
import { getAllDays, updateDayByIndex, type GeneratedItinerary } from "./itinerarySchemas";
import { enrichDayTransportTimes, enrichTransportTimes, enrichDriveLegs } from "./orchestration/directions";
import { reconcileItineraryPlaces, enforceVerifiedPlacesBySearch, enforceDayGeographicCohesion } from "./orchestration/placeResolution";
import { removeStop, replaceStop, suggestStopAlternatives, pruneStaleDriveDayActivities } from "./orchestration/stopRework";
import { getDestinationHero } from "./orchestration/heroImages";
import { reflagDriveDays } from "./orchestration/driveDayShaping";

initializeApp();

// Skip (rather than reject) undefined-valued fields on writes. The generation
// pipeline can legitimately leave optional fields (e.g. an activity's `cost`)
// unset, and Firestore otherwise throws on the whole document. Must run before
// any Firestore access.
getFirestore().settings({ ignoreUndefinedProperties: true });

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const googlePlacesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");
const pexelsApiKey = defineSecret("PEXELS_API_KEY");

type HttpErrorDetails = {
  status: number;
  error: string;
  details?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

function classifyHttpError(error: unknown): HttpErrorDetails {
  const maybeCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const maybeStatus =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  const message = getErrorMessage(error);

  if (
    typeof maybeCode === "string" &&
    ["auth/argument-error", "auth/id-token-expired", "auth/invalid-id-token"].includes(maybeCode)
  ) {
    return { status: 401, error: "invalid_auth_token", details: message };
  }

  if (typeof maybeCode === "string" && maybeCode === "LIMIT_REACHED") {
    return { status: 402, error: "limit_reached", details: message };
  }

  if (typeof maybeCode === "string" && maybeCode === "REGEN_LIMIT_REACHED") {
    return { status: 402, error: "regen_limit_reached", details: message };
  }

  if (typeof maybeCode === "number") {
    if (maybeCode === 429) {
      return { status: 429, error: "rate_limit_exceeded", details: message };
    }

    if (maybeCode === 400) {
      return { status: 400, error: "bad_request", details: message };
    }

    if (maybeCode === 529) {
      return { status: 503, error: "api_overloaded", details: message };
    }
  }

  if (maybeStatus === "RESOURCE_EXHAUSTED") {
    return { status: 429, error: "rate_limit_exceeded", details: message };
  }

  if (message.includes("verifyIdToken")) {
    return { status: 401, error: "invalid_auth_token", details: message };
  }

  return { status: 500, error: "generation_failed", details: message };
}

async function buildAndSaveItinerary(
  uid: string,
  input: GenerateItineraryRequest
): Promise<CallableGenerateItineraryResponse> {
  logger.info("Generating itinerary", {
    uid,
    destinationId: input.destinationId,
    destinationName: input.destinationName,
    country: input.country,
    budget: input.budget,
    party: input.party,
    interestsCount: input.interests.length,
  });

  // Blend the user's onboarding baseline with learned adjustments from past behavior
  const firestore = getFirestore();
  const userSnap = await firestore.collection("users").doc(uid).get();
  const learned = ((userSnap.data() ?? {}).learnedTasteAdjustments ?? {}) as Record<string, number>;
  const effectiveProfile = getEffectiveTasteProfile(input.tasteProfile, learned);
  const enrichedInput = effectiveProfile ? { ...input, tasteProfile: effectiveProfile } : input;

  // When seeded from a prebuilt trip, load its activities so the pipeline expands
  // them instead of planning from scratch. A missing/invalid seed degrades to a
  // normal generation rather than failing the request.
  let seedDays: SeedDay[] | undefined;
  if (input.seedItineraryId) {
    try {
      const seedSnap = await firestore.collection("prebuiltItineraries").doc(input.seedItineraryId).get();
      const days = extractSeedDays(seedSnap.exists ? (seedSnap.data() as Record<string, unknown>) : undefined);
      if (days.length > 0) {
        seedDays = days;
        logger.info("Seeding generation from prebuilt itinerary", {
          seedItineraryId: input.seedItineraryId,
          seedDayCount: days.length,
        });
      } else {
        logger.warn("Seed itinerary had no usable days — generating fresh", {
          seedItineraryId: input.seedItineraryId,
        });
      }
    } catch (error) {
      logger.warn("Failed to load seed itinerary — generating fresh", {
        seedItineraryId: input.seedItineraryId,
        error,
      });
    }
  }

  const itinerary = await generateItineraryFlow(enrichedInput, process.env.GOOGLE_PLACES_API_KEY, seedDays);
  logger.info("Itinerary generated from model", {
    uid,
    destinationId: input.destinationId,
    model: itinerary.model ?? MODEL_NAME,
    promptVersion: itinerary.promptVersion ?? PROMPT_VERSION,
    daysCount: getAllDays(itinerary).length,
  });

  const itineraryRef = firestore.collection("users").doc(uid).collection("itineraries").doc();
  const timestamp = FieldValue.serverTimestamp();

  const savedItinerary = {
    ...itinerary,
    id: itineraryRef.id,
    userId: uid,
    source: "ai_generated" as const,
    model: itinerary.model ?? MODEL_NAME,
    promptVersion: itinerary.promptVersion ?? PROMPT_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await itineraryRef.set(savedItinerary);
  logger.info("Itinerary saved to Firestore", {
    uid,
    itineraryId: itineraryRef.id,
    destinationId: input.destinationId,
  });

  // Send push notification if the user has an FCM token
  try {
    const userDoc = await getFirestore().collection("users").doc(uid).get();
    const fcmToken = userDoc.data()?.fcmToken as string | undefined;
    if (fcmToken) {
      const committedTripId = `committed-${itineraryRef.id}`;
      await getMessaging().send({
        token: fcmToken,
        notification: {
          title: "Your itinerary is ready!",
          body: `Your trip to ${input.destinationName} is all planned out. Tap to view it.`,
        },
        data: {
          itineraryId: itineraryRef.id,
          committedTripId,
          screen: "ItineraryScreen",
        },
        apns: {
          payload: { aps: { sound: "default" } },
        },
      });
      logger.info("Push notification sent", { uid, itineraryId: itineraryRef.id });
    }
  } catch (notifError) {
    logger.warn("Push notification failed (non-fatal)", { uid, error: notifError });
  }

  const response = {
    itineraryId: itineraryRef.id,
    itinerary: {
      ...savedItinerary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };

  return callableGenerateItineraryResponseSchema.parse(response);
}

export const generateItineraryV1 = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    timeoutSeconds: 300,
    secrets: [anthropicApiKey, googlePlacesApiKey, pexelsApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onCall(async (data, context): Promise<CallableGenerateItineraryResponse> => {
    const uid = context.auth?.uid;

    if (!uid) {
      throw new functionsV1.https.HttpsError(
        "unauthenticated",
        "Authentication is required."
      );
    }

    const creditState = await checkGenerationCredit(uid);
    const result = await buildAndSaveItinerary(uid, data);
    await consumeGenerationCredit(creditState);
    return result;
  });

export const generateItineraryHttp = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    // 540s is the gen-1 HTTP max. Full-trip generation can need a repair pass on
    // top of the initial Sonnet call; the pipeline self-imposes a tighter wall-clock
    // budget (REPAIR_DEADLINE_MS) so it ships best-effort well before this hard cap.
    timeoutSeconds: 540,
    secrets: [anthropicApiKey, googlePlacesApiKey, pexelsApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Firebase-AppCheck");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.status(204).send("");
      return;
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    const authHeader = req.headers.authorization ?? "";
    const match = authHeader.match(/^Bearer (.+)$/i);

    if (!match) {
      logger.warn("generateItineraryHttp missing bearer token", {
        method: req.method,
        hasAuthorizationHeader: Boolean(req.headers.authorization),
      });
      res.status(401).json({ error: "Missing bearer token." });
      return;
    }

    try {
      const decodedToken = await getAuth().verifyIdToken(match[1]);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      logger.info("generateItineraryHttp token verified", {
        uid: decodedToken.uid,
        destinationId:
          typeof req.body === "object" && req.body !== null && "destinationId" in req.body
            ? (req.body as { destinationId?: unknown }).destinationId
            : undefined,
        destinationName:
          typeof req.body === "object" && req.body !== null && "destinationName" in req.body
            ? (req.body as { destinationName?: unknown }).destinationName
            : undefined,
        country:
          typeof req.body === "object" && req.body !== null && "country" in req.body
            ? (req.body as { country?: unknown }).country
            : undefined,
      });
      const creditState = await checkGenerationCredit(decodedToken.uid);
      const result = await buildAndSaveItinerary(decodedToken.uid, req.body);
      await consumeGenerationCredit(creditState);
      res.status(200).json(result);
    } catch (error) {
      const classifiedError = classifyHttpError(error);
      logger.error("generateItineraryHttp failed", {
        ...classifiedError,
        rawError: error,
      });
      res.status(classifiedError.status).json(classifiedError);
    }
  });

// ─── Partial regeneration: single activity ───────────────────────────────────

export const regenerateActivityHttp = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    timeoutSeconds: 120,
    secrets: [anthropicApiKey, googlePlacesApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Firebase-AppCheck");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.status(204).send("");
      return;
    }
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }

    const authHeader = req.headers.authorization ?? "";
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) { res.status(401).json({ error: "Missing bearer token." }); return; }

    try {
      const decodedToken = await getAuth().verifyIdToken(match[1]);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;

      const parsed = regenerateActivityRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.message });
        return;
      }

      const { itineraryId, dayIndex, activityIndex, reason } = parsed.data;

      await checkAndConsumeRegenCredit(uid);

      const itineraryRef = getFirestore()
        .collection("users").doc(uid)
        .collection("itineraries").doc(itineraryId);

      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      const currentItinerary = snap.data() as Parameters<typeof regenerateActivity>[0]["itinerary"];

      logger.info("regenerateActivityHttp", { uid, itineraryId, dayIndex, activityIndex });

      let updated = await regenerateActivity({ itinerary: currentItinerary, dayIndex, activityIndex, reason });

      // Snap the new activity to its real Google Place (correct coords + placeId),
      // reject any still-unverified (hallucinated) place, then re-enrich transport
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await reconcileItineraryPlaces(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enforceVerifiedPlacesBySearch(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enrichDayTransportTimes(updated, dayIndex, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
      }

      await itineraryRef.update({
        stops: updated.stops,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Fire-and-forget: extract preference signal from the reason text
      if (reason) {
        signalsFromText(reason)
          .then((signals) => recordSignals(uid, signals))
          .catch(() => {});
      }

      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const classifiedError = classifyHttpError(error);
      logger.error("regenerateActivityHttp failed", { ...classifiedError, rawError: error });
      res.status(classifiedError.status).json(classifiedError);
    }
  });

// ─── Partial regeneration: full day ──────────────────────────────────────────

export const regenerateDayHttp = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    timeoutSeconds: 180,
    secrets: [anthropicApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Firebase-AppCheck");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.status(204).send("");
      return;
    }
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }

    const authHeader = req.headers.authorization ?? "";
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) { res.status(401).json({ error: "Missing bearer token." }); return; }

    try {
      const decodedToken = await getAuth().verifyIdToken(match[1]);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;

      const parsed = regenerateDayRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.message });
        return;
      }

      const { itineraryId, dayIndex, modifications } = parsed.data;

      await checkAndConsumeRegenCredit(uid);

      const itineraryRef = getFirestore()
        .collection("users").doc(uid)
        .collection("itineraries").doc(itineraryId);

      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      const currentItinerary = snap.data() as Parameters<typeof regenerateDay>[0]["itinerary"];

      logger.info("regenerateDayHttp", { uid, itineraryId, dayIndex, modifications });

      let updated = await regenerateDay({ itinerary: currentItinerary, dayIndex, modifications });

      // Snap to real Google Places, reject any still-unverified place, pull any
      // cross-city outlier back into the day's cluster, then enrich legs
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await reconcileItineraryPlaces(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enforceVerifiedPlacesBySearch(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enforceDayGeographicCohesion(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enrichDayTransportTimes(updated, dayIndex, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enrichDriveLegs(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).catch(() => updated);
      }

      await itineraryRef.update({
        stops: updated.stops,
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const classifiedError = classifyHttpError(error);
      logger.error("regenerateDayHttp failed", { ...classifiedError, rawError: error });
      res.status(classifiedError.status).json(classifiedError);
    }
  });

// ─── Destination content ──────────────────────────────────────────────────────

const DESTINATION_CONTENT_TOOL_SCHEMA = {
  type: "object" as const,
  required: [
    "description", "gettingThere", "bestTime", "attractions",
    "cuisine", "activities", "accommodations", "transportation",
    "safety", "language", "currency", "visa",
  ],
  properties: {
    description: { type: "string", description: "2-3 sentence destination overview for travelers" },
    gettingThere: { type: "string", description: "How to arrive — airports, trains, major routes" },
    bestTime: { type: "string", description: "Best seasons or months to visit and why" },
    attractions: { type: "string", description: "Top sights, landmarks, and must-see places" },
    cuisine: { type: "string", description: "Local food scene, signature dishes, dining tips" },
    activities: { type: "string", description: "Activities, experiences, and things to do" },
    accommodations: { type: "string", description: "Types of accommodation and areas to stay" },
    transportation: { type: "string", description: "Getting around locally — transit, taxis, etc." },
    safety: { type: "string", description: "Safety tips, health considerations, emergency info" },
    language: { type: "string", description: "Language(s) spoken and a few useful local phrases" },
    currency: { type: "string", description: "Local currency, payment methods, tipping customs" },
    visa: { type: "string", description: "Visa and entry requirements overview for travelers" },
  },
};

export interface DestinationContentResponse {
  description: string;
  gettingThere: string;
  bestTime: string;
  attractions: string;
  cuisine: string;
  activities: string;
  accommodations: string;
  transportation: string;
  safety: string;
  language: string;
  currency: string;
  visa: string;
}

export const getDestinationContentHttp = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    secrets: [anthropicApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Firebase-AppCheck");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.status(204).send("");
      return;
    }

    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    const authHeader = req.headers.authorization ?? "";
    const match = authHeader.match(/^Bearer (.+)$/i);
    if (!match) {
      res.status(401).json({ error: "Missing bearer token." });
      return;
    }

    try {
      await getAuth().verifyIdToken(match[1]);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }

      const { cityName, country } = req.body as { cityName?: string; country?: string };
      if (!cityName) {
        res.status(400).json({ error: "cityName is required." });
        return;
      }

      const cacheKey = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "_").substring(0, 80);
      const cacheRef = getFirestore().collection("destinationContentCache").doc(cacheKey);
      const cached = await cacheRef.get();
      if (cached.exists) {
        const data = cached.data() as { content: DestinationContentResponse; expiresAt: number };
        if (Date.now() < data.expiresAt) {
          logger.info("getDestinationContentHttp cache hit", { cityName });
          res.status(200).json(data.content);
          return;
        }
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({
        model: FAST_MODEL_NAME,
        max_tokens: 2048,
        tools: [{
          name: "create_destination_guide",
          description: "Create concise travel guide sections for a destination",
          input_schema: DESTINATION_CONTENT_TOOL_SCHEMA,
        }],
        tool_choice: { type: "tool", name: "create_destination_guide" },
        messages: [{
          role: "user",
          content: `Write a concise travel guide for ${cityName}${country ? `, ${country}` : ""}. Each section should be 2-3 sentences of practical, useful travel information.`,
        }],
      });

      const toolUse = message.content.find((c) => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        res.status(500).json({ error: "No structured response from AI." });
        return;
      }

      const content = toolUse.input as DestinationContentResponse;
      await cacheRef.set({ content, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }).catch(() => {});

      logger.info("getDestinationContentHttp success", { cityName, country });
      res.status(200).json(content);
    } catch (error) {
      const classifiedError = classifyHttpError(error);
      logger.error("getDestinationContentHttp failed", { ...classifiedError, rawError: error });
      res.status(classifiedError.status).json(classifiedError);
    }
  });

// ─── RevenueCat webhook ───────────────────────────────────────────────────────

const revenueCatWebhookSecret = defineSecret("REVENUECAT_WEBHOOK_SECRET");

export const revenueCatWebhook = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 5,
    secrets: [revenueCatWebhookSecret],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed." });
      return;
    }

    // Verify shared secret header
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    const authHeader = req.headers.authorization ?? "";
    if (secret && authHeader !== secret) {
      logger.warn("revenueCatWebhook unauthorized", { authHeader: authHeader.substring(0, 8) });
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    try {
      const event = req.body as {
        event: {
          id?: string;
          type: string;
          app_user_id: string;
          expiration_at_ms?: number;
          product_id?: string;
          transaction_id?: string;
        };
      };

      const { id: eventId, type, app_user_id: uid, expiration_at_ms, product_id, transaction_id } = event.event;
      if (!uid) {
        res.status(400).json({ error: "Missing app_user_id." });
        return;
      }

      const db = getFirestore();
      const userRef = db.collection("users").doc(uid);

      logger.info("revenueCatWebhook", { type, uid, product_id });

      // Consumable credit-pack purchase. RevenueCat retries webhooks, so dedup on
      // the unique event/transaction id before granting credits.
      if (type === "NON_RENEWING_PURCHASE" && product_id) {
        const creditAmount = CREDIT_PACK_AMOUNTS[product_id];
        if (!creditAmount) {
          logger.warn("revenueCatWebhook unknown credit product", { product_id });
          res.status(200).json({ ok: true });
          return;
        }
        const dedupId = eventId ?? transaction_id ?? `${uid}-${product_id}-${Date.now()}`;
        const eventRef = db.collection("processedPurchaseEvents").doc(dedupId);
        const granted = await db.runTransaction(async (tx) => {
          const seen = await tx.get(eventRef);
          if (seen.exists) return false;
          tx.set(eventRef, { uid, product_id, creditAmount, processedAt: FieldValue.serverTimestamp() });
          tx.set(userRef, { usage: { credits: FieldValue.increment(creditAmount) } }, { merge: true });
          return true;
        });
        logger.info("revenueCatWebhook credits", { uid, product_id, creditAmount, granted });
        res.status(200).json({ ok: true });
        return;
      }

      if (type === "INITIAL_PURCHASE" || type === "RENEWAL" || type === "UNCANCELLATION") {
        const expiresAt = expiration_at_ms
          ? Timestamp.fromMillis(expiration_at_ms)
          : Timestamp.fromDate(new Date(Date.now() + 366 * 24 * 60 * 60 * 1000));

        await userRef.set(
          {
            subscription: {
              tier: "pro",
              expiresAt,
              revenueCatId: uid,
            },
          },
          { merge: true }
        );
        logger.info("revenueCatWebhook upgraded to pro", { uid, expiresAt: expiresAt.toDate() });
      }

      if (type === "EXPIRATION" || type === "CANCELLATION" || type === "SUBSCRIBER_ALIAS") {
        if (type === "EXPIRATION" || type === "CANCELLATION") {
          await userRef.set(
            {
              subscription: {
                tier: "free",
                expiresAt: null,
                revenueCatId: null,
              },
            },
            { merge: true }
          );
          logger.info("revenueCatWebhook downgraded to free", { uid });
        }
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error("revenueCatWebhook failed", { error });
      res.status(500).json({ error: "Internal error." });
    }
  });

// ─── One-time user migration ──────────────────────────────────────────────────

export const migrateUsersToSubscriptionSchema = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 1, timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    // Protect with a simple admin check — only call this once from a trusted environment
    if (req.headers["x-admin-secret"] !== process.env.ADMIN_MIGRATION_SECRET) {
      res.status(401).json({ error: "Unauthorized." });
      return;
    }

    const db = getFirestore();
    const usersSnap = await db.collection("users").get();
    const nextReset = Timestamp.fromDate(
      new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1))
    );

    let migrated = 0;
    const batch = db.batch();

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.subscription) continue; // already migrated

      const itinerariesSnap = await doc.ref.collection("itineraries").count().get();
      const totalGenerations = itinerariesSnap.data().count ?? 0;

      batch.set(
        doc.ref,
        {
          subscription: { tier: "free", expiresAt: null, revenueCatId: null },
          usage: {
            generationsThisMonth: 0,
            usageResetAt: nextReset,
            totalGenerations,
            regenCount: 0,
            regenResetAt: nextReset,
            credits: 0,
          },
        },
        { merge: true }
      );
      migrated++;
    }

    await batch.commit();
    logger.info("migrateUsersToSubscriptionSchema complete", { migrated });
    res.status(200).json({ migrated });
  });

// ─── Get suggested replacements for an activity ──────────────────────────────

function corsHandler(req: any, res: any): boolean {
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Firebase-AppCheck");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(204).send("");
    return true;
  }
  res.set("Access-Control-Allow-Origin", "*");
  return false;
}

function extractBearer(req: any): string | null {
  const match = (req.headers.authorization ?? "").match(/^Bearer (.+)$/i);
  return match ? match[1] : null;
}

export const getSuggestedReplacementsHttp = functionsV1
  .region("us-central1")
  // minInstances: 1 keeps one warm instance so the day-open preload and the
  // first "replace" tap don't pay a cold start (the slowest part of the latency).
  .runWith({ minInstances: 1, maxInstances: 10, timeoutSeconds: 120, secrets: [anthropicApiKey, googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = getSuggestedReplacementsRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, dayIndex, activityIndex, reason, count } = parsed.data;
      await checkAndConsumeRegenCredit(uid);
      const snap = await getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId).get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      logger.info("getSuggestedReplacementsHttp", { uid, itineraryId, dayIndex, activityIndex, reason });
      const candidates = await getSuggestedReplacements({ itinerary: snap.data() as any, dayIndex, activityIndex, reason, count, googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY });
      res.status(200).json({ candidates });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("getSuggestedReplacementsHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Confirm activity replacement (write chosen candidate) ───────────────────

export const confirmActivityReplacementHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 60, secrets: [googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = confirmActivityReplacementRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, dayIndex, activityIndex, candidateActivity } = parsed.data;
      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      const current = snap.data() as GeneratedItinerary;
      const currentDay = getAllDays(current)[dayIndex];
      if (!currentDay) { res.status(404).json({ error: "Day not found." }); return; }
      const updatedDay = {
        ...currentDay,
        activities: currentDay.activities.map((a, ai) => ai === activityIndex ? candidateActivity : a),
      };
      let updated = updateDayByIndex(current, dayIndex, updatedDay);

      // Snap the swapped-in activity to its real Google Place, reject any unverified
      // place, pull any cross-city outlier back in, then re-enrich the day's transport
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await reconcileItineraryPlaces(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enforceVerifiedPlacesBySearch(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enforceDayGeographicCohesion(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enrichDayTransportTimes(updated, dayIndex, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
      }

      await itineraryRef.update({ stops: updated.stops, updatedAt: FieldValue.serverTimestamp() });
      logger.info("confirmActivityReplacementHttp", { uid, itineraryId, dayIndex, activityIndex });
      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("confirmActivityReplacementHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Edit itinerary with natural language ────────────────────────────────────

export const editItineraryWithLanguageHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 120, secrets: [anthropicApiKey, googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = editItineraryWithLanguageRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, message, dayIndex, forceScopeToDay } = parsed.data;
      await checkAndConsumeRegenCredit(uid);
      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      logger.info("editItineraryWithLanguageHttp", { uid, itineraryId, message, dayIndex, forceScopeToDay });
      let updated = await editItineraryWithLanguage({ itinerary: snap.data() as any, message, dayIndex, forceScopeToDay });

      // Snap any new/changed activities to real Google Places, reject unverified
      // places, pull cross-city outliers back into each day, then re-enrich
      // transport — language edits can affect multiple days
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await reconcileItineraryPlaces(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enforceVerifiedPlacesBySearch(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enforceDayGeographicCohesion(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enrichTransportTimes(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
      }

      await itineraryRef.update({ stops: updated.stops, updatedAt: FieldValue.serverTimestamp() });

      // Fire-and-forget: extract preference signal from the user's message
      signalsFromText(message)
        .then((signals) => recordSignals(uid, signals))
        .catch(() => {});

      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("editItineraryWithLanguageHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Optimize a day ──────────────────────────────────────────────────────────

export const optimizeDayHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 120, secrets: [anthropicApiKey, googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = optimizeDayRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, dayIndex, mode } = parsed.data;
      await checkAndConsumeRegenCredit(uid);
      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      logger.info("optimizeDayHttp", { uid, itineraryId, dayIndex, mode });
      let updated = await optimizeDay({ itinerary: snap.data() as any, dayIndex, mode });

      // Snap any newly swapped-in activities to real Google Places, pull any
      // cross-city outlier back into the day's cluster, then re-enrich transport
      // for the optimized day — activities may be reordered or replaced
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await reconcileItineraryPlaces(updated, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        updated = await enforceDayGeographicCohesion(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).then((g) => g.itinerary).catch(() => updated);
        updated = await enrichDayTransportTimes(updated, dayIndex, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
      }

      await itineraryRef.update({ stops: updated.stops, updatedAt: FieldValue.serverTimestamp() });

      // Fire-and-forget: deterministic signal from optimize mode (no LLM needed)
      const optimizeSignals = signalsFromOptimizeMode(mode);
      if (optimizeSignals.length > 0) {
        recordSignals(uid, optimizeSignals).catch(() => {});
      }

      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("optimizeDayHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Recalculate a single day's transport times ──────────────────────────────
// Lightweight: re-runs Google Routes enrichment for one day after a client-side
// reorder (drag-and-drop). Does NOT regenerate any activity, so it does not
// consume a regen credit — it only refreshes the leg times for the new order.
export const recalculateDayTransportHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 60, secrets: [googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = recalculateDayTransportRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, dayIndex } = parsed.data;
      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      let updated = snap.data() as any;
      if (process.env.GOOGLE_PLACES_API_KEY) {
        updated = await enrichDayTransportTimes(updated, dayIndex, process.env.GOOGLE_PLACES_API_KEY).catch(() => updated);
        // Backfill the drive-leg metrics for existing trips that predate the commute card.
        updated = await enrichDriveLegs(updated, process.env.GOOGLE_PLACES_API_KEY, { dayIndex }).catch(() => updated);
      }

      await itineraryRef.update({ stops: updated.stops, updatedAt: FieldValue.serverTimestamp() });
      logger.info("recalculateDayTransportHttp", { uid, itineraryId, dayIndex });
      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("recalculateDayTransportHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Rework a city stop (remove / replace) ────────────────────────────────────

// Suggests alternative cities for a stop the user wants to swap. Read-only LLM call,
// no credit cost (mirrors a preload — the actual rework is what costs).
export const suggestStopAlternativesHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 60, secrets: [anthropicApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = suggestStopAlternativesRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, stopIndex } = parsed.data;
      const db = getFirestore();
      const snap = await db.collection("users").doc(uid).collection("itineraries").doc(itineraryId).get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      // Load the traveler's effective taste profile (swipe baseline + learned drift) so
      // swap suggestions follow the same hidden-gem/interest bias as the original route.
      const userSnap = await db.collection("users").doc(uid).get();
      const userData = userSnap.data() ?? {};
      const effectiveTaste = getEffectiveTasteProfile(
        userData.tasteProfile,
        (userData.learnedTasteAdjustments ?? {}) as Record<string, number>,
      );
      const alternatives = await suggestStopAlternatives(snap.data() as GeneratedItinerary, stopIndex, effectiveTaste);
      logger.info("suggestStopAlternativesHttp", { uid, itineraryId, stopIndex, count: alternatives.length });
      res.status(200).json({ alternatives });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("suggestStopAlternativesHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// Removes or replaces an entire city stop, then re-flags drive days, re-snaps places,
// and re-enriches transport so the whole trip stays coherent. Heavy (LLM + Places per
// stop) → consumes a regen credit, like regenerateDayHttp.
export const reworkStopHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 180, secrets: [anthropicApiKey, googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
      if (!(await verifyAppCheck(req))) { res.status(401).json({ error: "App Check verification failed." }); return; }
      const uid = decodedToken.uid;
      const parsed = reworkStopRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, stopIndex, action, newLocation } = parsed.data;

      await checkAndConsumeRegenCredit(uid);

      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) { res.status(503).json({ error: "Place data is unavailable right now." }); return; }

      const current = snap.data() as GeneratedItinerary;
      logger.info("reworkStopHttp", { uid, itineraryId, stopIndex, action, newLocation });

      let updated = action === "remove"
        ? await removeStop(current, stopIndex, apiKey)
        : await replaceStop(current, stopIndex, (newLocation ?? "").trim(), apiKey);

      // Drop any activity left on a drive day that belonged to the swapped-out city
      // (the model parks mid-drive arrival activities on the previous stop's drive day).
      updated = pruneStaleDriveDayActivities(updated);

      // Re-flag drive days (which "last day of stop" shifted), then snap to real
      // Places, drop unverified, pull in outliers, and enrich transport + drive legs.
      updated = reflagDriveDays(updated);
      updated = await reconcileItineraryPlaces(updated, apiKey).catch(() => updated);
      updated = await enforceVerifiedPlacesBySearch(updated, apiKey).then((g) => g.itinerary).catch(() => updated);
      updated = await enforceDayGeographicCohesion(updated, apiKey).then((g) => g.itinerary).catch(() => updated);
      updated = await enrichTransportTimes(updated, apiKey).catch(() => updated);
      updated = await enrichDriveLegs(updated, apiKey).catch(() => updated);

      await itineraryRef.update({ stops: updated.stops, updatedAt: FieldValue.serverTimestamp() });
      res.status(200).json({ itinerary: updated });
    } catch (error) {
      const e = classifyHttpError(error);
      logger.error("reworkStopHttp failed", { ...e, rawError: error });
      res.status(e.status).json(e);
    }
  });

// ─── Place photo proxy ────────────────────────────────────────────────────────
// Serves a Google Places photo without ever exposing the Places API key to the client:
// resolves the keyless googleusercontent media URL server-side and 302-redirects to it
// with long cache headers (so repeat views are served from cache, not re-resolved).
// Plain image GET — no auth/App Check (an <Image> can't send those); abuse is bounded
// by the strict `name` format + existing Places quota caps.
export const placePhotoHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 20, timeoutSeconds: 30, secrets: [googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    const name = String(req.query.name ?? "");
    // Only accept a real Places photo resource id: places/<id>/photos/<ref>
    if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) { res.status(400).send("bad name"); return; }
    const w = Math.min(1600, Math.max(200, parseInt(String(req.query.w ?? "800"), 10) || 800));
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) { res.status(503).send("unavailable"); return; }
    try {
      const mediaUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true&key=${apiKey}`;
      const r = await fetch(mediaUrl);
      if (!r.ok) { res.status(404).send("not found"); return; }
      const data = await r.json() as { photoUri?: string };
      if (!data.photoUri) { res.status(404).send("no photo"); return; }
      // Cache hard — a Places photo for a given resource id is stable.
      res.set("Cache-Control", "public, max-age=86400, s-maxage=604800, immutable");
      res.redirect(302, data.photoUri);
    } catch (error) {
      logger.warn("placePhotoHttp failed", { error });
      res.status(502).send("error");
    }
  });

// ─── Destination hero image (cached) ──────────────────────────────────────────
// Returns a cached, beautiful hero image URL for any city. Client screens can call
// this instead of hitting a stock API per view — each destination is fetched once.
export const destinationHeroHttp = functionsV1
  .region("us-central1")
  .runWith({ maxInstances: 10, timeoutSeconds: 30, secrets: [pexelsApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") { res.set("Access-Control-Allow-Headers", "Content-Type"); res.status(204).send(""); return; }
    const city = String(req.query.city ?? "").trim();
    const country = String(req.query.country ?? "").trim() || undefined;
    if (!city) { res.status(400).json({ error: "city is required" }); return; }
    try {
      const url = await getDestinationHero(city, country);
      res.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
      res.status(200).json({ url: url ?? null });
    } catch (error) {
      logger.warn("destinationHeroHttp failed", { error });
      res.status(200).json({ url: null });
    }
  });

// ─── Featured Trip weekly rotation ────────────────────────────────────────────
// Advances the spotlighted prebuilt itinerary (featuredTrips/current) one step
// through FEATURED_POOL every Monday — sequential round-robin so each of the 9
// trips is featured before any repeats. Backed by Cloud Scheduler + Pub/Sub.
export const rotateFeaturedTripWeekly = functionsV1
  .region("us-central1")
  .runWith({
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .pubsub.schedule("7 13 * * 1") // Mondays 13:07 America/New_York
  .timeZone("America/New_York")
  .onRun(async () => {
    const result = await rotateFeatured(getFirestore());
    logger.info("Rotated featured trip", result);
    return null;
  });
