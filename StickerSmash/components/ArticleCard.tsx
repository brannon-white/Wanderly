import React from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { openBrowserAsync } from 'expo-web-browser';
import type { Article } from '@/types/article';
import { articleCardStyles as s } from '@/styles/discoverScreenStyles';

export default function ArticleCard({ article }: { article: Article }) {
  const handlePress = async () => {
    try {
      await openBrowserAsync(article.url);
    } catch {
      // Nothing to do if browser fails to open
    }
  };

  // overflow:'hidden' is on the inner View, not the TouchableOpacity, so the
  // hit area is never clipped on iOS (a known issue with the New Architecture).
  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.88} style={s.cardTouchable}>
      <View style={s.card}>
        {article.imageUrl ? (
          <Image source={{ uri: article.imageUrl }} style={s.image} resizeMode="cover" />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <ActivityIndicator color="#6A62B7" />
          </View>
        )}
        <View style={s.overlay} pointerEvents="none" />
        <View style={s.content}>
          <View style={s.categoryPill}>
            <Text style={s.categoryText}>{article.category}</Text>
          </View>
          <Text style={s.title} numberOfLines={2}>{article.title}</Text>
          <Text style={s.readTime}>{article.readTimeMin} min read</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
