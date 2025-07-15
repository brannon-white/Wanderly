import { View, Text, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

export default function HomeScreen() {
  const user = auth().currentUser;

  const resetOnboarding = async () => {
    await AsyncStorage.removeItem('hasSeenOnboarding');
    await AsyncStorage.removeItem('isSignedIn');
  };
  const resetAuth = async () => {
    await AsyncStorage.removeItem('isSignedIn');
  };
  const resetAll = async () => {
    await AsyncStorage.removeItem('hasSeenOnboarding');
    await AsyncStorage.removeItem('isSignedIn');
    signOut();
  };

  const signOut = async () => {
    try {
      await auth().signOut();
      await AsyncStorage.removeItem('isSignedIn');
    } catch (error) {
      console.log('Sign out error:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        This is the main app screen!
      </Text>
      <Text style={{ marginTop: 16, fontSize: 16 }}>
        You have finished onboarding.
      </Text>
      {user && (
        <Text style={{ marginTop: 16, fontSize: 16 }}>
          Hello, {user.displayName || user.email}
        </Text>
      )}
      <Button title="Reset Onboarding" onPress={resetOnboarding} />
      <Button title="Reset Auth" onPress={signOut} />
      <Button title="Reset Both" onPress={resetAll} />
    </View>
  );
}