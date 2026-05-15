import React from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@/app/_layout';
import type { Article } from '@/types/article';
import { articleCardStyles as s } from '@/styles/discoverScreenStyles';

type NavProp = StackNavigationProp<RootStackParamList>;

export default function ArticleCard({ article }: { article: Article }) {
  const navigation = useNavigation<NavProp>();

  return (
    <Pressable
      onPress={() => navigation.navigate('ArticleDetail', { article })}
      style={({ pressed }) => [s.cardTouchable, pressed && { opacity: 0.88 }]}
    >
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
    </Pressable>
  );
}
