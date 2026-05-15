import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import CountryPicker from 'react-native-country-picker-modal';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserProfile } from '@/utils/getUserProfile';
import { updateUserInfo } from '@/utils/updateUserInfo';
import { useDemo } from '@/context/DemoContext';
import { clearAllCache } from '@/utils/cache';
import { styles } from '@/styles/profileScreenStyles';

type ProfileData = {
  fullName?: string;
  email?: string;
  avatarUrl?: string;
  phone?: string;
  country?: string;
  countryCode?: string;
  activityPreferences?: string[];
  foodPreferences?: string[];
};

export default function ProfileScreen() {
  const { isDemoMode, disableDemoMode } = useDemo();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCountry, setEditCountry] = useState<any>(null);
  const [editAvatarUri, setEditAvatarUri] = useState<string | null>(null);
  const [editAvatarBase64, setEditAvatarBase64] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    if (isDemoMode) {
      setProfile({
        fullName: 'Demo User',
        email: 'demo@wanderly.app',
        avatarUrl: '',
        phone: '',
        country: 'United States',
        countryCode: 'US',
        activityPreferences: ['Hiking', 'Beach', 'Culture'],
        foodPreferences: ['Italian', 'Japanese'],
      });
      setLoading(false);
      return;
    }

    const user = getAuth().currentUser;
    if (!user) { setLoading(false); return; }

    try {
      const data = await getUserProfile(user.uid);
      setProfile(data as ProfileData);
    } catch {
      const cached = await AsyncStorage.getItem(`userProfile_${user.uid}`);
      if (cached) setProfile(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const openEditModal = () => {
    if (!profile) return;
    setEditName(profile.fullName || '');
    setEditPhone(profile.phone || '');
    setEditCountry(profile.countryCode ? { name: profile.country, cca2: profile.countryCode } : null);
    setEditAvatarUri(profile.avatarUrl || null);
    setEditAvatarBase64(null);
    setShowEditModal(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setEditAvatarUri(result.assets[0].uri);
      setEditAvatarBase64(result.assets[0].base64 || null);
    }
  };

  const handleSaveProfile = async () => {
    if (isDemoMode) { setShowEditModal(false); return; }
    setSaving(true);
    try {
      await updateUserInfo({ fullName: editName, country: editCountry, phone: editPhone, avatarBase64: editAvatarBase64 });
      await loadProfile();
      setShowEditModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            if (isDemoMode) {
              disableDemoMode();
            } else {
              const uid = getAuth().currentUser?.uid;
              await clearAllCache();
              if (uid) await AsyncStorage.removeItem(`userProfile_${uid}`);
              await getAuth().signOut();
            }
            navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A62B7" />
      </View>
    );
  }

  const displayName = profile?.fullName || 'Traveler';
  const displayEmail = isDemoMode ? 'Demo Mode' : (getAuth().currentUser?.email || '');

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Page Title ── */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Card ── */}
        <TouchableOpacity style={styles.profileCard} onPress={openEditModal} activeOpacity={0.85}>
          <View style={styles.profileCardLeft}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.profileAvatarPlaceholder}>
                <Text style={styles.profileAvatarInitials}>{getInitials(displayName)}</Text>
              </View>
            )}
            <View style={styles.profileCardText}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#bdbdbd" />
        </TouchableOpacity>

        {/* ── Preferences ── */}
        <View style={styles.section}>
          <SettingsRow
            icon="compass-outline"
            label="Travel Preferences"
            subtitle={profile?.activityPreferences?.length ? profile.activityPreferences.slice(0, 3).join(', ') : undefined}
            onPress={() => navigation.navigate('TravelPreferences', { fromSettings: true })}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="restaurant-outline"
            label="Food Preferences"
            subtitle={profile?.foodPreferences?.length ? profile.foodPreferences.slice(0, 3).join(', ') : undefined}
            onPress={() => navigation.navigate('FoodPreferences', { fromSettings: true })}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="person-outline"
            label="Personal Info"
            onPress={openEditModal}
          />
        </View>

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color="#E53935" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowEditModal(false)} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Personal Info</Text>
                <TouchableOpacity onPress={handleSaveProfile} disabled={saving} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
                  {saving
                    ? <ActivityIndicator size="small" color="#6A62B7" />
                    : <Text style={styles.modalSave}>Save</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.modalAvatarContainer} onPress={pickImage} activeOpacity={0.8}>
                  {editAvatarUri ? (
                    <Image source={{ uri: editAvatarUri }} style={styles.modalAvatar} />
                  ) : (
                    <View style={styles.modalAvatarPlaceholder}>
                      <Text style={styles.modalAvatarInitials}>{getInitials(editName || 'W')}</Text>
                    </View>
                  )}
                  <View style={styles.modalAvatarBadge}>
                    <Ionicons name="camera" size={13} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={styles.modalAvatarHint}>Tap to change photo</Text>

                <Text style={styles.modalLabel}>Full Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Full Name"
                  placeholderTextColor="#bdbdbd"
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={styles.modalLabel}>Country</Text>
                <TouchableOpacity style={styles.modalInput} onPress={() => setShowCountryPicker(true)}>
                  <Text style={{ color: editCountry ? '#222' : '#bdbdbd', fontSize: 16, fontFamily: 'SourceSans3-Regular' }}>
                    {typeof editCountry?.name === 'string' ? editCountry.name : 'Select Country'}
                  </Text>
                </TouchableOpacity>
                {showCountryPicker && (
                  <CountryPicker
                    countryCode={editCountry?.cca2 || 'US'}
                    visible={showCountryPicker}
                    onSelect={c => { setEditCountry(c); setShowCountryPicker(false); }}
                    onClose={() => setShowCountryPicker(false)}
                    withFlag
                    withFilter
                    withCountryNameButton={false}
                  />
                )}

                <Text style={styles.modalLabel}>Phone Number</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="+1 000 000 000"
                  placeholderTextColor="#bdbdbd"
                  keyboardType="phone-pad"
                  value={editPhone}
                  onChangeText={setEditPhone}
                />
                <View style={{ height: 32 }} />
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SettingsRow({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingsRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.settingsRowLeft}>
        <Ionicons name={icon} size={22} color="#555" style={styles.settingsRowIcon} />
        <View>
          <Text style={styles.settingsRowLabel}>{label}</Text>
          {subtitle ? <Text style={styles.settingsRowSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#bdbdbd" />
    </TouchableOpacity>
  );
}
