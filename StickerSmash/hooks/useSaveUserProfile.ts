import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import storage from '@react-native-firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    await firestore().collection('users').doc(user.uid).set({
      uid: user.uid,
      fullName,
      country: typeof country?.name === 'string' ? country.name : '',
      countryCode: country?.cca2 || '',
      phone,
      avatarUrl,
      email: user.email,
      activityPreferences,
      foodPreferences,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('Error saving user:', err);
  }
}
export async function userExists(uid: string): Promise<boolean> {
  // Check cache first
  const cachedProfile = await AsyncStorage.getItem(`userProfile_${uid}`);
  if (cachedProfile) {
    console.log('User profile exists in cache');
    return true;
  }
  // Fallback to Firestore
  const doc = await firestore().collection('users').doc(uid).get();
      console.log('User profile pulled from Firestore');

  return doc.exists();
}