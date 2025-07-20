import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

export async function isOnboardingComplete(uid: string): Promise<boolean> {
  // Check cache first
  const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
  if (cachedProfile) {
    return true;
  }

  // Fallback to Firestore
  const doc = await firestore().collection('users').doc(uid).get();
  return doc.exists();
}