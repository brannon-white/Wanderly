import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheStaticFoodPreferences(foods: { label: string; emoji: string }[]) {
  await AsyncStorage.setItem('staticFoodPreferences', JSON.stringify(foods));
}