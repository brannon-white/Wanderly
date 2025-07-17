import React from 'react';
import { View, Text, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/_layout';
import type { StackNavigationProp } from '@react-navigation/stack';
import { styles } from '@/styles/onboardingCompleteStyles';

export default function OnboardingCompleteScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.iconWrapper}>
          <Image
            source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
            style={styles.icon}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.heading}>You're all set!</Text>
        <Text style={styles.subheading}>
          Congratulations! You're now part of the Wanderly community. Your personalized travel experiences await.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Index')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Explore Destinations</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}