export type SubscriptionTier = 'free' | 'pro';

export interface UserSubscription {
  tier: SubscriptionTier;
  expiresAt: string | null; // ISO string, null for free
  revenueCatId: string | null;
}

export interface UserUsage {
  generationsThisMonth: number;
  usageResetAt: string; // ISO string — 1st of next month
  totalGenerations: number;
  regenCount: number; // lifetime regens used (free users capped at FREE_MONTHLY_REGEN_LIMIT/month)
  regenResetAt: string; // ISO string — resets monthly like generations
  credits?: number; // purchased one-time trip credits, consumed after monthly allotment runs out
}

export interface UserSubscriptionState {
  subscription: UserSubscription;
  usage: UserUsage;
}

// Free tier: 3 generations/month included.
export const FREE_MONTHLY_GENERATION_LIMIT = 3;
export const FREE_MONTHLY_REGEN_LIMIT = 3;

// Pro tier: generous monthly cap (not unlimited) — bounds worst-case API cost.
// Real users plan a handful of trips/month and never hit this; the cap kills the
// abuse vector where one subscriber runs up hundreds of dollars of API calls.
export const PRO_MONTHLY_GENERATION_LIMIT = 20;

export const PRODUCT_IDS = {
  PRO_MONTHLY: 'wanderly_pro_monthly',
  PRO_ANNUAL: 'wanderly_pro_annual',
} as const;

// Consumable credit packs (one-time purchases). Each credit = one full itinerary
// generation. Sold to free users and as Pro overage. Keys are App Store / Google
// Play product IDs; values are how many trip credits the purchase grants.
export const CREDIT_PRODUCT_IDS = {
  CREDITS_1: 'wanderly_credits_1',
  CREDITS_5: 'wanderly_credits_5',
  CREDITS_12: 'wanderly_credits_12',
} as const;

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  [CREDIT_PRODUCT_IDS.CREDITS_1]: 1,
  [CREDIT_PRODUCT_IDS.CREDITS_5]: 5,
  [CREDIT_PRODUCT_IDS.CREDITS_12]: 12,
};

export const ENTITLEMENT_PRO = 'pro';
