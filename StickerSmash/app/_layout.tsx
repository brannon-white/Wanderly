import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingFirstPage from './(tabs)/onboardingFirstPage';
import OnboardingSecondPage from './(tabs)/onboardingSecondPage';
import OnboardingThirdPage from './(tabs)/onboardingThirdPage';
import AuthScreen from './(tabs)/authScreen';
import SignInScreen from './(tabs)/signInScreen';
import HomeScreen from './(tabs)/index';
import auth from '@react-native-firebase/auth';
import SignUpscreen from './(tabs)/signUpScreen';
import TravelPreferencesScreen from './(tabs)/travelPreferencesScreen'; // Adjust path as needed





const Stack = createStackNavigator();

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    async function checkFlags() {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
      const firebaseUser = auth().currentUser;
      if (hasSeenOnboarding !== 'true') {
        setInitialRoute('OnboardingFirst');
      } else if (!firebaseUser) {
        setInitialRoute('Auth');
      } else {
        setInitialRoute('Index');
      }
    }
    checkFlags();
  }, []);

  if (!initialRoute) return null;

  return (
      <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="OnboardingFirst"
          component={OnboardingFirstPage}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OnboardingSecond"
          component={OnboardingSecondPage}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="OnboardingThird"
          children={({ navigation }) => (
            <OnboardingThirdPage
              onFinish={async () => {
                await AsyncStorage.setItem('hasSeenOnboarding', 'true');
                navigation.replace('Auth');
              }}
            />
          )}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Auth"
          children={({ navigation }) => (
            <AuthScreen
              onSignIn={() => navigation.replace('SignIn')}
              onSignUp={() => navigation.replace('SignUp')}
            />
          )}
          options={{ headerShown: false }}
        />
<Stack.Screen
  name="SignIn"
  children={({ navigation }) => (
    <SignInScreen
      onSignIn={async () => {
        await AsyncStorage.setItem('isSignedIn', 'true');
        navigation.replace('Index');
      }}
    />
  )}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="Index"
  component={HomeScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="SignUp"
  children={({ navigation }) => (
    <SignUpscreen
      onSignUp={async () => {
        navigation.replace('TravelPreferences');
      }}
    />
  )}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="TravelPreferences"
  component={TravelPreferencesScreen}
  options={{ headerShown: false }}
/>
</Stack.Navigator>
  );
}