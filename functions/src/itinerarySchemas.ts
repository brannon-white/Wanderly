import { z } from "zod";

export const generateItineraryRequestSchema = z.object({
  destinationId: z.string().min(1),
  destinationName: z.string().min(1),
  country: z.string().optional(),
  party: z.string().min(1),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  interests: z.array(z.string()).default([]),
  budget: z.string().min(1),
});

export const itineraryTransportOptionSchema = z.object({
  mode: z.string().min(1),
  time: z.string().min(1),
  label: z.string().optional(),
});

export const itineraryCoordinatesSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export const itineraryActivitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  description: z.string().optional(),
  time: z.string().min(1),
  cost: z.string().optional(),
  rating: z.number().optional(),
  reviewCount: z.union([z.number(), z.string()]).optional(),
  image: z.string().default(""),
  mapUrl: z.string().optional(),
  coordinates: itineraryCoordinatesSchema.optional(),
  transport: z.array(itineraryTransportOptionSchema).default([]),
});

export const itineraryDaySchema = z.object({
  label: z.string().min(1),
  title: z.string().optional(),
  activities: z.array(itineraryActivitySchema).min(1),
});

export const generatedItinerarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  destinationId: z.string().min(1),
  destinationName: z.string().min(1),
  country: z.string().optional(),
  heroImage: z.string().default(""),
  mapImage: z.string().optional(),
  rating: z.string().optional(),
  reviewCount: z.number().optional(),
  summary: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  travelerType: z.string().optional(),
  budget: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  source: z.enum(["ai_generated", "prebuilt", "manual", "demo"]),
  days: z.array(itineraryDaySchema).min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  model: z.string().optional(),
  promptVersion: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const callableGenerateItineraryResponseSchema = z.object({
  itineraryId: z.string().min(1),
  itinerary: generatedItinerarySchema.extend({
    userId: z.string().optional(),
    createdAt: z.union([
      z.string(),
      z.number(),
      z.object({
        seconds: z.number(),
        nanoseconds: z.number(),
      }),
    ]),
    updatedAt: z.union([
      z.string(),
      z.number(),
      z.object({
        seconds: z.number(),
        nanoseconds: z.number(),
      }),
    ]),
  }),
});

export type GenerateItineraryRequest = z.infer<
  typeof generateItineraryRequestSchema
>;
export type GeneratedItinerary = z.infer<typeof generatedItinerarySchema>;
export type CallableGenerateItineraryResponse = z.infer<
  typeof callableGenerateItineraryResponseSchema
>;
