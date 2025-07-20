import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { cacheStaticFoodPreferences } from '@/utils/cacheStaticFoodPreferences'; // import your cache function

export async function getStaticFoodPreferences() {
  // Try cache first
  const cached = await AsyncStorage.getItem('staticFoodPreferences');
  if (cached) {
    return JSON.parse(cached);
  }

  // If not cached, fetch from Firestore
  const doc = await firestore().collection('staticFoodPreferences').doc('all').get();
  const data = doc.data();
  if (data && Array.isArray(data.foods)) {
    await cacheStaticFoodPreferences(data.foods); // Cache them
    return data.foods;
  }
  return [];
}