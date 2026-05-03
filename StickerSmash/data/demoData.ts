export const DEMO_UID = 'demo-user';

export interface DemoDestinationDetail {
  id: string;
  description: string;
  gallery: string[];
}

export const DEMO_DESTINATION_DETAILS: Record<string, DemoDestinationDetail> = {
  'demo-dest-1': {
    id: 'demo-dest-1',
    description:
      'Discover the vibrant metropolis of Tokyo, where modernity meets tradition in perfect harmony. From futuristic skyscrapers to serene temples and lush parks, Tokyo offers an eclectic blend of experiences.',
    gallery: [
      'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=400',
      'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400',
      'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=400',
    ],
  },
  'demo-dest-2': {
    id: 'demo-dest-2',
    description:
      'Paris, the City of Light, dazzles visitors with its timeless elegance. Stroll along the Seine, marvel at the Eiffel Tower, and lose yourself in world-class museums and charming street cafés.',
    gallery: [
      'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400',
      'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400',
      'https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=400',
    ],
  },
  'demo-dest-3': {
    id: 'demo-dest-3',
    description:
      'Bali is a living postcard of tropical beauty, spiritual culture, and warm hospitality. Explore emerald rice terraces, ancient temples, and pristine beaches all on one enchanting island.',
    gallery: [
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400',
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=400',
      'https://images.unsplash.com/photo-1559628233-100c798642d0?w=400',
    ],
  },
  'demo-dest-4': {
    id: 'demo-dest-4',
    description:
      "New York City pulses with an energy unlike anywhere else on Earth. From the bright lights of Times Square to the calm of Central Park, the city that never sleeps offers something for every traveler.",
    gallery: [
      'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400',
      'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=400',
      'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=400',
    ],
  },
};

export interface SavedItem {
  id: string;
  type: 'itinerary' | 'destination';
  title: string;
  imageUrl: string;
  country?: string;
  flag?: string;
  rating?: string;
}

