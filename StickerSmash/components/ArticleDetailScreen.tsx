import React from 'react';
import { ScrollView, View, Text, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { openBrowserAsync } from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import type { Article, AffiliateItem } from '@/types/article';
import { s } from '@/styles/articleDetailStyles';

type Block =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'affiliate'; key: string };

function parseContent(content: string): Block[] {
  return content
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      if (p.startsWith('# ')) return { type: 'h1' as const, text: p.slice(2).trim() };
      if (p.startsWith('## ')) return { type: 'h2' as const, text: p.slice(3).trim() };
      if (p.startsWith('[Affiliate Slot: ')) {
        const key = p.slice('[Affiliate Slot: '.length, -1).trim();
        return { type: 'affiliate' as const, key };
      }
      const lines = p.split('\n');
      if (lines.length > 0 && lines.every(l => l.trimStart().startsWith('- '))) {
        return { type: 'bullets' as const, items: lines.map(l => l.trimStart().slice(2)) };
      }
      return { type: 'paragraph' as const, text: p };
    });
}

function AffiliateCard({ item }: { item: AffiliateItem }) {
  return (
    <View style={s.affiliateCard}>
      <View style={s.affiliateTop}>
        <Text style={s.affiliateTitle}>{item.title}</Text>
        {item.badge ? (
          <View style={s.affiliateBadge}>
            <Text style={s.affiliateBadgeText}>{item.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.affiliateDesc}>{item.description}</Text>
      <View style={s.affiliateBottom}>
        {item.price ? <Text style={s.affiliatePrice}>{item.price}</Text> : <View />}
        <TouchableOpacity
          style={s.affiliateBtn}
          onPress={() => openBrowserAsync(item.url)}
          activeOpacity={0.8}
        >
          <Text style={s.affiliateBtnText}>Shop Now →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function renderBlock(block: Block, index: number, affiliates: Record<string, AffiliateItem>) {
  switch (block.type) {
    case 'h1':
      return null; // title already shown in header
    case 'h2':
      return <Text key={index} style={s.h2}>{block.text}</Text>;
    case 'paragraph':
      return <Text key={index} style={s.paragraph}>{block.text}</Text>;
    case 'bullets':
      return (
        <View key={index} style={s.bulletGroup}>
          {block.items.map((item, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={s.bulletDot}>•</Text>
              <Text style={s.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'affiliate': {
      const item = affiliates?.[block.key];
      if (!item) return null;
      return <AffiliateCard key={index} item={item} />;
    }
    default:
      return null;
  }
}

export default function ArticleDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { article } = route.params as { article: Article };
  const blocks = parseContent(article.content || '');

  return (
    <SafeAreaView style={s.safe}>
      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
        <Ionicons name="arrow-back" size={22} color="#fff" />
      </TouchableOpacity>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Image
          source={{ uri: article.imageUrl }}
          style={s.heroImage}
          resizeMode="cover"
        />
        <View style={s.contentCard}>
          <View style={s.meta}>
            <View style={s.categoryPill}>
              <Text style={s.categoryText}>{article.category}</Text>
            </View>
            <Text style={s.readTime}>{article.readTimeMin} min read</Text>
          </View>
          <Text style={s.title}>{article.title}</Text>
          {blocks.map((block, i) => renderBlock(block, i, article.affiliates || {}))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
