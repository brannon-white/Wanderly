import Purchases, { LOG_LEVEL, type CustomerInfo } from 'react-native-purchases';
import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { Platform } from 'react-native';
import { ENTITLEMENT_PRO, FREE_MONTHLY_GENERATION_LIMIT, FREE_MONTHLY_REGEN_LIMIT, PRODUCT_IDS } from '@/types/subscription';
import type { UserUsage, UserSubscription } from '@/types/subscription';

// Configure these in app.config.js or as env vars once you have RevenueCat keys
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let initialized = false;

export function initPurchases() {
  if (initialized) return;
  initialized = true;

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (!apiKey) return; // skip in dev if keys not set yet

  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });

  const user = getAuth().currentUser;
  if (user) {
    Purchases.logIn(user.uid).catch(() => {});
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

// ─── Firestore-based usage helpers ───────────────────────────────────────────

function nextMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export interface UsageStatus {
  isPro: boolean;
  generationsLeft: number; // -1 = unlimited
  regensLeft: number;       // -1 = unlimited
}

export async function getUsageStatus(): Promise<UsageStatus> {
  const user = getAuth().currentUser;
  if (!user) return { isPro: false, generationsLeft: FREE_MONTHLY_GENERATION_LIMIT, regensLeft: FREE_MONTHLY_REGEN_LIMIT };

  try {
    const snap = await firestore().collection('users').doc(user.uid).get();
    const data = snap.data() ?? {};

    const subscription = data.subscription as UserSubscription | undefined;
    const usage = data.usage as UserUsage | undefined;

    const isProTier =
      subscription?.tier === 'pro' &&
      subscription.expiresAt !== null &&
      new Date(subscription.expiresAt) > new Date();

    if (isProTier) {
      return { isPro: true, generationsLeft: -1, regensLeft: -1 };
    }

    const now = new Date();
    const resetAt = usage?.usageResetAt ? new Date(usage.usageResetAt) : new Date(0);
    const isNewMonth = resetAt <= now;
    const generationsUsed = isNewMonth ? 0 : (usage?.generationsThisMonth ?? 0);

    const regenResetAt = usage?.regenResetAt ? new Date(usage.regenResetAt) : new Date(0);
    const isRegenNewMonth = regenResetAt <= now;
    const regensUsed = isRegenNewMonth ? 0 : (usage?.regenCount ?? 0);

    return {
      isPro: false,
      generationsLeft: Math.max(0, FREE_MONTHLY_GENERATION_LIMIT - generationsUsed),
      regensLeft: Math.max(0, FREE_MONTHLY_REGEN_LIMIT - regensUsed),
    };
  } catch {
    // If Firestore fails, be permissive — backend will enforce the real limit
    return { isPro: false, generationsLeft: FREE_MONTHLY_GENERATION_LIMIT, regensLeft: FREE_MONTHLY_REGEN_LIMIT };
  }
}
