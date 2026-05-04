import React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { useDestinationById } from '@/hooks/useDestinations';
import { styles } from '@/styles/destinationDetailStyles';

function StateScreen({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.stateContainer}>
      <Ionicons name={icon} size={32} color="#6A62B7" />
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

function DetailList({
  icon,
  items,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  items: string[];
}) {
  return (
    <>
      {items.map(item => (
        <View key={item} style={styles.listItem}>
          <View style={styles.listBullet}>
            <Ionicons name={icon} size={14} color="#6A62B7" />
          </View>
          <Text style={styles.listText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

export default function DestinationDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'DestinationDetail'>>();
  const { detail, loading, error } = useDestinationById(route.params.id);

  if (loading) {
    return (
      <View style={styles.stateContainer}>
        <ActivityIndicator size="large" color="#6A62B7" />
        <Text style={styles.stateTitle}>Loading destination</Text>
        <Text style={styles.stateText}>Pulling destination details into Wanderly.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <StateScreen
        icon="alert-circle-outline"
        title="Unable to open destination"
        text={error}
      />
    );
  }

  if (!detail) {
    return (
      <StateScreen
        icon="earth-outline"
        title="Destination unavailable"
        text="This location could not be found."
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Image source={{ uri: detail.imageUrl }} style={styles.heroImage} />
        <View style={styles.heroOverlay}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.iconButton}>
              <Ionicons name="heart-outline" size={20} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Destination spotlight</Text>
            <Text style={styles.title}>
              {detail.name}
              {detail.country ? `, ${detail.country}` : ''}
            </Text>
            <Text style={styles.subtitle}>{detail.tagline}</Text>

            <View style={styles.statRow}>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{`Rating ${detail.rating}`}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{detail.idealLength}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillText}>{detail.bestTimeToVisit}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Overview</Text>
        <Text style={styles.sectionTitle}>Why it works</Text>
        <Text style={styles.body}>{detail.overview}</Text>
      </View>

      <View style={styles.splitRow}>
        <View style={styles.splitCard}>
          <Text style={styles.sectionLabel}>Best timing</Text>
          <Text style={styles.splitTitle}>{detail.bestTimeToVisit}</Text>
          <Text style={styles.splitBody}>A strong window for weather, walkability, and overall trip rhythm.</Text>
        </View>
        <View style={styles.splitCard}>
          <Text style={styles.sectionLabel}>Trip shape</Text>
          <Text style={styles.splitTitle}>{detail.idealLength}</Text>
          <Text style={styles.splitBody}>{detail.flightTime}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Highlights</Text>
        <Text style={styles.sectionTitle}>Start here</Text>
        <DetailList icon="sparkles-outline" items={detail.highlights} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Signature experiences</Text>
        <Text style={styles.sectionTitle}>What makes it memorable</Text>
        <DetailList icon="compass-outline" items={detail.signatureExperiences} />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Travel notes</Text>
        <Text style={styles.sectionTitle}>Plan with less friction</Text>
        <DetailList icon="information-outline" items={detail.travelNotes} />
      </View>
    </ScrollView>
  );
}
