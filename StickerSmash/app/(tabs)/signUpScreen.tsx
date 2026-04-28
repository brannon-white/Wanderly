import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, TextInput, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
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
    const result = await auth().createUserWithEmailAndPassword(email, password);
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
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const googleUser = await GoogleSignin.signIn();
    // @ts-ignore
    if (!googleUser.data.idToken) {
      throw new Error('No idToken returned from Google Sign-In.');
    }
    // @ts-ignore
    const googleCredential = auth.GoogleAuthProvider.credential(googleUser.data.idToken);
    const result = await auth().signInWithCredential(googleCredential);

    const uid = result.user.uid;
    const exists = await userExists(uid);
    console.log('User exists:', exists);
    console.log('User ID:', uid);
const travel = await getOnboardingStepData('travel');
const food = await getOnboardingStepData('food');

if (exists) {
    console.log('Navigating to Index');

  navigation.navigate('Index');

} else if (food) {
  navigation.navigate('UserInfoSignUp');
} else if (travel) {
  navigation.navigate('FoodPreferences');
} else {
  navigation.navigate('TravelPreferences');
}
    onSignUp?.();
  } catch (error: any) {
    Alert.alert('Error', error.message);
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
      <View style={styles.topHeadingWrapper}>
        <Text style={styles.heading}>Ready to{'\n'}Wander?</Text>
      </View>
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