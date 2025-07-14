import React, { useEffect, useState } from 'react';
// Remove Slot import
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingFirstPage from './(tabs)/onboardingFirstPage';
import OnboardingSecondPage from './(tabs)/onboardingSecondPage';
import OnboardingThirdPage from './(tabs)/onboardingThirdPage';
import AuthScreen from './(tabs)/authScreen';
import SignInScreen from './(tabs)/signInScreen';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding').then(flag => {
      setShowOnboarding(flag !== 'true');
    });
    AsyncStorage.getItem('isSignedIn').then(flag => {
      setIsSignedIn(flag === 'true');
    });
  }, []);

  if (showOnboarding === null || isSignedIn === null) return null;

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

  if (showSignIn) {
    return (
      <SignInScreen
        onSignIn={async () => {
          await AsyncStorage.setItem('isSignedIn', 'true');
          setIsSignedIn(true);
          setShowSignIn(false);
        }}
      />
    );
  }

  if (!isSignedIn) {
    return (
      <AuthScreen
        onSignIn={() => setShowSignIn(true)}
        onSignUp={() => {
          // handle sign up navigation here if needed
        }}
      />
    );
  }

  // Render children (your main app screens)
  return <>{children}</>;
}