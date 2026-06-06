import appCheck from '@react-native-firebase/app-check';

// Firebase App Check proves a request came from our genuine, unmodified app binary
// (App Attest on iOS, Play Integrity on Android) rather than a script hitting the
// public Cloud Function URL. The backend verifies the token this attaches.
//
// In dev/simulator there is no App Attest, so we use the 'debug' provider: on first
// launch it logs a debug token — register that token in Firebase Console → App Check
// → Apps → "Manage debug tokens" so the simulator can obtain valid App Check tokens.

let initialized = false;

export async function initAppCheck(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();
    provider.configure({
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
      },
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
      },
      // Native-only app; web is unused but the type requires an entry.
      web: { provider: 'reCaptchaV3', siteKey: 'unused' },
    });
    await appCheck().initializeAppCheck({
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // Non-fatal: the backend runs App Check in soft mode until enforcement is
    // switched on, so a failure here never blocks the app.
  }
}

// Returns the App Check header to spread into a fetch() call, or {} if a token
// can't be obtained (e.g. not yet initialized). Callers degrade gracefully.
export async function getAppCheckHeader(): Promise<Record<string, string>> {
  try {
    const { token } = await appCheck().getToken();
    return token ? { 'X-Firebase-AppCheck': token } : {};
  } catch {
    return {};
  }
}
