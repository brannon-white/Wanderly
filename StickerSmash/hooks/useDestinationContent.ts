import { useEffect, useState } from 'react';
import { fetchDestinationWikiContent, type DestinationWikiContent } from '@/services/wikiDestinationService';
import { fetchDestinationClaudeContent } from '@/services/destinationClaudeService';

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

    const wikiPromise = fetchDestinationWikiContent(cityName, country);
    const claudePromise = fetchDestinationClaudeContent(cityName, country);

    // Show wiki content immediately when it arrives
    wikiPromise.then(wiki => {
      setContent(wiki);
      setLoading(false);
    });

    // Merge Claude content once both settle — Claude fills any gaps wiki left
    Promise.all([wikiPromise, claudePromise]).then(([wiki, claude]) => {
      if (!claude) return;
      setContent({
        description: wiki.description || claude.description,
        wikiImageUrl: wiki.wikiImageUrl,
        gallery: wiki.gallery,
        language: wiki.language || claude.language,
        currency: wiki.currency || claude.currency,
        sections: {
          gettingThere: wiki.sections.gettingThere || claude.gettingThere,
          understand: wiki.sections.understand || claude.bestTime,
          see: wiki.sections.see || claude.attractions,
          do: wiki.sections.do || claude.activities,
          eat: wiki.sections.eat || claude.cuisine,
          sleep: wiki.sections.sleep || claude.accommodations,
          getAround: wiki.sections.getAround || claude.transportation,
          staySafe: wiki.sections.staySafe || claude.safety,
          visa: claude.visa,
        },
      });
    });
  }, [cityName, country]);

  return { content, loading };
}
