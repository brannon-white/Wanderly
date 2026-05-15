import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '@/app/_layout';

type RouteParams = RouteProp<RootStackParamList, 'ArticleWebView'>;

export default function ArticleWebViewScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();
  const { url, title, category } = route.params;
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, left: 10, bottom: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          {category ? <Text style={styles.category}>{category}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
      </View>

      {loading && (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#6A62B7" />
        </View>
      )}

      <WebView
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  category: {
    fontSize: 11,
    color: '#6A62B7',
    fontFamily: 'SourceSans3-Regular',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    color: '#222',
    fontFamily: 'Merriweather_36pt-Bold',
  },
  loader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
});
