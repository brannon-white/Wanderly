import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet } from 'react-native';
import CountryPicker from 'react-native-country-picker-modal';
import { styles } from '@/styles/userInfoSignUpStyles';
import type { Country } from 'react-native-country-picker-modal';
import { useOnboarding } from '@/context/OnboardingContext';


export default function UserInfoSignUp() {
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const { fullName, setFullName, country, setCountry, phone, setPhone } = useOnboarding();

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBarWrapper}>
        <View style={styles.progressBarBg} />
        <View style={styles.progressBarFill} />
      </View>

      <Text style={styles.heading}>
        Add a personal touch <Text style={styles.headingEmoji}>🧑‍💼</Text>
      </Text>
      <Text style={styles.subheading}>
        To enhance your travel journey, we'd love to know more about you.
      </Text>

      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        <Image
          source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
          style={styles.avatar}
        />
        <TouchableOpacity style={styles.editIcon}>
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
    <Text style={styles.flag}>
      {typeof country?.flag === 'string' && country.flag.length <= 4
        ? country.flag
        : '🇺🇸'}
    </Text>
  </View>
</TouchableOpacity>
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
  withCountryNameButton
/>

      {/* Phone Number */}
      <Text style={styles.label}>Phone Number</Text>
<View style={styles.phoneRow}>
  {/* Remove this line if you don't want the flag here */}
  {/* <Text style={styles.flag}>
    {typeof country?.flag === 'string' && country?.flag.length <= 4
      ? country.flag
      : '🇺🇸'}
  </Text> */}
  <TextInput
    style={[styles.input, { flex: 1, marginLeft: 8 }]}
    placeholder="+1 000 000 000"
    placeholderTextColor="#aaa"
    keyboardType="phone-pad"
    value={phone}
    onChangeText={setPhone}
  />
</View>

      {/* Continue Button */}
      <TouchableOpacity style={styles.continueButton}>
        <Text style={styles.continueButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};