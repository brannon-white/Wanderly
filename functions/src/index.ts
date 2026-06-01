import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";

const FREE_MONTHLY_GENERATION_LIMIT = 3;
const FREE_MONTHLY_REGEN_LIMIT = 3;

function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

async function checkAndConsumeGenerationCredit(uid: string): Promise<void> {
  const db = getFirestore();
  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  const data = snap.data() ?? {};

  const tier: string = data.subscription?.tier ?? "free";
  const expiresAt: Timestamp | null = data.subscription?.expiresAt ?? null;
  const isPro = tier === "pro" && expiresAt !== null && expiresAt.toDate() > new Date();

  if (isPro) return; // pro users have no limit

  const now = new Date();
  const resetAt: Date = data.usage?.usageResetAt
    ? (data.usage.usageResetAt as Timestamp).toDate()
    : new Date(0);
  const isNewMonth = resetAt <= now;
  const currentCount: number = isNewMonth ? 0 : (data.usage?.generationsThisMonth ?? 0);

  if (currentCount >= FREE_MONTHLY_GENERATION_LIMIT) {
    throw Object.assign(new Error("Monthly generation limit reached"), { code: "LIMIT_REACHED" });
  }

  const nextReset = getNextMonthStart();
  await userRef.set(
    {
      usage: {
        generationsThisMonth: isNewMonth ? 1 : FieldValue.increment(1),
        usageResetAt: isNewMonth ? Timestamp.fromDate(nextReset) : (data.usage?.usageResetAt ?? Timestamp.fromDate(nextReset)),
        totalGenerations: FieldValue.increment(1),
        regenCount: isNewMonth ? 0 : (data.usage?.regenCount ?? 0),
        regenResetAt: isNewMonth ? Timestamp.fromDate(nextReset) : (data.usage?.regenResetAt ?? Timestamp.fromDate(nextReset)),
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
import { FAST_MODEL_NAME } from "./constants";
import {
  callableGenerateItineraryResponseSchema,
  regenerateActivityRequestSchema,
  regenerateDayRequestSchema,
  getSuggestedReplacementsRequestSchema,
  confirmActivityReplacementRequestSchema,
  editItineraryWithLanguageRequestSchema,
  optimizeDayRequestSchema,
  type CallableGenerateItineraryResponse,
  type GenerateItineraryRequest,
} from "./itinerarySchemas";
import { getAllDays, updateDayByIndex, type GeneratedItinerary } from "./itinerarySchemas";
import { enrichDayTransportTimes, enrichTransportTimes } from "./orchestration/directions";

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const googlePlacesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");

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

  const itinerary = await generateItineraryFlow(enrichedInput, process.env.GOOGLE_PLACES_API_KEY);
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
    secrets: [anthropicApiKey, googlePlacesApiKey],
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

    await checkAndConsumeGenerationCredit(uid);
    return buildAndSaveItinerary(uid, data);
  });

export const generateItineraryHttp = functionsV1
  .region("us-central1")
  .runWith({
    maxInstances: 10,
    timeoutSeconds: 300,
    secrets: [anthropicApiKey, googlePlacesApiKey],
    serviceAccount: "588805144943-compute@developer.gserviceaccount.com",
  })
  .https.onRequest(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
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
      await checkAndConsumeGenerationCredit(decodedToken.uid);
      const result = await buildAndSaveItinerary(decodedToken.uid, req.body);
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
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
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

      // Re-enrich transport times for the affected day so travel legs stay accurate
      if (process.env.GOOGLE_PLACES_API_KEY) {
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
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
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

      const updated = await regenerateDay({ itinerary: currentItinerary, dayIndex, modifications });

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
      res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
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
          type: string;
          app_user_id: string;
          expiration_at_ms?: number;
          product_id?: string;
        };
      };

      const { type, app_user_id: uid, expiration_at_ms, product_id } = event.event;
      if (!uid) {
        res.status(400).json({ error: "Missing app_user_id." });
        return;
      }

      const db = getFirestore();
      const userRef = db.collection("users").doc(uid);

      logger.info("revenueCatWebhook", { type, uid, product_id });

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
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
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
  .runWith({ maxInstances: 10, timeoutSeconds: 120, secrets: [anthropicApiKey, googlePlacesApiKey], serviceAccount: "588805144943-compute@developer.gserviceaccount.com" })
  .https.onRequest(async (req, res) => {
    if (corsHandler(req, res)) return;
    if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed." }); return; }
    const token = extractBearer(req);
    if (!token) { res.status(401).json({ error: "Missing bearer token." }); return; }
    try {
      const decodedToken = await getAuth().verifyIdToken(token);
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

      // Re-enrich transport times for the affected day so legs stay accurate after the swap
      if (process.env.GOOGLE_PLACES_API_KEY) {
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
      const uid = decodedToken.uid;
      const parsed = editItineraryWithLanguageRequestSchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid request", details: parsed.error.message }); return; }
      const { itineraryId, message } = parsed.data;
      await checkAndConsumeRegenCredit(uid);
      const itineraryRef = getFirestore().collection("users").doc(uid).collection("itineraries").doc(itineraryId);
      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }
      logger.info("editItineraryWithLanguageHttp", { uid, itineraryId, message });
      let updated = await editItineraryWithLanguage({ itinerary: snap.data() as any, message });

      // Re-enrich transport for all days — natural language edits can affect multiple days
      if (process.env.GOOGLE_PLACES_API_KEY) {
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

      // Re-enrich transport for the optimized day — activities may be reordered or replaced
      if (process.env.GOOGLE_PLACES_API_KEY) {
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
