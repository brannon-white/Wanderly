import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, TextInput, Alert, ActivityIndicator } from 'react-native';
import { styles } from '@/styles/signInScreenStyles';
import auth from '@react-native-firebase/auth';
import { GoogleSignin,statusCodes,GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@env';

GoogleSignin.configure({
  // This is your Web client ID, used for Firebase backend authentication
  webClientId: '588805144943-7am9qr0jqsdmt478shb1ftjjas93lj4s.apps.googleusercontent.com',
  // This is your iOS client ID, which the native Google Sign-In SDK needs
  // It's usually the 'reversed client ID' or the 'CLIENT_ID' from your GoogleService-Info.plist
  iosClientId: '588805144943-7am9qr0jqsdmt478shb1ftjjas93lj4s.apps.googleusercontent.com',
  // Uncomment the line below if you need offline access (e.g., to get a refresh token)
  // offlineAxccess: true,
});

export default function SignInScreen({ onSignIn }: { onSignIn?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(firebaseUser => {
      setUser(firebaseUser);

    });
    return subscriber;
  }, []);
  
async function signInWithEmail() {
  setLoading(true);
  try {
    await auth().signInWithEmailAndPassword(email, password);
    onSignIn?.(); // Only after successful sign-in
  } catch (error: any) {
    Alert.alert('Error', error.message); // This will show error if sign-in fails
  } finally {
    setLoading(false);
  }
}
async function signInWithGoogle() {
  setLoading(true);
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const googleUser = await GoogleSignin.signIn();
    console.log('Google user object:', googleUser);
    if (!googleUser.data.idToken) {
      throw new Error('No idToken returned from Google Sign-In. Check scopes or user consent.');
    }
    const idTokenString: string = googleUser.data.idToken;
    const googleCredential = auth.GoogleAuthProvider.credential(idTokenString);
    await auth().signInWithCredential(googleCredential);
    onSignIn?.(); // <-- Add this line to navigate after successful sign-in
  } catch (error: any) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
}

  async function signOut() {
    try {
      await GoogleSignin.revokeAccess();
      await auth().signOut();
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
      <Text style={styles.heading}>
        Ready to{'\n'}Wander?
      </Text>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome{'\n'}Back</Text>
        {user ? (
          <View>
            <Text style={styles.label}>Signed in as: {user.displayName || user.email}</Text>
            <TouchableOpacity style={styles.signInButton} onPress={signOut}>
              <Text style={styles.signInButtonText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        ) :(
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
    </ImageBackground>
  )};