export const DEMO_UID = 'demo-user';

export const DEMO_DESTINATIONS = [
  {
    id: 'demo-dest-1',
    name: 'Tokyo',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
  },
  {
    id: 'demo-dest-2',
    name: 'Paris',
    imageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400',
  },
  {
    id: 'demo-dest-3',
    name: 'Bali',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
  },
  {
    id: 'demo-dest-4',
    name: 'New York',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400',
  },
];

export const DEMO_ITINERARIES = [
  {
    id: 'demo-itin-1',
    title: 'Weekend in Kyoto',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
    rating: '4.8',
    interests: ['culture', 'history'],
    summary: ['Visit Fushimi Inari Shrine', 'Arashiyama Bamboo Grove', 'Kinkaku-ji Temple'],
  },
  {
    id: 'demo-itin-2',
    title: 'Amalfi Coast Adventure',
    heroImage: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=400',
    rating: '4.9',
    interests: ['adventure', 'beaches'],
    summary: ['Hike the Path of the Gods', 'Boat tour of sea caves', 'Dinner in Positano'],
  },
  {
    id: 'demo-itin-3',
    title: 'Safari in Kenya',
    heroImage: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400',
    rating: '5.0',
    interests: ['wildlife', 'adventure'],
    summary: ['Masai Mara game drive', 'Sundowner cocktails', 'Hot air balloon safari'],
  },
];

export const DEMO_FEATURED_TRIP = {
  tripId: 'demo-itin-1',
  badge: "Editor's Pick",
  to: { seconds: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30 },
};

export const DEMO_FEATURED_ITINERARY = {
  id: 'demo-itin-1',
  title: 'Weekend in Kyoto',
  heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
  summary: ['Visit Fushimi Inari Shrine', 'Arashiyama Bamboo Grove', 'Kinkaku-ji Temple'],
};

export const DEMO_ACTIVITIES: { label: string; emoji: string }[] = [
  { label: 'Hiking', emoji: '🥾' },
  { label: 'Beach', emoji: '🏖️' },
  { label: 'Culture', emoji: '🏛️' },
  { label: 'Food Tours', emoji: '🍜' },
  { label: 'Adventure', emoji: '🧗' },
  { label: 'Photography', emoji: '📷' },
  { label: 'Wildlife', emoji: '🦁' },
  { label: 'History', emoji: '🏰' },
  { label: 'Shopping', emoji: '🛍️' },
  { label: 'Nightlife', emoji: '🎉' },
  { label: 'Wellness', emoji: '🧘' },
  { label: 'Water Sports', emoji: '🏄' },
];

export const DEMO_FOOD_PREFERENCES: { label: string; emoji: string }[] = [
  { label: 'Italian', emoji: '🍕' },
  { label: 'Japanese', emoji: '🍣' },
  { label: 'Mexican', emoji: '🌮' },
  { label: 'Indian', emoji: '🍛' },
  { label: 'Thai', emoji: '🍜' },
  { label: 'Mediterranean', emoji: '🥗' },
  { label: 'Street Food', emoji: '🌯' },
  { label: 'Vegan', emoji: '🥦' },
  { label: 'Seafood', emoji: '🦞' },
  { label: 'BBQ', emoji: '🍖' },
  { label: 'Fine Dining', emoji: '🍽️' },
  { label: 'Desserts', emoji: '🍰' },
];
