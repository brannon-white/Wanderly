import { useEffect, useState } from 'react';
import { fetchDestinationWikiContent, type DestinationWikiContent } from '@/services/wikiDestinationService';

export function useDestinationContent(cityName: string, country: string) {
  const [content, setContent] = useState<DestinationWikiContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cityName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setContent(null);
    fetchDestinationWikiContent(cityName, country)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [cityName, country]);

  return { content, loading };
}
