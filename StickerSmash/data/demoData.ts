export const DEMO_UID = 'demo-user';

export const DEMO_DESTINATIONS = [
  {
    id: 'demo-dest-1',
    name: 'Tokyo',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
    country: 'Japan',
    tagline: 'Electric neighborhoods, quiet shrines, and late-night ramen counters.',
    rating: 4.8,
    idealLength: '5-7 days',
    bestTimeToVisit: 'March to May',
    flightTime: '13h from NYC',
    overview:
      'Tokyo blends meticulous design, hyperlocal food culture, and pockets of calm that make the city feel both cinematic and livable.',
    highlights: ['Shibuya after dark', 'Tsukiji-side sushi mornings', 'Day trip access to Nikko or Hakone'],
    signatureExperiences: ['TeamLab-style digital art', 'Izakaya hopping in Shinjuku', 'Sunrise at Senso-ji'],
    travelNotes: ['Transit is extremely efficient', 'Neighborhood choice changes the pace of your stay'],
  },
  {
    id: 'demo-dest-2',
    name: 'Paris',
    imageUrl: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400',
    country: 'France',
    tagline: 'Grand boulevards, corner bistros, and museum days that turn into river nights.',
    rating: 4.7,
    idealLength: '4-6 days',
    bestTimeToVisit: 'April to June',
    flightTime: '7h 30m from NYC',
    overview:
      'Paris rewards slow travel: long walks, neighborhood cafes, layered history, and enough iconic landmarks to anchor every day.',
    highlights: ['Sunset along the Seine', 'Musee d Orsay afternoons', 'Cafe terraces in Le Marais'],
    signatureExperiences: ['Picnic near the Eiffel Tower', 'Vintage shopping in Saint-Ouen', 'Pastry crawl across the Left Bank'],
    travelNotes: ['Book major museums ahead', 'Most central neighborhoods are best explored on foot'],
  },
  {
    id: 'demo-dest-3',
    name: 'Bali',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
    country: 'Indonesia',
    tagline: 'Jungle villas, temple cliffs, surf breaks, and deeply restorative mornings.',
    rating: 4.9,
    idealLength: '6-8 days',
    bestTimeToVisit: 'May to September',
    flightTime: '22h from NYC',
    overview:
      'Bali works best when split between distinct pockets such as Ubud, Canggu, and Uluwatu, each with its own rhythm.',
    highlights: ['Clifftop sunsets in Uluwatu', 'Rice terraces outside Ubud', 'Beach clubs and cafes in Canggu'],
    signatureExperiences: ['Balinese spa day', 'Sunrise waterfall visit', 'Scooter rides between hidden beaches'],
    travelNotes: ['Traffic can stretch short distances', 'Choosing two bases often feels better than trying to cover the whole island'],
  },
  {
    id: 'demo-dest-4',
    name: 'New York',
    imageUrl: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400',
    country: 'United States',
    tagline: 'Big-energy streets, neighborhood icons, and a constant feeling that something good is nearby.',
    rating: 4.6,
    idealLength: '3-5 days',
    bestTimeToVisit: 'September to November',
    flightTime: 'Domestic hub',
    overview:
      'New York is less about checking off landmarks and more about pairing museums, food, and neighborhoods into days that feel personal.',
    highlights: ['West Village evenings', 'Central Park mornings', 'Brooklyn skyline views'],
    signatureExperiences: ['Broadway night out', 'Bagels and gallery day in Chelsea', 'Rooftop dinner in Williamsburg'],
    travelNotes: ['Subway access matters when picking a hotel', 'Reservations are worth it for popular restaurants'],
  },
];

