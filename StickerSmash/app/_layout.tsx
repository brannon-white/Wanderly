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
import FoodPreferencesScreen from './(tabs)/foodPreferencesScreen'; // Add this import
import UserInfoSignUp from './(tabs)/userInfoSignUp'; // Adjust path as needed
import { OnboardingProvider } from '@/context/OnboardingContext';
import { useFonts } from 'expo-font';
import { getOnboardingProgress } from '@/utils/onboardingStorage'; // Import your utility
import { userExists } from '@/hooks/useSaveUserProfile';
import OnboardingCompleteScreen from './(tabs)/onboardingCompleteScreen';
import BottomTabs from '../components/BottomTabs';
import { getUserProfile } from '@/utils/getUserProfile'; // import at the top
import ItineraryScreen from '@/components/ItineraryScreen';
export type RootStackParamList = {
  OnboardingFirst: undefined;
  OnboardingSecond: undefined;
  OnboardingThird: undefined;
  Auth: undefined;
  SignIn: undefined;
  Index: undefined;
  SignUp: undefined;
  TravelPreferences: undefined;
  FoodPreferences: undefined;
  UserInfoSignUp: undefined;
  OnboardingComplete: undefined; // Add this line
  ItineraryScreen: { id: string };

  // Add other screens as needed
};


const Stack = createStackNavigator<RootStackParamList>();

export default function RootLayout() {
const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);
  const [fontsLoaded] = useFonts({
    'SourceSans3-Regular': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-Regular.ttf'),
    'Merriweather_36pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_36pt-Bold.ttf'),
    'Merriweather_24pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_24pt-Bold.ttf'),
  });

useEffect(() => {
  async function checkFlags() {
    const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
    const firebaseUser = auth().currentUser;

    if (hasSeenOnboarding !== 'true') {
      setInitialRoute('OnboardingFirst');
      return;
    }

    if (!firebaseUser) {
      setInitialRoute('Auth');
      return;
    }

    // Check Firestore for user existence
    const exists = firebaseUser ? await userExists(firebaseUser.uid) : false;
    if (exists) {
        const uid = auth().currentUser?.uid;
      if (uid) {
        getUserProfile(uid);
      }
      setInitialRoute('Index');
      return;
    }

    // Only check onboarding progress if user is logged in and not in Firestore
    const progress = await getOnboardingProgress();
    if (!progress.travel) {
      setInitialRoute('TravelPreferences');
      return;
    }
    if (!progress.food) {
      setInitialRoute('FoodPreferences');
      return;
    }
    if (!progress.userinfo) {
      setInitialRoute('UserInfoSignUp');
      return;
    }

    setInitialRoute('Index');
  }
  checkFlags();
}, []);

  if (!initialRoute) return null;

  return (
    <OnboardingProvider>
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
      }}
    />
  )}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="Index"
  component={BottomTabs}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="SignUp"
  children={({ navigation }) => (
    <SignUpscreen
      onSignUp={() => {
        // Do nothing here, let SignUpScreen handle navigation!
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
<Stack.Screen
  name="FoodPreferences"
  component={FoodPreferencesScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="UserInfoSignUp"
  component={UserInfoSignUp}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="OnboardingComplete"
  component={OnboardingCompleteScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="ItineraryScreen"
  component={ItineraryScreen}
  options={{ headerShown: false }}
/>
</Stack.Navigator>
    </OnboardingProvider>
  );
}