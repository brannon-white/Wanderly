import {
  Mountain, Heart, MapPin, Compass, Users, Landmark, Camera, Leaf, Zap, Clock, Waves, Gem, Home,
  Footprints, Umbrella, Building2, Utensils, ShoppingBag, Music, Castle, Building, Coffee,
  Music2, Star, Car, Wine, Store, Sparkles, Ship, PawPrint, Dumbbell,
  UtensilsCrossed, Cookie, Fish, Sprout, Award,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export interface PillItem {
  label: string;
  icon: LucideIcon;
}

export const TRIP_VIBES: PillItem[] = [
  { label: 'Relaxing', icon: Waves },
  { label: 'Adventure', icon: Mountain },
  { label: 'Romantic', icon: Heart },
  { label: 'Luxury', icon: Gem },
  { label: 'Local & Authentic', icon: MapPin },
  { label: 'Hidden Gems', icon: Compass },
  { label: 'Social', icon: Users },
  { label: 'Cultural', icon: Landmark },
  { label: 'Scenic', icon: Camera },
  { label: 'Wellness', icon: Leaf },
  { label: 'Family-Friendly', icon: Home },
  { label: 'Fast-Paced', icon: Zap },
  { label: 'Slow Travel', icon: Clock },
];

export const ACTIVITY_PILLS: PillItem[] = [
  { label: 'Hiking', icon: Footprints },
  { label: 'Beaches', icon: Umbrella },
  { label: 'Museums', icon: Building2 },
  { label: 'Food Tours', icon: Utensils },
  { label: 'Shopping', icon: ShoppingBag },
  { label: 'Nightlife', icon: Music },
  { label: 'Photography', icon: Camera },
  { label: 'History', icon: Castle },
  { label: 'Architecture', icon: Building },
  { label: 'Cafés', icon: Coffee },
  { label: 'Live Music', icon: Music2 },
  { label: 'Nature', icon: Leaf },
  { label: 'Theme Parks', icon: Star },
  { label: 'Road Trips', icon: Car },
  { label: 'Wine Tasting', icon: Wine },
  { label: 'Markets', icon: Store },
  { label: 'Festivals', icon: Sparkles },
  { label: 'Boat Tours', icon: Ship },
  { label: 'Wildlife', icon: PawPrint },
  { label: 'Sports', icon: Dumbbell },
];

export const FOOD_PILLS: PillItem[] = [
  { label: 'Street Food', icon: Utensils },
  { label: 'Fine Dining', icon: UtensilsCrossed },
  { label: 'Local Cuisine', icon: MapPin },
  { label: 'Coffee Shops', icon: Coffee },
  { label: 'Cocktail Bars', icon: Wine },
  { label: 'Rooftop Bars', icon: Building2 },
  { label: 'Bakeries', icon: Cookie },
  { label: 'Seafood', icon: Fish },
  { label: 'Vegetarian-Friendly', icon: Sprout },
  { label: 'Michelin Spots', icon: Award },
];