export const DEMO_ITINERARIES = [
  {
    id: 'demo-itin-1',
    title: 'Weekend in Kyoto',
    destination: 'Kyoto',
    country: 'Japan',
    heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
    rating: '4.8',
    reviewCount: 312,
    interests: ['culture', 'history'],
    travelerType: 'Couple getaway',
    budget: 'Moderate',
    dateLabel: '3 days',
    overview:
      'A relaxed Kyoto long weekend built around temples, tea houses, scenic walks, and evening food stops.',
    summary: [
      'Visit Fushimi Inari Shrine',
      'Walk through Arashiyama Bamboo Grove',
      'See Kinkaku-ji Temple',
    ],
    days: [
      {
        title: 'Arrival and Higashiyama',
        dateLabel: 'Day 1',
        items: [
          {
            title: 'Coffee and pastries at Weekenders',
            category: 'Breakfast',
            description: 'Start the morning with a light breakfast before heading into the temple district.',
            time: '8:00 AM - 9:00 AM',
            price: '$18',
            rating: 4.7,
            reviewCount: 842,
            imageUrl:
              'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
            mapUrl: 'https://maps.google.com/?q=Weekenders+Coffee+Kyoto',
            transitOptions: [
              { mode: 'walk', label: 'Walk', time: '8 min' },
              { mode: 'train', label: 'Train', time: '14 min' },
            ],
          },
          {
            title: 'Fushimi Inari Shrine',
            category: 'Sightseeing',
            description: 'Climb part of the torii-lined trail before the crowds peak.',
            time: '10:00 AM - 12:30 PM',
            price: 'Free',
            rating: 4.9,
            reviewCount: 58231,
            imageUrl:
              'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=800',
            mapUrl: 'https://maps.google.com/?q=Fushimi+Inari+Shrine',
            transitOptions: [
              { mode: 'train', label: 'Train', time: '22 min' },
              { mode: 'taxi', label: 'Taxi', time: '16 min' },
            ],
          },
          {
            title: 'Kaiseki dinner in Gion',
            category: 'Dinner',
            description: 'Slow evening meal with seasonal Kyoto dishes in a traditional setting.',
            time: '7:00 PM - 9:00 PM',
            price: '$95',
            rating: 4.8,
            reviewCount: 430,
            imageUrl:
              'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
            mapUrl: 'https://maps.google.com/?q=Gion+Kyoto',
            transitOptions: [
              { mode: 'walk', label: 'Walk', time: '11 min' },
            ],
          },
        ],
      },
      {
        title: 'Arashiyama and River Views',
        dateLabel: 'Day 2',
        items: [
          {
            title: 'Arashiyama Bamboo Grove',
            category: 'Nature',
            description: 'Go early for quieter paths and better photo light through the grove.',
            time: '7:30 AM - 9:30 AM',
            price: 'Free',
            rating: 4.8,
            reviewCount: 19442,
            imageUrl:
              'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800',
            mapUrl: 'https://maps.google.com/?q=Arashiyama+Bamboo+Grove',
            transitOptions: [
              { mode: 'train', label: 'Train', time: '28 min' },
              { mode: 'bike', label: 'Bike', time: '34 min' },
            ],
          },
          {
            title: 'Tenryu-ji garden visit',
            category: 'Culture',
            description: 'Spend time in the landscaped temple grounds beside the grove.',
            time: '10:00 AM - 11:30 AM',
            price: '$8',
            rating: 4.6,
            reviewCount: 2601,
            imageUrl:
              'https://images.unsplash.com/photo-1526481280695-3c4691d5d1af?w=800',
            mapUrl: 'https://maps.google.com/?q=Tenryu-ji+Kyoto',
          },
          {
            title: 'Sunset by Togetsukyo Bridge',
            category: 'Evening',
            description: 'End the day with a scenic walk along the Katsura River.',
            time: '5:30 PM - 7:00 PM',
            price: 'Free',
            rating: 4.7,
            reviewCount: 1387,
            imageUrl:
              'https://images.unsplash.com/photo-1492571350019-22de08371fd3?w=800',
            mapUrl: 'https://maps.google.com/?q=Togetsukyo+Bridge',
          },
        ],
      },
      {
        title: 'Northern Kyoto Highlights',
        dateLabel: 'Day 3',
        items: [
          {
            title: 'Kinkaku-ji Temple',
            category: 'Sightseeing',
            description: 'Visit the Golden Pavilion before checkout for one last Kyoto icon.',
            time: '9:00 AM - 10:30 AM',
            price: '$4',
            rating: 4.8,
            reviewCount: 25014,
            imageUrl:
              'https://images.unsplash.com/photo-1491884662610-dfcd28f30cfb?w=800',
            mapUrl: 'https://maps.google.com/?q=Kinkaku-ji+Kyoto',
            transitOptions: [
              { mode: 'bus', label: 'Bus', time: '26 min' },
              { mode: 'taxi', label: 'Taxi', time: '14 min' },
            ],
          },
          {
            title: 'Matcha dessert stop',
            category: 'Dessert',
            description: 'Pick up a final sweet treat and souvenirs before departure.',
            time: '11:00 AM - 12:00 PM',
            price: '$12',
            rating: 4.5,
            reviewCount: 219,
            imageUrl:
              'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=800',
            mapUrl: 'https://maps.google.com/?q=Matcha+Kyoto',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-itin-2',
    title: 'Amalfi Coast Adventure',
    destination: 'Amalfi Coast',
    country: 'Italy',
    heroImage: 'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=1200',
    rating: '4.9',
    travelerType: 'Adventure seekers',
    budget: 'Upscale',
    interests: ['adventure', 'beaches'],
    summary: ['Hike the Path of the Gods', 'Boat tour of sea caves', 'Dinner in Positano'],
    days: [
      {
        title: 'Clifftop trails',
        dateLabel: 'Day 1',
        items: [
          {
            title: 'Path of the Gods hike',
            category: 'Adventure',
            time: '8:00 AM - 12:00 PM',
            price: 'Free',
            description: 'A coastal ridge walk with panoramic views over the sea and villages below.',
          },
        ],
      },
    ],
  },
  {
    id: 'demo-itin-3',
    title: 'Safari in Kenya',
    destination: 'Masai Mara',
    country: 'Kenya',
    heroImage: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200',
    rating: '5.0',
    travelerType: 'Wildlife lovers',
    budget: 'Luxury',
    interests: ['wildlife', 'adventure'],
    summary: ['Masai Mara game drive', 'Sundowner cocktails', 'Hot air balloon safari'],
    days: [
      {
        title: 'Reserve arrival',
        dateLabel: 'Day 1',
        items: [
          {
            title: 'Sunset game drive',
            category: 'Wildlife',
            time: '4:00 PM - 7:00 PM',
            price: 'Included',
            description: 'Ease into the trip with a first drive across the reserve at golden hour.',
          },
        ],
      },
    ],
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
  heroImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
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
