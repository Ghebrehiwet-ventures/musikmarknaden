import { supabase } from "@/integrations/supabase/client";

export interface Ad {
  title: string;
  ad_path: string;
  ad_url: string;
  category: string;
  location: string;
  date: string;
  price_text: string | null;
  price_amount: number | null;
  image_url: string;
}

export interface AdDetails {
  title: string;
  description: string;
  price_text: string | null;
  price_amount: number | null;
  location: string;
  images: string[];
  contact_info: {
    email?: string;
    phone?: string;
  };
  seller?: {
    name?: string;
    username?: string;
  };
  condition?: string;
}

export interface AdsResponse {
  source_url: string;
  count: number;
  ads: Ad[];
}

async function callParsebotProxy<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('parsebot-proxy', {
    body: { endpoint, payload },
  });

  if (error) {
    throw new Error(error.message || 'Failed to call parsebot proxy');
  }

  return data as T;
}

export async function fetchAdListings(): Promise<AdsResponse> {
  // Fetch all active ads directly from the cache
  const { data, error } = await supabase
    .from('ad_listings_cache')
    .select('*')
    .eq('is_active', true)
    .order('date', { ascending: false });

  if (error) {
    throw new Error(error.message || 'Failed to fetch ads from cache');
  }

  const ads: Ad[] = (data || []).map(row => ({
    title: row.title,
    ad_path: row.ad_path || '',
    ad_url: row.ad_url,
    category: row.category || '',
    location: row.location || '',
    date: row.date || '',
    price_text: row.price_text,
    price_amount: row.price_amount,
    image_url: row.image_url || '',
  }));

  return {
    source_url: 'cache',
    count: ads.length,
    ads,
  };
}

export async function getAdDetails(ad_url: string): Promise<AdDetails> {
  // Use Firecrawl to scrape ad details directly from Gearloop
  const { data, error } = await supabase.functions.invoke('firecrawl-ad-details', {
    body: { ad_url },
  });

  if (error) {
    throw new Error(error.message || 'Failed to get ad details');
  }

  return data as AdDetails;
}
