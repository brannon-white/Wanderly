import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getUserProfile(uid: string) {
  // Try to load cached profile
  const cacheKey = `userProfile_${uid}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    try {
      console.log('Loaded user profile from cache');
      return JSON.parse(cached);
    } catch {
      // Ignore parse errors and fetch fresh
    }
  }

  // Fetch from Firestore
  console.log('Fetching user profile from Firestore');
  const doc = await firestore().collection('users').doc(uid).get();
  if (!doc.exists) throw new Error('User profile not found');
  const profile = doc.data();

  // Cache the profile
  await AsyncStorage.setItem(cacheKey, JSON.stringify(profile));

  return profile;
}