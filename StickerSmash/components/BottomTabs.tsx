import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DiscoverScreen from '../app/(tabs)/index';
import BookmarksScreen from '../app/(tabs)/bookmarksScreen';
import MyTripsScreen from '../app/(tabs)/mapScreen';
import ProfileScreen from '../app/(tabs)/profileScreen';
import { Ionicons } from '@expo/vector-icons';
import { useDemo } from '@/context/DemoContext';
import DemoNavigator from './DemoNavigator';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  const { isDemoMode } = useDemo();
  return (
    <View style={{ flex: 1 }}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          borderRadius: 32,
          margin: 16,
          height: 64,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          boxShadow: '0px -2px 20px 0px rgba(0, 0, 0, 0.20)',
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Discover') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Bookmarks') return <Ionicons name="bookmark-outline" size={size} color={color} />;
          if (route.name === 'MyTrips') return <Ionicons name="location-outline" size={size} color={color} />;
          if (route.name === 'Profile') return <Ionicons name="person-outline" size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6A62B7',
        tabBarInactiveTintColor: '#bdbdbd',
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen name="Bookmarks" component={BookmarksScreen} />
      <Tab.Screen name="MyTrips" component={MyTripsScreen} options={{ tabBarLabel: 'My Trips' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    {isDemoMode && <DemoNavigator />}
    </View>
  );
}