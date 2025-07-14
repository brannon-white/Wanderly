import { View, Text, TouchableOpacity, ImageBackground, TextInput } from 'react-native';
import { styles } from '@/styles/signInScreenStyles';

export default function SignInScreen({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <ImageBackground
      source={require('@/assets/images/OnboardingPurpleBinoculars.png')} // Use your background image path
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <Text style={styles.heading}>
        Ready to{'\n'}Wander?
      </Text>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome{'\n'}Back</Text>
        <TouchableOpacity style={styles.googleButton}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>
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
            defaultValue="brannonwhite01@gmail.com"
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
            defaultValue="password"
          />
        </View>
        <TouchableOpacity style={styles.signInButton} onPress={onSignIn}>
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}