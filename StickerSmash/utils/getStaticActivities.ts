import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { cacheStaticActivities } from './cacheStaticActivities';

export async function getStaticActivities() {
  // Try cache first
  const cached = await AsyncStorage.getItem('staticActivities');
  if (cached) {
    console.log('Loaded activities from cache');
    return JSON.parse(cached);
  }

  // If not cached, fetch from Firestore and cache
  const doc = await firestore().collection('staticActivities').doc('all').get();
  const data = doc.data();
  if (data && Array.isArray(data.activities)) {
    await cacheStaticActivities(data.activities);
    return data.activities;
  }
  return [];
}