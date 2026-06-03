import analytics from '@react-native-firebase/analytics';

function log(event: string, params?: Record<string, string | number | boolean>) {
  analytics().logEvent(event, params).catch(() => {});
}

export function logItineraryGenerated(params: {
  destinationName: string;
  days: number;
  budget: string;
}) {
  log('itinerary_generated', params);
}

export function logPaywallShown(reason: 'generation' | 'regen') {
  log('paywall_shown', { reason });
}

export function logPurchaseStarted(plan: 'monthly' | 'annual') {
  log('purchase_started', { plan });
}

export function logPurchaseCompleted(plan: 'monthly' | 'annual') {
  log('purchase_completed', { plan });
}

export function logRegenAttempted(type: 'activity' | 'day' | 'ai_bar') {
  log('regen_attempted', { type });
}
