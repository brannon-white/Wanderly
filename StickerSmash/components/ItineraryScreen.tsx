import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { styles } from '../styles/TravelItinerary';

const TravelItinerary = () => {
  const openMaps = () => {
    Linking.openURL('https://maps.google.com/?q=Cafe+de+lambre+Tokyo');
  };

  return (
    <ScrollView style={styles.itineraryContainer}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Image
          source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
          style={styles.heroImage}
        />
        <View style={styles.heroOverlay}>
          <Text style={styles.heroTitle}>Tokyo, Japan 🇯🇵</Text>
          <Text style={styles.heroSubtitle}>
            Dec 12 - Dec 14, 2023 • A Couple • Luxury
          </Text>
        </View>
      </View>

      {/* Map Section */}
      <View style={styles.mapSection}>
        <View style={styles.mapContainer}>
          <Image
            source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
            style={styles.mapImage}
          />
        </View>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity style={[styles.dateBtn, styles.dateBtnActive]}>
          <Text style={[styles.dateBtnText, styles.dateBtnTextActive]}>
            December 12nd
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>December 13rd</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateBtn}>
          <Text style={styles.dateBtnText}>December 14th</Text>
        </TouchableOpacity>
      </View>

      {/* Itinerary Items */}
      <View style={styles.itineraryItems}>
        {/* Cafe de l'ambre */}
        <View style={styles.itineraryItem}>
          <Image
            source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
            style={styles.itemImage}
          />
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>Cafe de l'ambre</Text>
            
            <View style={styles.rating}>
              <Text style={styles.stars}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.ratingText}>(4.2) 1,573 reviews</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>🕐</Text>
              <Text style={styles.infoText}>08:00 - 09:00 AM</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>💰</Text>
              <Text style={styles.infoText}>$30.00</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>📍</Text>
              <TouchableOpacity onPress={openMaps}>
                <Text style={styles.mapsLink}>View on Google Maps</Text>
              </TouchableOpacity>
            </View>
            
            {/* Transportation Options */}
            <View style={styles.transportOptions}>
              <View style={styles.transportOption}>
                <Text style={styles.transportIcon}>🚶</Text>
                <Text style={styles.transportTime}>10 min</Text>
              </View>
              <View style={styles.transportOption}>
                <Text style={styles.transportIcon}>🚗</Text>
                <Text style={styles.transportTime}>-</Text>
              </View>
              <View style={styles.transportOption}>
                <Text style={styles.transportIcon}>🚲</Text>
                <Text style={styles.transportTime}>23 min</Text>
              </View>
              <View style={styles.transportOption}>
                <Text style={styles.transportIcon}>🚌</Text>
                <Text style={styles.transportTime}>33 min</Text>
              </View>
              <View style={styles.transportOption}>
                <Text style={styles.transportIcon}>🚶</Text>
                <Text style={styles.transportTime}>13 min</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tokyo Tower */}
        <View style={styles.itineraryItem}>
          <Image
            source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
            style={styles.itemImage}
          />
          <View style={styles.itemDetails}>
            <Text style={styles.itemTitle}>Tokyo Tower</Text>
            <View style={styles.rating}>
              <Text style={styles.stars}>⭐⭐⭐⭐⭐</Text>
              <Text style={styles.ratingText}>(4.4) 73,258 reviews</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default TravelItinerary;