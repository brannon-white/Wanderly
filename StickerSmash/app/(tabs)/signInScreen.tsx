import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, TextInput, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { styles } from '@/styles/signInScreenStyles';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithCredential, signOut as firebaseSignOut, GoogleAuthProvider } from '@react-native-firebase/auth';
import { useDemo } from '@/context/DemoContext';
import Constants from 'expo-constants';
import { userExists } from '@/hooks/useSaveUserProfile';
import { getOnboardingStepData } from '@/utils/onboardingStorage';
import { GoogleSignin,statusCodes,GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '@/app/_layout'; // adjust path 
const expoExtra = (Constants.expoConfig?.extra ?? {}) as {
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
};

if (expoExtra.GOOGLE_WEB_CLIENT_ID && expoExtra.GOOGLE_IOS_CLIENT_ID) {
  GoogleSignin.configure({
    // Web client ID used for Firebase backend authentication
    webClientId: expoExtra.GOOGLE_WEB_CLIENT_ID,
    // iOS client ID for native Google Sign-In SDK
    iosClientId: expoExtra.GOOGLE_IOS_CLIENT_ID,
  });
} else {
  console.warn('Google Sign-In client IDs are missing from Expo extra config.');
}

export default function SignInScreen({ onSignIn }: { onSignIn?: () => void }) {
  const { isDemoMode } = useDemo();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), firebaseUser => {
      setUser(firebaseUser);

    });
    return subscriber;
  }, []);
  
async function signInWithEmail() {
  setLoading(true);
  try {
    const result = await signInWithEmailAndPassword(getAuth(), email, password);
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
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
}
async function signInWithGoogle() {
  setLoading(true);
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    // Support both v12 (response.idToken) and v13+ (response.data.idToken)
    const idToken = (response as any)?.data?.idToken ?? (response as any)?.idToken;
    if (!idToken) {
      // User cancelled — not an error
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
      Alert.alert('Sign-in Error', error.message);
    }
  } finally {
    setLoading(false);
  }
}

  async function handleSignOut() {
    try {
      await GoogleSignin.revokeAccess();
      await firebaseSignOut(getAuth());
      Alert.alert('Signed Out', 'You have been signed out.');
    } catch (error: any) {
      Alert.alert('Error', `Could not sign out: ${error.message}`);
    }
  }

  return (
    <ImageBackground
      source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      {isDemoMode && (
        <TouchableOpacity style={demoStyles.banner} onPress={() => navigation.navigate('Index')} activeOpacity={0.85}>
          <Text style={demoStyles.bannerText}>Demo Mode — tap to skip to main app</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.heading}>
        Ready to{'\n'}Wander?
      </Text>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome{'\n'}Back</Text>
          {user ? (
            <View>
              <Text style={styles.label}>Signed in as: {user.displayName || user.email}</Text>
              <TouchableOpacity style={styles.signInButton} onPress={handleSignOut}>
                <Text style={styles.signInButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <GoogleSigninButton
                style={styles.googleButton}
                size={GoogleSigninButton.Size.Wide}
                color={GoogleSigninButton.Color.Light}
                onPress={signInWithGoogle}
                disabled={loading}
              />
              {loading && <ActivityIndicator size="large" color="#0000ff" />}
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.orText}>Or</Text>
                <View style={styles.divider} />
              </View>
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
              <TouchableOpacity style={styles.signInButton} onPress={signInWithEmail}>
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
