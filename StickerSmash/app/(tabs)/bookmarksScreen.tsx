import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { RootStackParamList } from '@/app/_layout';
import type { StackNavigationProp } from '@react-navigation/stack';
export default function BookmarksScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>(); 

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Bookmarks Screen</Text>
      <TouchableOpacity
        style={styles.tempButton}
        onPress={() => navigation.navigate('TravelPreferences')}
      >
        <Text style={styles.tempButtonText}>Go to Travel Preferences</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  text: { fontSize: 24, color: '#6A62B7', fontWeight: 'bold' },
  tempButton: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#6A62B7',
    borderRadius: 8,
  },
  tempButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});