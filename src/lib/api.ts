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

export async function fetchAdListings(category?: string, page: number = 1): Promise<AdsResponse> {
  return callParsebotProxy<AdsResponse>('fetch_ad_listings', { category, page });
}

export async function getAdDetails(ad_url: string): Promise<AdDetails> {
  return callParsebotProxy<AdDetails>('get_ad_details', { ad_url });
}
