import React from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { styles } from '@/styles/discoverScreenStyles';

export default function DiscoverScreen() {
  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Feather name="menu" size={28} color="#222" />
        </TouchableOpacity>
        <Text style={styles.title}>Discover</Text>
        <TouchableOpacity>
          <Image
            source={require('@/assets/images/OnboardingPurpleBinoculars.png')}
            style={styles.avatar}
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={22} color="#bdbdbd" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search Destinations"
          placeholderTextColor="#bdbdbd"
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Recommended Trips */}
        <Text style={styles.sectionTitle}>Recommended Trips</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          <View style={styles.recommendedCard}>
            <View style={styles.recommendedCardContent}>
              <Text style={styles.recommendedCardTitle}>Northern Mountain</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>4.5</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.heartIcon}>
              <Ionicons name="heart" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {/* Add more cards as needed */}
        </ScrollView>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          <View style={styles.dotActive} />
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Popular Destinations */}
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Popular Destinations</Text>
          <TouchableOpacity>
            <Text style={styles.viewAll}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.popularRow}>
          <View style={styles.popularCard}>
            <Text style={styles.popularCardTitle}>Greenough, Montana</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <TouchableOpacity style={styles.heartIconSmall}>
              <Ionicons name="heart" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.popularCard}>
            <Text style={styles.popularCardTitle}>North Mountain</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>4.5</Text>
            </View>
            <TouchableOpacity style={styles.heartIconSmall}>
              <Ionicons name="heart" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Popular Articles */}
        <Text style={styles.sectionTitle}>Popular Articles</Text>
        <View style={styles.articlesRow}>
          <View style={styles.articleCard} />
          <View style={styles.articleCard} />
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItemActive}>
          <Ionicons name="home" size={28} color="#6A62B7" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="bookmark-outline" size={28} color="#bdbdbd" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="location-outline" size={28} color="#bdbdbd" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Ionicons name="person-outline" size={28} color="#bdbdbd" />
        </TouchableOpacity>
      </View>
    </View>
  );
}