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
  description?: string;
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
  specifications?: Array<{ label: string; value: string }>;
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
      .select('*, description')
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
      description: row.description || undefined,
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

// Check if a Blocket description looks like UI garbage instead of real ad content
function looksLikeBadBlocketDescription(description: string): boolean {
  if (!description || description.length < 10) return true;
  if (description === 'Ingen beskrivning tillgänglig') return true;
  
  // Check for common UI markers that indicate we scraped wrong content
  const badMarkers = [
    'Torget/',
    'Villkor',
    'Information och inspiration',
    'HouseBlocket',
    'Instagram-logotyp',
    'YouTube-logotyp',
    'Facebook-logotyp',
    'Gå till annonsen',
    'Om Blocket',
    'Kontakta oss',
    'Chevron',
    'Person silhouette',
    'Checklist checkmark',
    'En del av Vend',
    'upphovsrättslagen',
    'Du kanske också gillar',
    'Liknande annonser',
  ];
  
  // If description contains multiple UI markers, it's bad
  let markerCount = 0;
  for (const marker of badMarkers) {
    if (description.includes(marker)) {
      markerCount++;
      if (markerCount >= 2) return true;
    }
  }
  
  // Check if it's mostly short lines (typical of scraped navigation)
  const lines = description.split('\n').filter(l => l.trim());
  const shortLines = lines.filter(l => l.length < 20);
  if (lines.length > 5 && shortLines.length / lines.length > 0.7) {
    return true;
  }
  
  return false;
}

export async function getAdDetails(ad_url: string): Promise<AdDetails> {
  // 1. Check client-side cache first (instant)
  const { data: cached } = await supabase
    .from('ad_details_cache')
    .select('*')
    .eq('ad_url', ad_url)
    .maybeSingle();

  if (cached) {
    const daysSinceUpdate = (Date.now() - new Date(cached.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    
    // Blocket cache bypass: if only 0-1 images OR bad description, force re-scrape
    const isBlocket = ad_url.includes('blocket.se');
    const cachedImages = Array.isArray(cached.images) ? (cached.images as string[]) : [];
    const cachedDescription = cached.description || '';
    
    // Check if description looks like UI garbage
    const hasBadBlocketDescription = isBlocket && looksLikeBadBlocketDescription(cachedDescription);
    const hasBadBlocketImages = isBlocket && cachedImages.length <= 1;
    const bypassCacheForBlocket = hasBadBlocketImages || hasBadBlocketDescription;
    
    if (daysSinceUpdate < 7 && !bypassCacheForBlocket) {
      // Return cached data immediately!
      return {
        title: cached.title || '',
        description: cached.description || '',
        price_text: cached.price_text,
        price_amount: cached.price_amount,
        location: cached.location || '',
        images: cachedImages,
        contact_info: (cached.contact_info as { email?: string; phone?: string }) || {},
        seller: cached.seller as { name?: string; username?: string } | undefined,
        condition: cached.condition || undefined,
        specifications: (cached.specifications as Array<{ label: string; value: string }>) || [],
      };
    }
    // If Blocket with incomplete images, fall through to re-scrape
  }

  // 2. Cache miss or stale - call edge function
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
