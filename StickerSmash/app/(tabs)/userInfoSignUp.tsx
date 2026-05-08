import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView } from 'react-native';
import CountryPicker from 'react-native-country-picker-modal';
import { styles } from '@/styles/userInfoSignUpStyles';
import { useOnboarding } from '@/context/OnboardingContext';
import * as ImagePicker from 'expo-image-picker';
import { getAuth } from '@react-native-firebase/auth';
import { getOnboardingStepData, clearOnboardingProgress } from '@/utils/onboardingStorage';
import { saveUserProfile } from '@/hooks/useSaveUserProfile';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/_layout';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDemo } from '@/context/DemoContext';


export default function UserInfoSignUp() {
  const { isDemoMode } = useDemo();
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  
  const {
    fullName, setFullName,
    country, setCountry,
    phone, setPhone,
    activityPreferences,
    foodPreferences,
  } = useOnboarding();

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true, // <-- Add this line
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    setAvatarUri(result.assets[0].uri);
    setAvatarBase64(result.assets[0].base64 || null);
  }
};
  
  return (
<SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
  {/* Top Bar with Back Arrow and Progress Bar */}
  <View style={styles.topBar}>
    <TouchableOpacity
      style={styles.backArrow}
      onPress={() => navigation.navigate('FoodPreferences')}
      hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}
    >
      <Ionicons name="chevron-back" size={28} color="#222" />
    </TouchableOpacity>
    <View style={styles.progressBarAbsoluteContainer}>
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBg} />
        <View style={styles.progressBarFill} />
      </View>
    </View>
  </View>

  <View style={[styles.container, { flex: 1 }]}>
    <Text style={styles.heading}>
      Add a personal touch <Text style={styles.headingEmoji}>🧑‍💼</Text>
    </Text>
    <Text style={styles.subheading}>
      To enhance your travel journey, we'd love to know more about you.
    </Text>

    {/* Avatar */}
    <View style={styles.avatarWrapper}>
      <Image
        source={
          avatarUri
            ? { uri: avatarUri }
            : require('@/assets/images/OnboardingPurpleBinoculars.png')
        }
        style={styles.avatar}
      />
      <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
        <Text style={{ color: '#fff', fontSize: 16 }}>✏️</Text>
      </TouchableOpacity>
    </View>

    {/* Full Name */}
    <Text style={styles.label}>Full Name</Text>
    <TextInput
      style={styles.input}
      placeholder="Full Name"
      placeholderTextColor="#aaa"
      value={fullName}
      onChangeText={setFullName}
    />

    {/* Country */}
    <Text style={styles.label}>Country</Text>
    <TouchableOpacity
      style={styles.input}
      onPress={() => setShowCountryPicker(true)}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: country ? '#222' : '#aaa', fontSize: 18 }}>
          {typeof country?.name === 'string' ? country.name : 'Country'}
        </Text>
      </View>
    </TouchableOpacity>
    {showCountryPicker && (
      <CountryPicker
        countryCode={country?.cca2 || 'US'}
        visible={showCountryPicker}
        onSelect={c => {
          setCountry(c);
          setShowCountryPicker(false);
        }}
        onClose={() => setShowCountryPicker(false)}
        withFlag
        withFilter
        withCountryNameButton={false}
      />
    )}

    {/* Phone Number */}
    <Text style={styles.label}>Phone Number</Text>
    <View style={styles.phoneRow}>
      <TextInput
        style={[styles.input, { flex: 1, marginLeft: 8 }]}
        placeholder="+1 000 000 000"
        placeholderTextColor="#aaa"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
    </View>
  </View>

  {/* Continue Button at the bottom */}
  <TouchableOpacity
    style={styles.continueButton}
onPress={async () => {
  if (isDemoMode) {
    navigation.navigate('OnboardingComplete');
    return;
  }

  const activityPreferences = await getOnboardingStepData('travel');
  const foodPreferences = await getOnboardingStepData('food');

  const profile = {
    avatarBase64,
    fullName,
    country,
    phone,
    activityPreferences: activityPreferences || [],
    foodPreferences: foodPreferences || [],
  };

  await saveUserProfile(profile);

  const uid = getAuth().currentUser?.uid;
  if (uid) {
    await AsyncStorage.setItem(`userProfile_${uid}`, JSON.stringify(profile));
  }

  await clearOnboardingProgress();
  navigation.navigate('OnboardingComplete');
}}
  >
    <Text style={styles.continueButtonText}>Continue</Text>
  </TouchableOpacity>
</SafeAreaView>
  );
}