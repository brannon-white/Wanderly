import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { useNavigationContainerRef } from 'expo-router';
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
import TripBasicsScreen from '@/components/tripPlanning/TripBasicsScreen';
import TripDatesScreen from '@/components/tripPlanning/TripDatesScreen';
import TripStyleScreen from '@/components/tripPlanning/TripStyleScreen';
import TripPreferencesScreen from '@/components/tripPlanning/TripPreferencesScreen';
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
  TripBasics: undefined;
  TripDates: undefined;
  TripStyle: undefined;
  TripPreferences: undefined;
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
  const navigationRef = useNavigationContainerRef();
  const pendingItineraryId = useRef<string | null>(null);

  useFonts({
    'SourceSans3-Regular': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-Regular.ttf'),
    'SourceSans3-SemiBold': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-SemiBold.ttf'),
    'SourceSans3-Bold': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-Bold.ttf'),
    'Merriweather_36pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_36pt-Bold.ttf'),
    'Merriweather_24pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_24pt-Bold.ttf'),
  });

  // Handle notification tap when app is in background (not quit)
  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      const itineraryId = remoteMessage.data?.itineraryId as string | undefined;
      if (itineraryId && navigationRef.isReady()) {
        (navigationRef as any).navigate('ItineraryScreen', {
          id: itineraryId,
          source: 'mytrips',
          committedTripId: remoteMessage.data?.committedTripId as string | undefined,
        });
      }
    });
    return unsubscribe;
  }, [navigationRef]);

  // Store itinerary ID from quit-state notification tap; navigate once route is resolved
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        const itineraryId = remoteMessage?.data?.itineraryId as string | undefined;
        if (itineraryId) {
          pendingItineraryId.current = itineraryId;
        }
      });
  }, []);

  useEffect(() => {
    if (!initialRoute || initialRoute !== 'Index' || !pendingItineraryId.current) return;
    const id = pendingItineraryId.current;
    pendingItineraryId.current = null;
    setTimeout(() => {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('ItineraryScreen', { id, source: 'mytrips' });
      }
    }, 500);
  }, [initialRoute, navigationRef]);

  // Handle wanderly://itinerary/:id deep links
  useEffect(() => {
    const navigate = (url: string) => {
      const match = url.match(/^wanderly:\/\/itinerary\/(.+)$/);
      if (match && navigationRef.isReady()) {
        (navigationRef as any).navigate('ItineraryScreen', { id: match[1], source: 'browse' });
      }
    };
    Linking.getInitialURL().then(url => { if (url) navigate(url); });
    const sub = Linking.addEventListener('url', ({ url }) => navigate(url));
    return () => sub.remove();
  }, [navigationRef]);

  // JS-side configure runs after the bridge/JSI is ready. The native-side
  // configuration in AppDelegate.swift is the primary safeguard.
  useEffect(() => {
    const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
    GoogleSignin.configure({
      webClientId: extra.GOOGLE_WEB_CLIENT_ID || '588805144943-1f9uii64tqetroqlhvf7qltvaohku583.apps.googleusercontent.com',
      iosClientId: extra.GOOGLE_IOS_CLIENT_ID || '588805144943-7am9qr0jqsdmt478shb1ftjjas93lj4s.apps.googleusercontent.com',
    });
    // Initialize RevenueCat after the JS bridge is ready
    import('@/services/purchases').then(({ initPurchases }) => initPurchases());
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                <Stack.Screen name="TripBasics" component={TripBasicsScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripDates" component={TripDatesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripStyle" component={TripStyleScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripPreferences" component={TripPreferencesScreen} options={{ headerShown: false }} />
                <Stack.Screen name="TripReview" component={TripReviewScreen} options={{ headerShown: false }} />
                <Stack.Screen name="ArticleWebView" component={ArticleWebViewScreen} options={{ headerShown: false }} />
              </Stack.Navigator>
            </OnboardingProvider>
          </TripPlanningProvider>
        </MyTripsProvider>
      </SavedProvider>
    </DemoProvider>
    </GestureHandlerRootView>
  );
}
