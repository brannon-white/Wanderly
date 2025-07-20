import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import { isOnboardingComplete } from '@/utils/isOnboardingComplete';

export async function updateTravelPreferences(selected: string[]) {
  const uid = auth().currentUser?.uid;
  if (!uid) return;

  if (await isOnboardingComplete(uid)) {
    // Update Firestore
    await firestore().collection('users').doc(uid).update({
      activityPreferences: selected,
    });

    // Update cached profile
    const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
    if (cachedProfile) {
      const profile = JSON.parse(cachedProfile);
      profile.activityPreferences = selected;
      await AsyncStorage.setItem(`userProfile_${uid}`, JSON.stringify(profile));
    }

    // Clear itineraries cache so recommendations update
    const cacheKey = `itineraries_${uid}_${selected.join('_')}`;
    const cacheTimeKey = `${cacheKey}_timestamp`;
    await AsyncStorage.removeItem(cacheKey);
    await AsyncStorage.removeItem(cacheTimeKey);
  }
}