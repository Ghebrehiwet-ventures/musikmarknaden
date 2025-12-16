import { supabase } from "@/integrations/supabase/client";

export interface Ad {
  ad_id: string;
  title: string;
  price: string;
  location: string;
}

export interface AdDetails extends Ad {
  description: string;
  images: string[];
  contact_info: {
    email?: string;
    phone?: string;
  };
}

export interface AdsResponse {
  ads: Ad[];
  page: number;
  per_page: number;
  total_ads: number;
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

export async function getAdDetails(ad_id: string): Promise<AdDetails> {
  return callParsebotProxy<AdDetails>('get_ad_details', { ad_id });
}
