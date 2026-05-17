import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";

import Anthropic from "@anthropic-ai/sdk";
import {
  generateItineraryFlow,
  regenerateActivity,
  regenerateDay,
  MODEL_NAME,
  PROMPT_VERSION,
} from "./itineraryGeneration";
import {
  callableGenerateItineraryResponseSchema,
  regenerateActivityRequestSchema,
  regenerateDayRequestSchema,
  type CallableGenerateItineraryResponse,
} from "./itinerarySchemas";

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
  input: {
    destinationId: string;
    destinationName: string;
    country?: string;
    party: string;
    startDate: string | null;
    endDate: string | null;
    interests: string[];
    budget: string;
  }
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

  const itinerary = await generateItineraryFlow(input, process.env.GOOGLE_PLACES_API_KEY);
  logger.info("Itinerary generated from model", {
    uid,
    destinationId: input.destinationId,
    model: itinerary.model ?? MODEL_NAME,
    promptVersion: itinerary.promptVersion ?? PROMPT_VERSION,
    daysCount: itinerary.days.length,
  });

  const firestore = getFirestore();
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

      const parsed = regenerateActivityRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid request", details: parsed.error.message });
        return;
      }

      const { itineraryId, dayIndex, activityIndex, reason } = parsed.data;

      const itineraryRef = getFirestore()
        .collection("users").doc(uid)
        .collection("itineraries").doc(itineraryId);

      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      const currentItinerary = snap.data() as Parameters<typeof regenerateActivity>[0]["itinerary"];

      logger.info("regenerateActivityHttp", { uid, itineraryId, dayIndex, activityIndex });

      const updated = await regenerateActivity({ itinerary: currentItinerary, dayIndex, activityIndex, reason });

      await itineraryRef.update({
        days: updated.days,
        updatedAt: FieldValue.serverTimestamp(),
      });

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

      const itineraryRef = getFirestore()
        .collection("users").doc(uid)
        .collection("itineraries").doc(itineraryId);

      const snap = await itineraryRef.get();
      if (!snap.exists) { res.status(404).json({ error: "Itinerary not found." }); return; }

      const currentItinerary = snap.data() as Parameters<typeof regenerateDay>[0]["itinerary"];

      logger.info("regenerateDayHttp", { uid, itineraryId, dayIndex, modifications });

      const updated = await regenerateDay({ itinerary: currentItinerary, dayIndex, modifications });

      await itineraryRef.update({
        days: updated.days,
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

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await client.messages.create({
        model: MODEL_NAME,
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

      logger.info("getDestinationContentHttp success", { cityName, country });
      res.status(200).json(toolUse.input as DestinationContentResponse);
    } catch (error) {
      const classifiedError = classifyHttpError(error);
      logger.error("getDestinationContentHttp failed", { ...classifiedError, rawError: error });
      res.status(classifiedError.status).json(classifiedError);
    }
  });
