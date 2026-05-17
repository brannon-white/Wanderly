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
}

export interface UserSubscriptionState {
  subscription: UserSubscription;
  usage: UserUsage;
}

export const FREE_MONTHLY_GENERATION_LIMIT = 3;
export const FREE_MONTHLY_REGEN_LIMIT = 3;

export const PRODUCT_IDS = {
  PRO_MONTHLY: 'wanderly_pro_monthly',
  PRO_ANNUAL: 'wanderly_pro_annual',
} as const;

export const ENTITLEMENT_PRO = 'pro';
