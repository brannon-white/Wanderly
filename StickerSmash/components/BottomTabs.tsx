import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DiscoverScreen from '../app/(tabs)/index';
//import BookmarksScreen from './(tabs)/bookmarksScreen'; // Create this file
//import MapScreen from '.app/(tabs)/mapScreen';             // Create this file
//import ProfileScreen from './(tabs)/profileScreen';     // Create this file
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function BottomTabs() {
  return (
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
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Discover') return <Ionicons name="home" size={size} color={color} />;
          if (route.name === 'Bookmarks') return <Ionicons name="bookmark-outline" size={size} color={color} />;
          if (route.name === 'Map') return <Ionicons name="location-outline" size={size} color={color} />;
          if (route.name === 'Profile') return <Ionicons name="person-outline" size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6A62B7',
        tabBarInactiveTintColor: '#bdbdbd',
      })}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen} />
{/*       <Tab.Screen name="Bookmarks" component={BookmarksScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} /> */}
    </Tab.Navigator>
  );
}