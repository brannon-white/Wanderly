import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ImageBackground, TextInput, Alert, ActivityIndicator } from 'react-native';
import { styles } from '@/styles/signInScreenStyles';
import auth from '@react-native-firebase/auth';
import { GoogleSignin,statusCodes,GoogleSigninButton } from '@react-native-google-signin/google-signin';


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

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(firebaseUser => {
      setUser(firebaseUser);
      if (firebaseUser) {
        onSignIn?.();
      }
    });
    return subscriber;
  }, []);

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
      // Navigate to index page after successful sign-in
    } catch (error: any) {
      // ...error handling...
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
              color={GoogleSigninButton.Color.Dark}
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
              />
            </View>
            <TouchableOpacity style={styles.signInButton} onPress={onSignIn}>
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ImageBackground>
  )};