export const DEMO_DESTINATIONS = [
  {
    id: 'demo-dest-1',
    name: 'Tokyo',
    country: 'Japan',
    flag: '🇯🇵',
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
    country: 'France',
    flag: '🇫🇷',
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
    country: 'Indonesia',
    flag: '🇮🇩',
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
    country: 'United States',
    flag: '🇺🇸',
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

export interface DemoTransportOption {
  mode: 'walk' | 'car' | 'bicycle' | 'bus' | 'train';
  time: string;
}

export interface DemoActivity {
  id: string;
  name: string;
  image: string;
  rating: number;
  reviewCount: string;
  time: string;
  cost?: string;
  type: 'food' | 'landmark' | 'hotel';
  transport: DemoTransportOption[];
  coordinates: { latitude: number; longitude: number };
}

export interface DemoItineraryDay {
  label: string;
  activities: DemoActivity[];
}

export interface DemoFullItinerary {
  id: string;
  title: string;
  heroImage: string;
  mapImage: string;
  subtitle: string;
  days: DemoItineraryDay[];
  isActive?: boolean;
}

export const DEMO_FULL_ITINERARIES: DemoFullItinerary[] = [
  {
    id: 'demo-itin-1',
    title: 'Tokyo, Japan 🇯🇵',
    heroImage: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800',
    subtitle: 'Dec 12 - Dec 14, 2023  •  A Couple  •  Luxury',
    isActive: true,
    days: [
      {
        label: 'December 12th',
        activities: [
          {
            id: 'act-1-1',
            name: "Cafe de l'ambre",
            image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600',
            rating: 4.2,
            reviewCount: '1,573',
            time: '08:00 - 09:00 AM',
            cost: '$30.00',
            type: 'food',
            coordinates: { latitude: 35.6712, longitude: 139.7649 },
            transport: [
              { mode: 'walk', time: '10 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '23 min' },
              { mode: 'bus', time: '33 min' },
              { mode: 'train', time: '13 min' },
            ],
          },
          {
            id: 'act-1-2',
            name: 'Tokyo Tower',
            image: 'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=600',
            rating: 4.4,
            reviewCount: '73,258',
            time: '09:00 AM - 12:00 PM',
            type: 'landmark',
            coordinates: { latitude: 35.6586, longitude: 139.7454 },
            transport: [
              { mode: 'walk', time: '9 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '46 min' },
              { mode: 'bus', time: '15 min' },
              { mode: 'train', time: '--' },
            ],
          },
          {
            id: 'act-1-3',
            name: 'Tsukiji Tama Sushi',
            image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600',
            rating: 4.0,
            reviewCount: '1,736',
            time: '12:00 - 13:30 PM',
            cost: '$35.00',
            type: 'food',
            coordinates: { latitude: 35.6655, longitude: 139.7707 },
            transport: [
              { mode: 'walk', time: '12 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '24 min' },
              { mode: 'bus', time: '37 min' },
              { mode: 'train', time: '16 min' },
            ],
          },
          {
            id: 'act-1-4',
            name: 'Imperial Palace',
            image: 'https://images.unsplash.com/photo-1526481280693-3bfa7568e0f3?w=600',
            rating: 4.1,
            reviewCount: '28,903',
            time: '13:30 - 16:00 PM',
            cost: '$45.00',
            type: 'landmark',
            coordinates: { latitude: 35.6852, longitude: 139.7528 },
            transport: [
              { mode: 'walk', time: '13 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '28 min' },
              { mode: 'bus', time: '46 min' },
              { mode: 'train', time: '8 min' },
            ],
          },
          {
            id: 'act-1-5',
            name: 'Sushi Iwa',
            image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600',
            rating: 4.5,
            reviewCount: '1,508',
            time: '16:00 - 17:30 PM',
            cost: '$30.00',
            type: 'food',
            coordinates: { latitude: 35.6699, longitude: 139.7669 },
            transport: [
              { mode: 'walk', time: '3 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '17 min' },
              { mode: 'bus', time: '46 min' },
              { mode: 'train', time: '10 min' },
            ],
          },
          {
            id: 'act-1-6',
            name: 'Mandarin Oriental, Tokyo',
            image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600',
            rating: 4.9,
            reviewCount: '4,205',
            time: '17:30 - 20:00 PM',
            cost: '$65.00',
            type: 'hotel',
            coordinates: { latitude: 35.6892, longitude: 139.7709 },
            transport: [
              { mode: 'walk', time: '5 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '20 min' },
              { mode: 'bus', time: '35 min' },
              { mode: 'train', time: '12 min' },
            ],
          },
        ],
      },
      {
        label: 'December 13th',
        activities: [
          {
            id: 'act-2-1',
            name: 'Senso-ji Temple',
            image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=600',
            rating: 4.7,
            reviewCount: '112,450',
            time: '08:00 - 10:00 AM',
            type: 'landmark',
            coordinates: { latitude: 35.7148, longitude: 139.7967 },
            transport: [
              { mode: 'walk', time: '20 min' },
              { mode: 'car', time: '8 min' },
              { mode: 'bicycle', time: '35 min' },
              { mode: 'bus', time: '25 min' },
              { mode: 'train', time: '15 min' },
            ],
          },
          {
            id: 'act-2-2',
            name: 'Nakamise Shopping Street',
            image: 'https://images.unsplash.com/photo-1490806843957-31f4c9a91c65?w=600',
            rating: 4.5,
            reviewCount: '34,200',
            time: '10:00 AM - 12:00 PM',
            type: 'landmark',
            coordinates: { latitude: 35.7135, longitude: 139.7960 },
            transport: [
              { mode: 'walk', time: '2 min' },
              { mode: 'car', time: '--' },
              { mode: 'bicycle', time: '5 min' },
              { mode: 'bus', time: '10 min' },
              { mode: 'train', time: '--' },
            ],
          },
          {
            id: 'act-2-3',
            name: 'Ramen Ichiran',
            image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600',
            rating: 4.6,
            reviewCount: '8,910',
            time: '12:00 - 13:00 PM',
            cost: '$20.00',
            type: 'food',
            coordinates: { latitude: 35.7094, longitude: 139.7944 },
            transport: [
              { mode: 'walk', time: '8 min' },
              { mode: 'car', time: '4 min' },
              { mode: 'bicycle', time: '15 min' },
              { mode: 'bus', time: '20 min' },
              { mode: 'train', time: '10 min' },
            ],
          },
          {
            id: 'act-2-4',
            name: 'Shibuya Crossing',
            image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=600',
            rating: 4.8,
            reviewCount: '98,340',
            time: '14:00 - 16:00 PM',
            type: 'landmark',
            coordinates: { latitude: 35.6595, longitude: 139.7004 },
            transport: [
              { mode: 'walk', time: '--' },
              { mode: 'car', time: '20 min' },
              { mode: 'bicycle', time: '40 min' },
              { mode: 'bus', time: '55 min' },
              { mode: 'train', time: '22 min' },
            ],
          },
        ],
      },
      {
        label: 'December 14th',
        activities: [
          {
            id: 'act-3-1',
            name: 'teamLab Borderless',
            image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600',
            rating: 4.9,
            reviewCount: '22,100',
            time: '09:00 AM - 12:00 PM',
            cost: '$40.00',
            type: 'landmark',
            coordinates: { latitude: 35.6261, longitude: 139.7758 },
            transport: [
              { mode: 'walk', time: '--' },
              { mode: 'car', time: '15 min' },
              { mode: 'bicycle', time: '35 min' },
              { mode: 'bus', time: '45 min' },
              { mode: 'train', time: '18 min' },
            ],
          },
          {
            id: 'act-3-2',
            name: 'Harajuku Takeshita Street',
            image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600',
            rating: 4.3,
            reviewCount: '41,800',
            time: '12:30 - 14:30 PM',
            type: 'landmark',
            coordinates: { latitude: 35.6702, longitude: 139.7027 },
            transport: [
              { mode: 'walk', time: '--' },
              { mode: 'car', time: '12 min' },
              { mode: 'bicycle', time: '28 min' },
              { mode: 'bus', time: '35 min' },
              { mode: 'train', time: '10 min' },
            ],
          },
          {
            id: 'act-3-3',
            name: 'Sukiyabashi Jiro',
            image: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=600',
            rating: 4.8,
            reviewCount: '3,102',
            time: '18:00 - 20:00 PM',
            cost: '$300.00',
            type: 'food',
            coordinates: { latitude: 35.6717, longitude: 139.7652 },
            transport: [
              { mode: 'walk', time: '10 min' },
              { mode: 'car', time: '5 min' },
              { mode: 'bicycle', time: '20 min' },
              { mode: 'bus', time: '30 min' },
              { mode: 'train', time: '8 min' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'demo-itin-paris',
    title: 'Paris, France 🇫🇷',
    heroImage: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800',
    mapImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=800',
    subtitle: 'Mar 5 - Mar 10, 2024  •  Solo  •  Budget',
    isActive: false,
    days: [],
  },
];

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
