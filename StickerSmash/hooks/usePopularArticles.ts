import { useEffect, useState } from 'react';
import firestore from '@react-native-firebase/firestore';
import { cacheGet, cacheSet } from '@/utils/cache';
import { useDemo } from '@/context/DemoContext';
import { DEMO_ARTICLES } from '@/data/demoData';
import type { Article } from '@/types/article';

const CACHE_KEY = 'popular-articles:v2';
const TTL_DAYS = 1;

export function usePopularArticles() {
  const { isDemoMode } = useDemo();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      setArticles(DEMO_ARTICLES);
      setLoading(false);
      return;
    }

    async function fetchArticles() {
      try {
        setLoading(true);

        const cached = await cacheGet<Article[]>(CACHE_KEY);
        if (cached && cached.length > 0) {
          setArticles(cached);
          setLoading(false);
          return;
        }

        const snapshot = await firestore()
          .collection('articles')
          .orderBy('order', 'asc')
          .limit(10)
          .get();

        const data: Article[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Article[];

        setArticles(data);
        await cacheSet(CACHE_KEY, data, TTL_DAYS);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch articles');
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, [isDemoMode]);

  return { articles, loading, error };
}
