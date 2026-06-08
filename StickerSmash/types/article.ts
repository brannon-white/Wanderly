export type AffiliateItem = {
  title: string;
  description: string;
  url: string;
  price?: string;
  badge?: string;
  cta?: string; // button label, e.g. "Check Availability →" (defaults to "Shop Now →")
};

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  readTimeMin: number;
  content: string;
  affiliates: Record<string, AffiliateItem>;
  order?: number;
};
