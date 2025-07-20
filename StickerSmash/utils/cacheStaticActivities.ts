import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheStaticActivities(activities: { label: string; emoji: string }[]) {
  await AsyncStorage.setItem('staticActivities', JSON.stringify(activities));
}