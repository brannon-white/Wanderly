import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { useDemo } from '@/context/DemoContext';

const DEMO_SCREENS: { label: string; screen: keyof RootStackParamList; params?: any }[] = [
  { label: 'Discover (Main App)', screen: 'Index' },
  { label: 'Destination Detail', screen: 'DestinationDetail', params: { id: 'demo-dest-1' } },
  { label: 'Auth', screen: 'Auth' },
  { label: 'Sign In', screen: 'SignIn' },
  { label: 'Sign Up', screen: 'SignUp' },
  { label: 'Onboarding — Welcome', screen: 'OnboardingFirst' },
  { label: 'Onboarding — Step 2', screen: 'OnboardingSecond' },
  { label: 'Onboarding — Step 3', screen: 'OnboardingThird' },
  { label: 'Travel Preferences', screen: 'TravelPreferences' },
  { label: 'Food Preferences', screen: 'FoodPreferences' },
  { label: 'User Info Sign Up', screen: 'UserInfoSignUp' },
  { label: 'Onboarding Complete', screen: 'OnboardingComplete' },
  { label: 'Itinerary Detail', screen: 'ItineraryScreen', params: { id: 'demo-itin-1' } },
];

export default function DemoNavigator() {
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { disableDemoMode } = useDemo();

  const navigateTo = (screen: keyof RootStackParamList, params?: any) => {
    setVisible(false);
    navigation.navigate(screen as any, params);
  };

  const exitDemo = () => {
    setVisible(false);
    disableDemoMode();
    navigation.navigate('Auth');
  };

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setVisible(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>DEMO</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setVisible(false)} activeOpacity={1}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Demo Navigation</Text>
            <Text style={styles.panelSubtitle}>Jump to any screen</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {DEMO_SCREENS.map(({ label, screen, params }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.screenBtn}
                  onPress={() => navigateTo(screen, params)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.screenBtnText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.exitBtn} onPress={exitDemo} activeOpacity={0.85}>
              <Text style={styles.exitBtnText}>Exit Demo Mode</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 16,
    backgroundColor: '#6A62B7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  screenBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f4ff',
    marginBottom: 8,
  },
  screenBtnText: {
    color: '#6A62B7',
    fontSize: 15,
    fontWeight: '600',
  },
  exitBtn: {
    paddingVertical: 14,
    borderRadius: 32,
    backgroundColor: '#ff4d4d',
    alignItems: 'center',
  },
  exitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
