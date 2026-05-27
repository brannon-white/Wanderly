import { Mountain, Building2, Landmark, Tent, Umbrella, Leaf, Hotel, Car, Utensils, Backpack, Ship, House, MountainSnow, Wine, PawPrint, Palette, Castle, Sprout } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

export const INTERESTS: { label: string; icon: LucideIcon }[] = [
  { label: 'Adventure Travel', icon: Mountain },
  { label: 'City Breaks', icon: Building2 },
  { label: 'Cultural Exploration', icon: Landmark },
  { label: 'Glamping', icon: Tent },
  { label: 'Beach Vacations', icon: Umbrella },
  { label: 'Nature Escapes', icon: Leaf },
  { label: 'Relaxing Getaways', icon: Hotel },
  { label: 'Road Trips', icon: Car },
  { label: 'Food Tourism', icon: Utensils },
  { label: 'Backpacking', icon: Backpack },
  { label: 'Cruise Vacations', icon: Ship },
  { label: 'Staycations', icon: House },
  { label: 'Skiing/Snowboarding', icon: MountainSnow },
  { label: 'Wine Tours', icon: Wine },
  { label: 'Wildlife Safaris', icon: PawPrint },
  { label: 'Art Galleries', icon: Palette },
  { label: 'Historical Sites', icon: Castle },
  { label: 'Eco-Tourism', icon: Sprout },
];

export type Interest = typeof INTERESTS[number];
