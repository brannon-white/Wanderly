import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveOnboardingStep(step: 'travel' | 'food' | 'userinfo', data: any) {
  // Save progress
  const progressRaw = await AsyncStorage.getItem('profileOnboardingProgress');
  const progress = progressRaw ? JSON.parse(progressRaw) : {};
  progress[step] = true;
  await AsyncStorage.setItem('profileOnboardingProgress', JSON.stringify(progress));

  // Save data
  await AsyncStorage.setItem(`profileOnboarding_${step}`, JSON.stringify(data));
}

export async function getOnboardingStepData(step: 'travel' | 'food' | 'userinfo') {
  const raw = await AsyncStorage.getItem(`profileOnboarding_${step}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getOnboardingProgress() {
  const raw = await AsyncStorage.getItem('profileOnboardingProgress');
  return raw ? JSON.parse(raw) : {};
}

export async function clearOnboardingProgress() {
  await AsyncStorage.removeItem('profileOnboardingProgress');
  await AsyncStorage.removeItem('profileOnboarding_travel');
  await AsyncStorage.removeItem('profileOnboarding_food');
  await AsyncStorage.removeItem('profileOnboarding_userinfo');
}