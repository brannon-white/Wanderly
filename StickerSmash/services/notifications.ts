import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

export async function requestPermissionAndSaveToken(): Promise<boolean> {
  const authStatus = await messaging().requestPermission();
  const granted =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!granted) return false;

  try {
    const token = await messaging().getToken();
    const uid = getAuth().currentUser?.uid;
    if (uid && token) {
      await firestore()
        .collection('users')
        .doc(uid)
        .set({ fcmToken: token }, { merge: true });
    }
  } catch {
    // Non-fatal — generation will still proceed, just no push
  }

  return granted;
}
