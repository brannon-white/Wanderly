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
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 80,
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
          elevation: 0,
          shadowColor: '#000',
          shadowOpacity: 0.05,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: -1 },
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'SourceSans3-Regular',
          marginBottom: 8,
        },
        tabBarIconStyle: {
          marginTop: 8,
        },
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Discover') return <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />;
          if (route.name === 'Bookmarks') return <Ionicons name={focused ? 'bookmark' : 'bookmark-outline'} size={26} color={color} />;
          if (route.name === 'MyTrips') return <Ionicons name={focused ? 'location' : 'location-outline'} size={26} color={color} />;
          if (route.name === 'Profile') return <Ionicons name={focused ? 'person' : 'person-outline'} size={26} color={color} />;
        },
        tabBarActiveTintColor: '#6A62B7',
        tabBarInactiveTintColor: '#b0b0b0',
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Bookmarks" component={BookmarksScreen} options={{ tabBarLabel: 'Saved' }} />
      <Tab.Screen name="MyTrips" component={MyTripsScreen} options={{ tabBarLabel: 'My Trips' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
    {isDemoMode && <DemoNavigator />}
    </View>
  );
}