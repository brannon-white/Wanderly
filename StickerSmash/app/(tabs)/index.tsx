import { Image } from 'expo-image';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useFonts } from 'expo-font';

export default function HomeScreen() {
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
          source={require('@/assets/images/onboarding-illustration.png')}
          style={styles.image}
          contentFit="cover"
        />
      </View>
      <Text style={styles.heading}>
        Welcome to{'\n'}Wanderly!
      </Text>
      <Text style={styles.subtitle}>
        Let AI plan your perfect trip. Just share your destination, dates, and interests, and we’ll build a personalized itinerary just for you.
      </Text>
      <View style={styles.pagination}>
        <View style={styles.dotActive} />
        <View style={styles.dot} />
      </View>
      <TouchableOpacity style={styles.buttonWrapper} activeOpacity={0.8}>
        <IconSymbol
          name="chevron.forward"
          size={28}
          color="#fff"
          style={styles.arrowIcon}
        />
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heading: {
    color: '#2C2C2C',
    fontFamily: 'Merriweather_36pt-Bold',
    fontSize: 36,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: undefined,
    marginTop: 8,
    marginBottom: 12,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  subtitle: {
    color: '#2C2C2C',
    fontFamily: 'SourceSans3-Regular', // match the key in useFonts
    fontSize: 20,
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: 32,
    marginBottom: 32,
    textAlign: 'left',
    alignSelf: 'flex-start',
    
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    alignSelf: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6A62B7',
    marginHorizontal: 4,
  },
  buttonWrapper: {
    backgroundColor: '#6A62B7',
    borderRadius: 24,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  arrowIcon: {
    color: '#6A62B7',
  },
});