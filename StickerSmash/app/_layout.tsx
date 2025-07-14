import React, { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingFirstPage from './(tabs)/onboardingFirstPage';
import OnboardingSecondPage from './(tabs)/onboardingSecondPage';
import OnboardingThirdPage from './(tabs)/onboardingThirdPage';
import AuthScreen from './(tabs)/authScreen';

export default function RootLayout() {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding').then(flag => {
      setShowOnboarding(flag !== 'true');
    });
    AsyncStorage.getItem('isSignedIn').then(flag => {
      setIsSignedIn(flag === 'true');
    });
  }, []);

  if (showOnboarding === null || isSignedIn === null) return null; // Or a loading spinner

  if (showOnboarding) {
    if (onboardingStep === 1) {
      return <OnboardingFirstPage onNext={() => setOnboardingStep(2)} />;
    }
    if (onboardingStep === 2) {
      return <OnboardingSecondPage onNext={() => setOnboardingStep(3)} />;
    }
    if (onboardingStep === 3) {
      return (
        <OnboardingThirdPage
          onFinish={async () => {
            await AsyncStorage.setItem('hasSeenOnboarding', 'true');
            setShowOnboarding(false);
          }}
        />
      );
    }
  }

  if (!isSignedIn) {
    return (
      <AuthScreen
        onSignIn={async () => {
          await AsyncStorage.setItem('isSignedIn', 'true');
          setIsSignedIn(true);
        }}
      />
    );
  }

  return <Slot />;
}