import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import { cacheGet, cacheSet } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';

export async function saveUserProfile({
  avatarBase64,
  fullName,
  country,
  phone,
  activityPreferences,
  foodPreferences,
}: {
  avatarBase64: string | null;
  fullName: string;
  country: any;
  phone: string;
  activityPreferences: string[];
  foodPreferences: string[];
}) {
  try {
    const user = auth().currentUser;
    if (!user) throw new Error('No user signed in');

    let avatarUrl = '';
    if (avatarBase64) {
      try {
        const ref = storage().ref(`avatars/${user.uid}.jpg`);
        await ref.putString(avatarBase64, 'base64', { contentType: 'image/jpeg' });
        avatarUrl = await ref.getDownloadURL();
      } catch (err) {
        console.error('Error uploading avatar:', err);
        avatarUrl = '';
      }
    }

    const profileData = {
      uid: user.uid,
      fullName,
      country: typeof country?.name === 'string' ? country.name : '',
      countryCode: country?.cca2 || '',
      phone,
      avatarUrl,
      email: user.email,
      activityPreferences,
      foodPreferences,
    };

    await firestore().collection('users').doc(user.uid).set({
      ...profileData,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    await cacheSet(profileCacheKey(user.uid), profileData, 1);
  } catch (err) {
    console.error('Error saving user:', err);
  }
}

export async function userExists(uid: string): Promise<boolean> {
  const cached = await cacheGet(profileCacheKey(uid));
  if (cached) return true;
  const doc = await firestore().collection('users').doc(uid).get();
  return doc.exists();
}
