import { getAuth } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cacheGet, cacheSet } from '@/utils/cache';
import { profileCacheKey } from '@/utils/getUserProfile';

export async function updateUserInfo({
  fullName,
  country,
  phone,
  avatarBase64,
}: {
  fullName: string;
  country: any;
  phone: string;
  avatarBase64?: string | null;
}) {
  const user = getAuth().currentUser;
  if (!user) return;

  let avatarUrl: string | undefined;

  if (avatarBase64) {
    const ref = storage().ref(`avatars/${user.uid}.jpg`);
    await ref.putString(avatarBase64, 'base64', { contentType: 'image/jpeg' });
    avatarUrl = await ref.getDownloadURL();
  }

  const updateData: Record<string, any> = {
    fullName,
    country: typeof country?.name === 'string' ? country.name : (typeof country === 'string' ? country : ''),
    countryCode: country?.cca2 || '',
    phone,
  };

  if (avatarUrl) {
    updateData.avatarUrl = avatarUrl;
  }

  await firestore().collection('users').doc(user.uid).update(updateData);

  const key = profileCacheKey(user.uid);
  const cached = await cacheGet<any>(key);
  if (cached) {
    await cacheSet(key, { ...cached, ...updateData }, 1);
  }

  const stored = await AsyncStorage.getItem(`userProfile_${user.uid}`);
  if (stored) {
    const parsed = JSON.parse(stored);
    await AsyncStorage.setItem(`userProfile_${user.uid}`, JSON.stringify({ ...parsed, ...updateData }));
  }
}
