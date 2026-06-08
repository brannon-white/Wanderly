import Purchases, { LOG_LEVEL, PURCHASE_TYPE, type CustomerInfo, type PurchasesStoreProduct } from 'react-native-purchases';
import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { CREDIT_PACK_AMOUNTS, CREDIT_PRODUCT_IDS, ENTITLEMENT_PRO, FREE_MONTHLY_GENERATION_LIMIT, FREE_MONTHLY_REGEN_LIMIT, PRODUCT_IDS, PRO_MONTHLY_GENERATION_LIMIT } from '@/types/subscription';
import type { UserUsage, UserSubscription } from '@/types/subscription';

// Configure these in app.config.js or as env vars once you have RevenueCat keys
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let initialized = false;

// RevenueCat public SDK keys are platform-prefixed: iOS "appl_", Android "goog_".
// We only reject an empty/placeholder key here (anything with the right prefix and
// some length is treated as real — key lengths vary). The configure() call itself
// is wrapped in try/catch below so a rejected key can't crash startup.
function looksLikeValidKey(apiKey: string): boolean {
  const prefix = Platform.OS === 'ios' ? 'appl_' : 'goog_';
  return apiKey.startsWith(prefix) && apiKey.length > prefix.length + 8;
}

export function initPurchases() {
  if (initialized) return;
  initialized = true;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) return; // keys not set yet

  if (!looksLikeValidKey(apiKey)) {
    // Don't call configure() with a malformed/placeholder key — RevenueCat would
    // throw "configuration is not valid". Skip purchases instead; the rest of the
    // app runs normally and paywalls degrade gracefully (offerings come back empty).
    console.warn('[purchases] RevenueCat key missing or malformed — skipping configure (IAP disabled).');
    initialized = false; // allow a retry after a real key is provided + rebuild
    return;
  }

  try {
    Purchases.setLogLevel(LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });

    const user = getAuth().currentUser;
    if (user) {
      Purchases.logIn(user.uid).catch(() => {});
    }
  } catch (e) {
    console.warn('[purchases] RevenueCat configure failed — IAP disabled for this session.', e);
    initialized = false;
  }
}

export async function loginPurchasesUser(uid: string) {
  if (!initialized) return;
  try {
    await Purchases.logIn(uid);
  } catch {
    // non-fatal
  }
}

export async function logoutPurchasesUser() {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch {
    // non-fatal
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!initialized) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function isPro(customerInfo: CustomerInfo | null): boolean {
  if (!customerInfo) return false;
  return ENTITLEMENT_PRO in (customerInfo.entitlements.active ?? {});
}

export async function purchaseMonthly(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const monthly = offerings.current?.availablePackages.find(
      (p) => p.product.identifier === PRODUCT_IDS.PRO_MONTHLY
    );
    if (!monthly) return false;
    await Purchases.purchasePackage(monthly);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function purchaseAnnual(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const annual = offerings.current?.availablePackages.find(
      (p) => p.product.identifier === PRODUCT_IDS.PRO_ANNUAL
    );
    if (!annual) return false;
    await Purchases.purchasePackage(annual);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return isPro(info);
  } catch {
    return false;
  }
}

// ─── Consumable credit packs ──────────────────────────────────────────────────

export interface CreditPack {
  productId: string;
  credits: number;
  priceString: string; // localized, e.g. "$9.99"
  title: string;
}

// Fetch the credit-pack products with localized store pricing, sorted cheapest first.
export async function getCreditPacks(): Promise<CreditPack[]> {
  if (!initialized) return [];
  try {
    const ids = Object.values(CREDIT_PRODUCT_IDS);
    const products = await Purchases.getProducts(ids, PURCHASE_TYPE.INAPP);
    return products
      .map((p: PurchasesStoreProduct) => ({
        productId: p.identifier,
        credits: CREDIT_PACK_AMOUNTS[p.identifier] ?? 0,
        priceString: p.priceString,
        title: p.title,
      }))
      .filter((p) => p.credits > 0)
      .sort((a, b) => a.credits - b.credits);
  } catch {
    return [];
  }
}

// Buy a consumable credit pack. The RevenueCat webhook grants the credits to the
// user's Firestore balance, so on success the caller should refetch usage status.
export async function purchaseCreditPack(productId: string): Promise<boolean> {
  try {
    const products = await Purchases.getProducts([productId], PURCHASE_TYPE.INAPP);
    const product = products[0];
    if (!product) return false;
    await Purchases.purchaseStoreProduct(product);
    return true;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

// ─── Firestore-based usage helpers ───────────────────────────────────────────

function nextMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface UsageStatus {
  isPro: boolean;
  generationsLeft: number; // remaining from the monthly allotment (free 3 / pro 20)
  regensLeft: number;       // -1 = unlimited (pro)
  credits: number;          // purchased trip credits, usable after the allotment runs out
  resetDate: Date;          // when the monthly quota resets
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const user = getAuth().currentUser;
  if (!user) return { isPro: false, generationsLeft: FREE_MONTHLY_GENERATION_LIMIT, regensLeft: FREE_MONTHLY_REGEN_LIMIT, credits: 0, resetDate: nextMonthStart() };

  try {
    const snap = await firestore().collection('users').doc(user.uid).get();
    const data = snap.data() ?? {};

    const subscription = data.subscription as UserSubscription | undefined;
    const usage = data.usage as UserUsage | undefined;

    // Firestore Timestamps arrive as objects with .toDate(); handle both that and plain strings/null
    const toDate = (val: unknown): Date | null => {
      if (!val) return null;
      if (typeof (val as any).toDate === 'function') return (val as any).toDate();
      const d = new Date(val as string);
      return isNaN(d.getTime()) ? null : d;
    };

    const expiresAt = toDate(subscription?.expiresAt);
    const isProTier = subscription?.tier === 'pro' && expiresAt !== null && expiresAt > new Date();

    const now = new Date();
    const resetAt = toDate(usage?.usageResetAt) ?? new Date(0);
    const isNewMonth = resetAt <= now;
    const generationsUsed = isNewMonth ? 0 : (usage?.generationsThisMonth ?? 0);
    const credits = usage?.credits ?? 0;
    const monthlyLimit = isProTier ? PRO_MONTHLY_GENERATION_LIMIT : FREE_MONTHLY_GENERATION_LIMIT;
    const nextReset = isNewMonth ? nextMonthStart() : resetAt;

    if (isProTier) {
      return {
        isPro: true,
        generationsLeft: Math.max(0, monthlyLimit - generationsUsed),
        regensLeft: -1,
        credits,
        resetDate: nextReset,
      };
    }

    const regenResetAt = toDate(usage?.regenResetAt) ?? new Date(0);
    const isRegenNewMonth = regenResetAt <= now;
    const regensUsed = isRegenNewMonth ? 0 : (usage?.regenCount ?? 0);

    return {
      isPro: false,
      generationsLeft: Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - generationsUsed),
      regensLeft: Math.max(0, FREE_MONTHLY_REGEN_LIMIT - regensUsed),
      credits,
      resetDate: nextReset,
    };
  } catch {
    // If Firestore fails, be permissive — backend will enforce the real limit
    return { isPro: false, generationsLeft: FREE_MONTHLY_GENERATION_LIMIT, regensLeft: FREE_MONTHLY_REGEN_LIMIT, credits: 0, resetDate: nextMonthStart() };
  }
}
