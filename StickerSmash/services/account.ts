import { getAuth, getIdToken } from '@react-native-firebase/auth';
import { getAppCheckHeader } from '@/services/appCheck';

const BASE_URL = 'https://us-central1-wanderly-dff52.cloudfunctions.net';

// Permanently deletes the signed-in user's account: all Firestore data (itineraries,
// saved items, profile) and the Firebase Auth user. The backend derives the uid from
// the verified ID token, so this can only ever delete the caller's own account.
export async function deleteAccount(): Promise<void> {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error('No Firebase auth user is currently signed in.');

  const idToken = await getIdToken(currentUser, true);
  const appCheckHeader = await getAppCheckHeader();

  const response = await fetch(`${BASE_URL}/deleteAccountHttp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      ...appCheckHeader,
    },
    body: JSON.stringify({}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Failed to delete account.');
  }
}
