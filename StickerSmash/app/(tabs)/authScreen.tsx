import { View, Text, TouchableOpacity, ImageBackground } from 'react-native';
import { styles } from '@/styles/authScreenStyles';

export default function AuthScreen({ onSignIn, onSignUp }: { onSignIn?: () => void; onSignUp?: () => void }) {
  return (
    <ImageBackground
      source={require('@/assets/images/OnboardingPurpleBinoculars.png')} // Replace with your background image path
      style={styles.background}
      imageStyle={styles.backgroundImage}
    >
      <Text style={styles.heading}>
        Ready to{'\n'}Wander?
      </Text>
      <TouchableOpacity style={styles.signUpButton} onPress={onSignUp} activeOpacity={0.85}>
        <Text style={styles.signUpText}>Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signInButton} onPress={onSignIn} activeOpacity={0.85}>
        <Text style={styles.signInText}>Sign In</Text>
      </TouchableOpacity>
    </ImageBackground>
  );
}