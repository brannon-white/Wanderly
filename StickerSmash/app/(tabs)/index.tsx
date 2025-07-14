import { View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen() {
  const resetOnboarding = async () => {
    await AsyncStorage.removeItem('hasSeenOnboarding');
    await AsyncStorage.removeItem('isSignedIn');
    // Optionally, reload the app or navigate to trigger onboarding/auth again
  };
  const resetAuth = async () => {
    await AsyncStorage.removeItem('isSignedIn');
    // Optionally, reload the app or navigate to trigger onboarding/auth again
  };
  const resetAll = async () => {
    await AsyncStorage.removeItem('hasSeenOnboarding');
    await AsyncStorage.removeItem('isSignedIn');
    // Optionally, reload the app or navigate to trigger onboarding/auth again
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        This is the main app screen!
      </Text>
      <Text style={{ marginTop: 16, fontSize: 16 }}>
        You have finished onboarding.
      </Text>
      <Button title="Reset Onboarding" onPress={resetOnboarding} />
      <Button title="Reset Auth" onPress={resetAuth} />
      <Button title="Reset Both" onPress={resetAll} />
    </View>
  );
}