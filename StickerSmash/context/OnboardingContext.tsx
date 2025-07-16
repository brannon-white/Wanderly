import React, { createContext, useContext, useState } from 'react';
import type { Country } from 'react-native-country-picker-modal';

type OnboardingData = {
  activityPreferences: string[];
  foodPreferences: string[];
  fullName: string;
  country: Country | null;
  phone: string;
  setActivityPreferences: (prefs: string[]) => void;
  setFoodPreferences: (prefs: string[]) => void;
  setFullName: (name: string) => void;
  setCountry: (country: Country | null) => void;
  setPhone: (phone: string) => void;
};

const OnboardingContext = createContext<OnboardingData | undefined>(undefined);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activityPreferences, setActivityPreferences] = useState<string[]>([]);
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]);
  const [fullName, setFullName] = useState<string>('');
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState<string>('');

  return (
    <OnboardingContext.Provider value={{
      activityPreferences,
      foodPreferences,
      fullName,
      country,
      phone,
      setActivityPreferences,
      setFoodPreferences,
      setFullName,
      setCountry,
      setPhone,
    }}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
};