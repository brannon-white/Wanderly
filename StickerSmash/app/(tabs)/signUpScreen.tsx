import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, TextInput, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { GoogleSignin, GoogleSigninButton, statusCodes } from '@react-native-google-signin/google-signin';
import { getAuth, createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from '@react-native-firebase/auth';
import { styles } from '@/styles/signUpStyles';
import { useDemo } from '@/context/DemoContext';
import { userExists } from '@/hooks/useSaveUserProfile';
import { getOnboardingStepData } from '@/utils/onboardingStorage';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout'; // adjust path if nee
import { useOnboarding } from '@/context/OnboardingContext';
export default function SignUpScreen({ onSignUp }: { onSignUp?: () => void }) {
  const { isDemoMode } = useDemo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

async function signUpWithEmail() {
  if (password !== confirmPassword) {
    Alert.alert('Error', 'Passwords do not match.');
    return;
  }
  setLoading(true);
  try {
    const result = await createUserWithEmailAndPassword(getAuth(), email, password);
    const uid = result.user.uid;
    const exists = await userExists(uid);

    const travel = await getOnboardingStepData('travel');
    const food = await getOnboardingStepData('food');

    if (exists) {
      navigation.navigate('Index');
    } else if (food) {
      navigation.navigate('UserInfoSignUp');
    } else if (travel) {
      navigation.navigate('FoodPreferences');
    } else {
      navigation.navigate('TravelPreferences');
    }
    // Remove: onSignUp?.();
  } catch (error: any) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
}

async function signUpWithGoogle() {
  setLoading(true);
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    const idToken = (response as any)?.data?.idToken ?? (response as any)?.idToken;
    if (!idToken) {
      return;
    }
    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(getAuth(), googleCredential);

    const uid = result.user.uid;
    const exists = await userExists(uid);
    const travel = await getOnboardingStepData('travel');
    const food = await getOnboardingStepData('food');

    if (exists) {
      navigation.navigate('Index');
    } else if (food) {
      navigation.navigate('UserInfoSignUp');
    } else if (travel) {
      navigation.navigate('FoodPreferences');
    } else {
      navigation.navigate('TravelPreferences');
    }
  } catch (error: any) {
    if (error.code !== statusCodes.SIGN_IN_CANCELLED) {
      Alert.alert('Error', error.message);
    }
  } finally {
    setLoading(false);
  }
}

  return (
    <ImageBackground
      source={require('@/assets/images/OnboardingSloth.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      {isDemoMode && (
        <TouchableOpacity style={demoStyles.banner} onPress={() => navigation.navigate('Index')} activeOpacity={0.85}>
          <Text style={demoStyles.bannerText}>Demo Mode — tap to skip to main app</Text>
        </TouchableOpacity>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topHeadingWrapper}>
            <Text style={styles.heading}>Ready to{'\n'}Wander?</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={styles.card}>
            <Text style={styles.subheading}>New{'\n'}Account</Text>
            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={signUpWithGoogle}
              disabled={loading}
            />
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.orText}>Or</Text>
              <View style={styles.divider} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>📧</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#aaa"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#aaa"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#aaa"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={signUpWithEmail}
              disabled={loading}
            >
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>
            {loading && <ActivityIndicator size="large" color="#7c5cff" style={{ marginTop: 8 }} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const demoStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    backgroundColor: '#6A62B7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 10,
    alignItems: 'center',
  },
  bannerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});