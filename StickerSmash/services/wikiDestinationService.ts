import { searchPhotos } from '@/services/unsplash';

export interface DestinationWikiContent {
  description: string;
  wikiImageUrl?: string;
  gallery: string[];
  language?: string;
  currency?: string;
  sections: {
    understand?: string;
    gettingThere?: string;
    getAround?: string;
    see?: string;
    do?: string;
    eat?: string;
    sleep?: string;
    staySafe?: string;
    visa?: string;
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function truncate(text: string, maxChars = 500): string {
  if (text.length <= maxChars) return text;
  const cut = text.lastIndexOf(' ', maxChars);
  return text.slice(0, cut > 0 ? cut : maxChars) + '…';
}

const SECTION_MAP: Record<string, keyof DestinationWikiContent['sections']> = {
  'understand': 'understand',
  'get in': 'gettingThere',
  'get around': 'getAround',
  'see': 'see',
  'do': 'do',
  'eat': 'eat',
  'drink/sleep': 'sleep',
  'sleep': 'sleep',
  'stay safe': 'staySafe',
  'stay healthy': 'staySafe',
};

async function fetchCountryInfo(country: string): Promise<{ language?: string; currency?: string }> {
  try {
    const res = await fetch(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fields=languages,currencies`
    );
    if (!res.ok) return {};
    const data = await res.json();
    const first = data?.[0];
    if (!first) return {};
    const language = (Object.values(first.languages ?? {}) as string[])[0];
    const currencyData = (Object.values(first.currencies ?? {}) as any[])[0];
    const currency = currencyData
      ? `${currencyData.name}${currencyData.symbol ? ` (${currencyData.symbol})` : ''}`
      : undefined;
    return { language, currency };
  } catch {
    return {};
  }
}

export async function fetchDestinationWikiContent(
  cityName: string,
  country: string,
): Promise<DestinationWikiContent> {
  const result: DestinationWikiContent = { description: '', gallery: [], sections: {} };
  const encoded = encodeURIComponent(cityName);

  await Promise.all([
    // Wikipedia: description + fallback hero image
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        result.description = data.extract ?? '';
        result.wikiImageUrl = data.thumbnail?.source;
      })
      .catch(() => {}),

    // Wikivoyage: travel sections
    fetch(`https://en.wikivoyage.org/api/rest_v1/page/mobile-sections/${encoded}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const sections: any[] = data.remaining?.sections ?? [];
        for (const section of sections) {
          const heading = stripHtml(section.line ?? '').toLowerCase().trim();
          const key = SECTION_MAP[heading];
          if (key && section.text) {
            result.sections[key] = truncate(stripHtml(section.text));
          }
        }
      })
      .catch(() => {}),

    // RestCountries: language + currency
    fetchCountryInfo(country).then(info => {
      result.language = info.language;
      result.currency = info.currency;
    }),

    // Unsplash: gallery images (cached 30 days)
    searchPhotos(`${cityName} ${country}`, 4).then(urls => {
      result.gallery = urls;
    }),
  ]);

  return result;
}
