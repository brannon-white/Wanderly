import { googleAI } from "@genkit-ai/google-genai";
import { genkit } from "genkit";

import {
  generateItineraryRequestSchema,
  generatedItinerarySchema,
  type GenerateItineraryRequest,
  type GeneratedItinerary,
} from "./itinerarySchemas";

export const PROMPT_VERSION = "v1";
export const MODEL_NAME = "gemini-2.5-flash";
export const FALLBACK_MODEL_NAME = "gemini-2.5-flash-lite";

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(MODEL_NAME),
});

function shouldRetryWithFallback(error: unknown): boolean {
  const maybeCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const maybeStatus =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status?: unknown }).status
      : undefined;

  return maybeCode === 503 || maybeStatus === "UNAVAILABLE";
}

async function generateWithModel(
  input: GenerateItineraryRequest,
  modelName: string
): Promise<GeneratedItinerary> {
  const { output } = await ai.generate({
    model: googleAI.model(modelName),
    prompt: itineraryPrompt(input),
    output: {
      schema: generatedItinerarySchema,
    },
  });

  if (!output) {
    throw new Error(`Model ${modelName} returned no itinerary output.`);
  }

  return {
    ...output,
    destinationId: input.destinationId,
    destinationName: output.destinationName || input.destinationName,
    country: output.country || input.country,
    budget: input.budget,
    interests: input.interests,
    travelerType: input.party,
    startDate: input.startDate,
    endDate: input.endDate,
    source: "ai_generated",
    model: modelName,
    promptVersion: PROMPT_VERSION,
    isActive: true,
  };
}

const itineraryPrompt = (input: GenerateItineraryRequest) => `
You are generating a mobile-friendly travel itinerary as strict JSON.

Requirements:
- Return only JSON matching the provided output schema.
- Build a realistic itinerary for "${input.destinationName}"${input.country ? `, ${input.country}` : ""}.
- Use destinationId "${input.destinationId}" only as an internal identifier, not as the human-facing destination name.
- Keep the tone concise and practical.
- Include 2 to 4 days depending on the trip information.
- Each day must contain 2 to 5 activities.
- Activities should include specific names, time labels, short descriptions, image URLs, and transport suggestions.
- Set source to "ai_generated".
- Keep budget aligned to "${input.budget}".
- Reflect these traveler interests when relevant: ${input.interests.join(", ") || "general sightseeing"}.
- Traveler party: ${input.party}.
- Start date: ${input.startDate ?? "not provided"}.
- End date: ${input.endDate ?? "not provided"}.

Use public placeholder image URLs if you do not know exact assets.
Do not include markdown fences or commentary.
`;

export const generateItineraryFlow = ai.defineFlow(
  {
    name: "generateItinerary",
    inputSchema: generateItineraryRequestSchema,
    outputSchema: generatedItinerarySchema,
  },
  async (input): Promise<GeneratedItinerary> => {
    try {
      return await generateWithModel(input, MODEL_NAME);
    } catch (error) {
      if (!shouldRetryWithFallback(error)) {
        throw error;
      }

      return generateWithModel(input, FALLBACK_MODEL_NAME);
    }
  }
);
