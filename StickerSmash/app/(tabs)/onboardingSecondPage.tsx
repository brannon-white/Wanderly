import { Image } from 'expo-image';
import { View, TouchableOpacity, Text } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { useFonts } from 'expo-font';
import { styles } from '@/styles/styles';
import { useNavigation } from '@react-navigation/native';


type OnboardingSecondPageProps = {
  onNext?: () => void;
};

export default function OnboardingSecondPage({ onNext }: OnboardingSecondPageProps) {
      const navigation = useNavigation();

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
          source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
          style={styles.image}
          contentFit="cover"
        />
      </View>
      <Text style={styles.heading}>
        Explore Popular{'\n'}Destinations!
      </Text>
      <Text style={styles.subtitle}>
          Not sure where to go? Browse popular cities and pre-made itineraries to get inspired and start your adventure!
      </Text>
      <View style={styles.paginationRow}>
        <View style={styles.pagination}>
          <View style={styles.dot} />
          <View style={styles.dotActive} />
          <View style={styles.dot} />
        </View>
        <TouchableOpacity
          style={styles.buttonWrapper}
          activeOpacity={0.8}
          onPress={() => (navigation as any).navigate('OnboardingThird')}
        >
          <Text style={styles.arrowText}>{'\u2794'}</Text>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}