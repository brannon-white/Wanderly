import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import * as functionsV1 from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";

import { generateItineraryFlow, MODEL_NAME, PROMPT_VERSION } from "./itineraryGeneration";
import {
  callableGenerateItineraryResponseSchema,
  type CallableGenerateItineraryResponse,
} from "./itinerarySchemas";

initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

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
      return { status: 429, error: "gemini_resource_exhausted", details: message };
    }

    if (maybeCode === 400) {
      return { status: 400, error: "gemini_bad_request", details: message };
    }
  }

  if (maybeStatus === "RESOURCE_EXHAUSTED") {
    return { status: 429, error: "gemini_resource_exhausted", details: message };
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

  const itinerary = await generateItineraryFlow(input);
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
    secrets: [geminiApiKey],
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
    secrets: [geminiApiKey],
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
