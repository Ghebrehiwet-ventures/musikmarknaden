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
  source_name: string | null;
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
  isDeadLink?: boolean;
  error?: string;
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
  // Use pagination to get all ads (Supabase default limit is 1000)
  const allAds: Ad[] = [];
  let from = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('ad_listings_cache')
      .select('*')
      .eq('is_active', true)
      .order('date', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message || 'Failed to fetch ads from cache');
    }

    if (!data || data.length === 0) {
      break;
    }

    const ads: Ad[] = data.map(row => ({
      title: row.title,
      ad_path: row.ad_path || '',
      ad_url: row.ad_url,
      category: row.category || '',
      location: row.location || '',
      date: row.date || '',
      price_text: row.price_text,
      price_amount: row.price_amount,
      image_url: row.image_url || '',
      source_name: row.source_name,
    }));

    allAds.push(...ads);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return {
    source_url: 'cache',
    count: allAds.length,
    ads: allAds,
  };
}

export async function getAdDetails(ad_url: string): Promise<AdDetails> {
  // Use Firecrawl to scrape ad details directly from Gearloop
  const { data, error } = await supabase.functions.invoke('firecrawl-ad-details', {
    body: { ad_url },
  });

  // Handle dead link responses
  if (data?.isDeadLink) {
    return {
      title: '',
      description: '',
      price_text: null,
      price_amount: null,
      location: '',
      images: [],
      contact_info: {},
      isDeadLink: true,
      error: data.message || 'Annonsen finns inte längre',
    };
  }

  if (error) {
    throw new Error(error.message || 'Failed to get ad details');
  }

  return data as AdDetails;
}
