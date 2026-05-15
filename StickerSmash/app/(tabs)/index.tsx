import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import { styles } from '@/styles/discoverScreenStyles';
import { useFeaturedItinerary } from '@/hooks/userFeaturedItinerary';
import { useMatchingItineraries } from '@/hooks/useMatchingItineraries';
import { getAuth } from '@react-native-firebase/auth';
import FeaturedTripCard from '@/components/FeaturedTripCard';
import RecommendedTripCard from '@/components/RecommendedTripCard';
import DestinationCard from '@/components/DestinationCard';
import { useDestinations } from '@/hooks/useDestinations';
import { usePopularArticles } from '@/hooks/usePopularArticles';
import { useDemo } from '@/context/DemoContext';
import { DEMO_UID } from '@/data/demoData';
import type { ItineraryCardSummary } from '@/types/itinerary';
import { getUserProfile } from '@/utils/getUserProfile';
import ArticleCard from '@/components/ArticleCard';
import type { Article } from '@/types/article';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DiscoverScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { isDemoMode } = useDemo();
  const { featuredTrip, itinerary, loading, error } = useFeaturedItinerary();
  const { destinations, loading: loadingDest, error: errorDest } = useDestinations();
  const { articles, loading: loadingArticles, error: errorArticles } = usePopularArticles();
  const [firstName, setFirstName] = useState('');

  const uid = isDemoMode ? DEMO_UID : (getAuth().currentUser?.uid ?? '');
  const { prebuiltItineraries, loading: loadingItins, error: errorItins } = useMatchingItineraries(uid);

  const [activeItinIndex, setActiveItinIndex] = useState(0);
  const ITIN_PAGE_WIDTH = 365;

  useEffect(() => {
    if (isDemoMode) { setFirstName('Traveler'); return; }
    const user = getAuth().currentUser;
    if (!user) return;
    getUserProfile(user.uid).then((p: any) => {
      const name = p?.fullName || '';
      setFirstName(name.split(' ')[0] || '');
    }).catch(() => {});
  }, [isDemoMode]);

  const handleItinScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / ITIN_PAGE_WIDTH);
    setActiveItinIndex(index);
  };
  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          {firstName ? <Text style={styles.greeting}>{getGreeting()}, {firstName}</Text> : null}
          <Text style={styles.title}>Discover</Text>
        </View>
      </View>

      {/* Search */}
      <TouchableOpacity
        style={styles.searchWrapper}
        onPress={() => navigation.navigate('SearchScreen')}
        activeOpacity={0.7}
      >
        <Ionicons name="search" size={22} color="#bdbdbd" style={{ marginRight: 8 }} />
        <Text style={[styles.searchInput, { color: '#bdbdbd' }]}>Where do you want to go?</Text>
      </TouchableOpacity>

       <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Featured Trip */}
        <Text style={styles.sectionTitleFeatured}>Featured Trip</Text>
        {loading ? (
          <View style={styles.featuredTripCard}>
            <View style={[styles.featuredTripImage, { backgroundColor: '#e8e4ff' }]} />
            <View style={styles.featuredTripContent}>
              <View style={{ height: 14, width: '60%', borderRadius: 7, backgroundColor: '#ede9ff', marginBottom: 10 }} />
              <View style={{ height: 12, width: '80%', borderRadius: 6, backgroundColor: '#ede9ff', marginBottom: 6 }} />
              <View style={{ height: 12, width: '50%', borderRadius: 6, backgroundColor: '#ede9ff', marginBottom: 18 }} />
              <View style={[styles.featuredTripButton, { backgroundColor: '#e8e4ff' }]} />
            </View>
          </View>
        ) : featuredTrip && itinerary ? (
          <FeaturedTripCard itinerary={itinerary} featuredTrip={featuredTrip} />
        ) : null}

        {/* Recommended Trips */}
        <Text style={styles.sectionTitle}>Recommended Trips</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          onScroll={handleItinScroll}
          scrollEventThrottle={16}
        >
          {loadingItins ? (
            [0, 1, 2].map(i => (
              <View key={i} style={[styles.recommendedCard, { marginLeft: i === 0 ? 20 : 10 }]}>
                <View style={{ flex: 1, backgroundColor: '#e8e4ff' }} />
                <View style={styles.recommendedCardContent}>
                  <View style={{ height: 14, width: '65%', borderRadius: 7, backgroundColor: '#ede9ff', marginBottom: 8 }} />
                  <View style={{ height: 11, width: '45%', borderRadius: 6, backgroundColor: '#ede9ff' }} />
                </View>
              </View>
            ))
          ) : prebuiltItineraries && prebuiltItineraries.length > 0 ? (
            prebuiltItineraries.map((itin: ItineraryCardSummary) => (
              <RecommendedTripCard key={itin.id} itin={itin} />
            ))
          ) : null}
        </ScrollView>

        {/* Pagination dots */}
        {prebuiltItineraries.length > 0 && (
          <View style={styles.pagination}>
            {prebuiltItineraries.slice(0, 6).map((_: any, i: number) => (
              <View key={i} style={i === activeItinIndex ? styles.dotActive : styles.dot} />
            ))}
          </View>
        )}

        {/* Popular Destinations */}
<View style={styles.rowBetween}>
  <Text style={styles.sectionTitle}>Popular Destinations</Text>
  <TouchableOpacity onPress={() => navigation.navigate('AllDestinations')}>
    <Text style={styles.viewAll}>View All</Text>
  </TouchableOpacity>
</View>
<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  contentContainerStyle={{ paddingRight: 8 }}
  style={{ marginBottom: 16 }}
>
  {loadingDest ? (
    [0, 1, 2].map(i => (
      <View key={i} style={[styles.destinationCard, { marginLeft: i === 0 ? 20 : 10, backgroundColor: '#e8e4ff' }]} />
    ))
  ) : destinations && destinations.length > 0 ? (
    destinations.map((dest: any) => (
      <DestinationCard
        key={dest.id}
        id={dest.id}
        title={dest.name}
        imageUrl={dest.imageUrl}
        country={dest.country}
        flag={dest.flag}
      />
    ))
  ) : null}
</ScrollView>

        {/* Popular Articles */}
        <Text style={styles.sectionTitle}>Popular Articles</Text>
        {loadingArticles ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, marginBottom: 16 }}>
            {[0, 1, 2].map(i => (
              <View key={i} style={{ width: 240, height: 200, borderRadius: 20, marginLeft: i === 0 ? 20 : 4, backgroundColor: '#e8e4ff' }} />
            ))}
          </ScrollView>
        ) : errorArticles ? (
          <Text style={{ margin: 20, color: 'red' }}>{errorArticles}</Text>
        ) : articles.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20, marginBottom: 16 }}
          >
            {articles.map((article: Article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
