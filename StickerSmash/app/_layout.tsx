import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, Text } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import OnboardingFirstPage from './(tabs)/onboardingFirstPage';
import OnboardingSecondPage from './(tabs)/onboardingSecondPage';
import OnboardingThirdPage from './(tabs)/onboardingThirdPage';
import AuthScreen from './(tabs)/authScreen';
import SignInScreen from './(tabs)/signInScreen';
import { getAuth } from '@react-native-firebase/auth';
import SignUpscreen from './(tabs)/signUpScreen';
import TravelPreferencesScreen from './(tabs)/travelPreferencesScreen';
import FoodPreferencesScreen from './(tabs)/foodPreferencesScreen';
import UserInfoSignUp from './(tabs)/userInfoSignUp';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { DemoProvider, useDemo } from '@/context/DemoContext';
import { SavedProvider } from '@/context/SavedContext';
import { TripPlanningProvider } from '@/context/TripPlanningContext';
import { MyTripsProvider } from '@/context/MyTripsContext';
import { useFonts } from 'expo-font';
import { getOnboardingProgress } from '@/utils/onboardingStorage';
import { userExists } from '@/hooks/useSaveUserProfile';
import OnboardingCompleteScreen from './(tabs)/onboardingCompleteScreen';
import BottomTabs from '../components/BottomTabs';
import { getUserProfile } from '@/utils/getUserProfile';
import ItineraryScreen from '@/components/ItineraryScreen';
import DestinationDetailScreen from '@/components/DestinationDetailScreen';
import AllDestinationsScreen from '@/components/AllDestinationsScreen';
import DestinationScreen from '@/components/DestinationScreen';
import TripPartyScreen from '@/components/tripPlanning/TripPartyScreen';
import TripDatesScreen from '@/components/tripPlanning/TripDatesScreen';
import TripInterestsScreen from '@/components/tripPlanning/TripInterestsScreen';
import TripBudgetScreen from '@/components/tripPlanning/TripBudgetScreen';
import TripReviewScreen from '@/components/tripPlanning/TripReviewScreen';
import ArticleWebViewScreen from '@/components/ArticleWebViewScreen';
import SearchScreen from '@/app/SearchScreen';
import ArticleDetailScreen from '@/components/ArticleDetailScreen';
import type { SearchedDestination } from '@/services/locationSearch';
import type { Article } from '@/types/article';

export type RootStackParamList = {
  OnboardingFirst: undefined;
  OnboardingSecond: undefined;
  OnboardingThird: undefined;
  Auth: undefined;
  SignIn: undefined;
  Index: undefined;
  SignUp: undefined;
  TravelPreferences: { fromSettings?: boolean } | undefined;
  FoodPreferences: { fromSettings?: boolean } | undefined;
  UserInfoSignUp: undefined;
  OnboardingComplete: undefined;
  ItineraryScreen: { id: string; source?: 'browse' | 'mytrips'; committedTripId?: string };
  DestinationDetail: { id: string };
  DestinationScreen: { id?: string; searchedDestination?: SearchedDestination };
  SearchScreen: undefined;
  TripParty: undefined;
  TripDates: undefined;
  TripInterests: undefined;
  TripBudget: undefined;
  TripReview: undefined;
  AllDestinations: undefined;
  ArticleDetail: { article: Article };
  ArticleWebView: { url: string; title: string; category: string };
};

const Stack = createStackNavigator<RootStackParamList>();

function DemoAwareAuth({ navigation }: any) {
  const { enableDemoMode } = useDemo();
  return (
    <AuthScreen
      onSignIn={() => navigation.navigate('SignIn')}
      onSignUp={() => navigation.navigate('SignUp')}
      onDemo={() => {
        enableDemoMode();
        navigation.navigate('Index');
      }}
    />
  );
}

export default function RootLayout() {
  const [initialRoute, setInitialRoute] = useState<keyof RootStackParamList | null>(null);

  useFonts({
    'SourceSans3-Regular': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-Regular.ttf'),
    'Merriweather_36pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_36pt-Bold.ttf'),
    'Merriweather_24pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_24pt-Bold.ttf'),
  });

  // JS-side configure runs after the bridge/JSI is ready. The native-side
  // configuration in AppDelegate.swift is the primary safeguard.
  useEffect(() => {
    const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
    GoogleSignin.configure({
      webClientId: extra.GOOGLE_WEB_CLIENT_ID || '588805144943-1f9uii64tqetroqlhvf7qltvaohku583.apps.googleusercontent.com',
      iosClientId: extra.GOOGLE_IOS_CLIENT_ID || '588805144943-7am9qr0jqsdmt478shb1ftjjas93lj4s.apps.googleusercontent.com',
    });
  }, []);

  useEffect(() => {
    async function checkFlags() {
      const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

      if (hasSeenOnboarding !== 'true') {
        setInitialRoute('OnboardingFirst');
        return;
      }

      const firebaseUser = getAuth().currentUser;

      if (!firebaseUser) {
        setInitialRoute('Auth');
        return;
      }

      const exists = await userExists(firebaseUser.uid);
      if (exists) {
        const uid = getAuth().currentUser?.uid;
        if (uid) {
          getUserProfile(uid);
        }
        setInitialRoute('Index');
        return;
      }

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

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f4f2ff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 32, color: '#6A62B7', fontWeight: 'bold', marginBottom: 24, letterSpacing: 0.5 }}>
          Wanderly
        </Text>
        <ActivityIndicator size="large" color="#6A62B7" />
      </View>
    );
  }

  return (
    <DemoProvider>
      <SavedProvider>
        <MyTripsProvider>
          <TripPlanningProvider>
            <OnboardingProvider>
              <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
                <Stack.Screen name="OnboardingFirst" component={OnboardingFirstPage} options={{ headerShown: false }} />
                <Stack.Screen name="OnboardingSecond" component={OnboardingSecondPage} options={{ headerShown: false }} />
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
                <Stack.Screen name="Auth" component={DemoAwareAuth} options={{ headerShown: false }} />
                <Stack.Screen
                  name="SignIn"
                  children={() => <SignInScreen onSignIn={async () => {}} />}
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="Index" component={BottomTabs} options={{ headerShown: false }} />
                <Stack.Screen
                  name="SignUp"
                  children={() => <SignUpscreen onSignUp={() => {}} />}
                  options={{ headerShown: false }}
                />
                <Stack.Screen name="TravelPreferences" component={TravelPreferencesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="FoodPreferences" component={FoodPreferencesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="UserInfoSignUp" component={UserInfoSignUp} options={{ headerShown: false }} />
                <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} options={{ headerShown: false }} />
                <Stack.Screen name="SearchScreen" component={SearchScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ItineraryScreen" component={ItineraryScreen} options={{ headerShown: false }} />
                <Stack.Screen name="DestinationDetail" component={DestinationDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="DestinationScreen" component={DestinationScreen} options={{ headerShown: false }} />
                <Stack.Screen name="AllDestinations" component={AllDestinationsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripParty" component={TripPartyScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripDates" component={TripDatesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripInterests" component={TripInterestsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripBudget" component={TripBudgetScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripReview" component={TripReviewScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ArticleWebView" component={ArticleWebViewScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
            </OnboardingProvider>
          </TripPlanningProvider>
        </MyTripsProvider>
      </SavedProvider>
    </DemoProvider>
  );
}
