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
  StyleSheet,
  Linking,
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
import { getUsageStatus, restorePurchases, type UsageStatus } from '@/services/purchases';
import PaywallModal from '@/components/PaywallModal';
import { FREE_MONTHLY_GENERATION_LIMIT, FREE_MONTHLY_REGEN_LIMIT, PRO_MONTHLY_GENERATION_LIMIT } from '@/types/subscription';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/legal';

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
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

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

  useEffect(() => {
    if (isDemoMode) return;
    getUsageStatus().then(setUsageStatus).catch(() => {});
  }, [isDemoMode]);

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
            icon="heart-outline"
            label="Travel Style"
            subtitle={(profile as any)?.tasteProfile ? 'Your taste profile is set' : 'Complete to personalize your trips'}
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

        {/* ── Subscription ── */}
        {!isDemoMode && usageStatus && (
          <View style={styles.section}>
            {usageStatus.isPro ? (
              <View style={subscriptionStyles.proRow}>
                <View style={subscriptionStyles.proBadge}>
                  <Ionicons name="star" size={14} color="#fff" />
                  <Text style={subscriptionStyles.proBadgeText}>Pro</Text>
                </View>
                <Text style={subscriptionStyles.proLabel}>Wanderly Pro — Active</Text>
                <Text style={subscriptionStyles.resetLabel}>
                  {usageStatus.generationsLeft} of {PRO_MONTHLY_GENERATION_LIMIT} trips left this month
                  {usageStatus.credits > 0 ? ` · ${usageStatus.credits} credits` : ''}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    const restored = await restorePurchases().catch(() => false);
                    if (!restored) {
                      Alert.alert('Subscription', 'Your Pro subscription is active. Manage it in your App Store / Google Play settings.');
                    }
                  }}
                >
                  <Text style={subscriptionStyles.manageText}>Manage</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={subscriptionStyles.usageRow}>
                  <Ionicons name="map-outline" size={18} color="#6A62B7" />
                  <Text style={subscriptionStyles.usageLabel}>
                    {usageStatus.generationsLeft} of {FREE_MONTHLY_GENERATION_LIMIT} trips remaining this month
                  </Text>
                </View>
                <View style={[subscriptionStyles.usageRow, { marginTop: 8 }]}>
                  <Ionicons name="refresh-outline" size={18} color="#6A62B7" />
                  <Text style={subscriptionStyles.usageLabel}>
                    {usageStatus.regensLeft} of {FREE_MONTHLY_REGEN_LIMIT} regenerations remaining
                  </Text>
                </View>
                {usageStatus.credits > 0 && (
                  <View style={[subscriptionStyles.usageRow, { marginTop: 8 }]}>
                    <Ionicons name="ticket-outline" size={18} color="#6A62B7" />
                    <Text style={subscriptionStyles.usageLabel}>
                      {usageStatus.credits} trip {usageStatus.credits === 1 ? 'credit' : 'credits'} available
                    </Text>
                  </View>
                )}
                <Text style={subscriptionStyles.resetLabel}>
                  Resets {usageStatus.resetDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </Text>
                <TouchableOpacity
                  style={subscriptionStyles.upgradeBtn}
                  onPress={() => setShowPaywall(true)}
                  activeOpacity={0.85}
                >
                  <Text style={subscriptionStyles.upgradeBtnText}>Upgrade to Pro — $9.99 / mo</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={22} color="#E53935" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Legal ── */}
        <View style={subscriptionStyles.legalRow}>
          <Text style={subscriptionStyles.legalLink} onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}>
            Terms of Use
          </Text>
          <Text style={subscriptionStyles.legalDot}>·</Text>
          <Text style={subscriptionStyles.legalLink} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
            Privacy Policy
          </Text>
        </View>
      </ScrollView>

      <PaywallModal
        visible={showPaywall}
        reason="generation"
        onDismiss={() => setShowPaywall(false)}
        onSuccess={() => {
          setShowPaywall(false);
          getUsageStatus().then(setUsageStatus).catch(() => {});
        }}
      />

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

const subscriptionStyles = StyleSheet.create({
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 8,
  },
  legalLink: {
    color: '#6A62B7',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalDot: {
    color: '#888',
    fontSize: 13,
  },
  proRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#6A62B7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
  },
  proLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: '#1a1a2e',
  },
  manageText: {
    fontSize: 13,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
  },
  usageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageLabel: {
    fontSize: 14,
    fontFamily: 'SourceSans3-Regular',
    color: '#444',
  },
  resetLabel: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: 'SourceSans3-Regular',
    color: '#999',
  },
  upgradeBtn: {
    marginTop: 16,
    backgroundColor: '#6A62B7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Merriweather_24pt-Bold',
  },
});

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
