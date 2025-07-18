import { Image } from 'expo-image';
import { View, TouchableOpacity, Text } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { useFonts } from 'expo-font';
import { styles } from '@/styles/styles';

type OnboardingThirdPageProps = {
  onFinish?: () => void;
};

export default function OnboardingThirdPage({ onFinish }: OnboardingThirdPageProps) {
  const [fontsLoaded] = useFonts({
    'SourceSans3-Regular': require('@/assets/fonts/Source_Sans_3/static/SourceSans3-Regular.ttf'),
    'Merriweather_36pt-Bold': require('@/assets/fonts/Merriweather/static/Merriweather_36pt-Bold.ttf'),
  }); 

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.imageWrapper}>
        <Image
          source={require('@/assets/images/OnboardingParrot.png')}
          style={styles.image}
          contentFit="cover"
        />
      </View>
      <Text style={styles.heading}>
        Save and Share {'\n'}Your Trips
      </Text>
      <Text style={styles.subtitle}>
        Save your itinerary, share it with friends, or revisit it later. Wanderly helps you stay organized and travel smarter.
      </Text>
      <View style={styles.thirdPageButtonRow}>
        <TouchableOpacity
          style={styles.thirdPageButton}
          activeOpacity={0.8}
          onPress={onFinish}
        >
        <Text style={styles.letsGoText}>Let's Go! {'\u2794'}</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}