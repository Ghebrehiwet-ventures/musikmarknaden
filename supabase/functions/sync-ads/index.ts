import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// AI categorization using Lovable AI (Gemini 2.5 Flash)
async function categorizeWithAI(
  supabaseUrl: string,
  title: string,
  imageUrl?: string
): Promise<string | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/categorize-ad`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, image_url: imageUrl }),
    });

    if (!response.ok) {
      console.error(`AI categorization failed for "${title}": ${response.status}`);
      return null;
    }

    const result = await response.json();
    if (result.category && result.confidence !== 'low') {
      console.log(`AI: "${title.substring(0, 40)}..." -> ${result.category} (${result.confidence})`);
      return result.category;
    }
    return null;
  } catch (error) {
    console.error(`AI categorization error for "${title}":`, error);
    return null;
  }
}

const PARSEBOT_API_BASE = 'https://api.parse.bot/scraper/0f1f1694-68f5-4a07-8498-3b2e8a026a74';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// All categories from Gearloop
const GEARLOOP_CATEGORIES = [
  'akustiska-gitarrer-alla',
  'basar-alla',
  'blasinstrument-alla',
  'elgitarrer-alla',
  'strakinstrument-alla',
  'klaviatur-alla',
  'synthar-alla',
  'eurorack-alla',
  'trummor-percussion-alla',
  'service-reparation-alla',
  'dj-utrustning-alla',
  'pedaler-effekter-alla',
  'gitarrforstarkare-alla',
  'basf%C3%B6rstarkare-alla',
  'ovriga-forstarkare-alla',
  'mikrofoner-alla',
  'pa-Live-alla',
  'api-500-series-alla',
  'studio-scenutrustning-alla',
  'datorer-alla',
  'mjukvara-plug-ins-alla',
  'reservdelar-ovrigt-alla',
  'studiomobler-alla',
  'sangare-alla',
  'basist-alla',
  'gitarrist-alla',
  'keyboardist-alla',
  'klassisk-alla',
  'trummis-alla',
  'blasare-alla',
  'ovriga-alla',
  'replokaler-alla',
  'studiolokaler-alla',
  'lektioner-alla',
  'kompositorer-alla',
  'producenter-alla',
  'mastering-alla',
  'distribution-alla',
  'artwork-design-alla',
  'promotionfoto-alla',
  'litteratur-noter-alla',
];

// Map Gearloop categories to internal categories
const GEARLOOP_CATEGORY_MAP: Record<string, string> = {
  'akustiska-gitarrer-alla': 'instrument',
  'basar-alla': 'instrument',
  'blasinstrument-alla': 'instrument',
  'elgitarrer-alla': 'instrument',
  'strakinstrument-alla': 'instrument',
  'klaviatur-alla': 'instrument',
  'trummor-percussion-alla': 'instrument',
  'synthar-alla': 'synth-modular',
  'eurorack-alla': 'synth-modular',
  'service-reparation-alla': 'services',
  'dj-utrustning-alla': 'dj-live',
  'pedaler-effekter-alla': 'pedals-effects',
  'gitarrforstarkare-alla': 'amplifiers',
  'basf%C3%B6rstarkare-alla': 'amplifiers',
  'ovriga-forstarkare-alla': 'amplifiers',
  'mikrofoner-alla': 'studio',
  'pa-Live-alla': 'dj-live',
  'api-500-series-alla': 'studio',
  'studio-scenutrustning-alla': 'studio',
  'datorer-alla': 'software-computers',
  'mjukvara-plug-ins-alla': 'software-computers',
  'reservdelar-ovrigt-alla': 'accessories-parts',
  'studiomobler-alla': 'studio',
  'sangare-alla': 'services',
  'basist-alla': 'services',
  'gitarrist-alla': 'services',
  'keyboardist-alla': 'services',
  'klassisk-alla': 'services',
  'trummis-alla': 'services',
  'blasare-alla': 'services',
  'ovriga-alla': 'other',
  'replokaler-alla': 'services',
  'studiolokaler-alla': 'services',
  'lektioner-alla': 'services',
  'kompositorer-alla': 'services',
  'producenter-alla': 'services',
  'mastering-alla': 'services',
  'distribution-alla': 'services',
  'artwork-design-alla': 'services',
  'promotionfoto-alla': 'services',
  'litteratur-noter-alla': 'other',
};

function mapGearloopCategory(externalCategory: string): string {
  return GEARLOOP_CATEGORY_MAP[externalCategory] || 'other';
}

interface Ad {
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

interface AdsResponse {
  source_url: string;
  count: number;
  ads: Ad[];
}

async function fetchAdsForCategory(parsebotApiKey: string, category: string): Promise<Ad[]> {
  const categoryAds: Ad[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${PARSEBOT_API_BASE}/fetch_ad_listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': parsebotApiKey,
      },
      body: JSON.stringify({ page, category }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${category} page ${page}: ${response.status}`);
      break;
    }

    const data: AdsResponse = await response.json();

    if (data.ads.length === 0) {
      hasMore = false;
    } else {
      categoryAds.push(...data.ads);
      page++;
      
      // Safety limit per category
      if (page > 20) {
        console.warn(`Reached page limit for ${category}, stopping`);
        hasMore = false;
      }
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  return categoryAds;
}

async function fetchAllAdsFromParsebot(parsebotApiKey: string, supabase: any, supabaseUrl: string): Promise<{ allAds: Ad[], newlyInsertedUrls: Set<string> }> {
  const allAds: Ad[] = [];
  const seenUrls = new Set<string>();
  const newlyInsertedUrls = new Set<string>();

  console.log(`Starting to fetch ads from ${GEARLOOP_CATEGORIES.length} categories...`);

  // Get existing ad URLs to detect truly new ads
  const { data: existingAds } = await supabase
    .from('ad_listings_cache')
    .select('ad_url');
  const existingUrlSet = new Set<string>(existingAds?.map((a: any) => a.ad_url) || []);

  for (const category of GEARLOOP_CATEGORIES) {
    console.log(`Fetching category: ${category}`);
    
    try {
      const categoryAds = await fetchAdsForCategory(parsebotApiKey, category);
      
      // Deduplicate in case ads appear in multiple categories
      const newAdsInCategory: Ad[] = [];
      for (const ad of categoryAds) {
        if (!seenUrls.has(ad.ad_url)) {
          seenUrls.add(ad.ad_url);
          allAds.push(ad);
          newAdsInCategory.push(ad);
          
          // Track truly new ads (not in DB yet)
          if (!existingUrlSet.has(ad.ad_url)) {
            newlyInsertedUrls.add(ad.ad_url);
          }
        }
      }
      
      console.log(`${category}: ${categoryAds.length} ads (${newAdsInCategory.length} unique, total: ${allAds.length})`);
      
      // BATCH SAVE after each category to prevent timeout data loss
      if (newAdsInCategory.length > 0) {
        const internalCategory = mapGearloopCategory(category);
        const adsToSave = newAdsInCategory.map(ad => ({
          ad_url: ad.ad_url,
          ad_path: ad.ad_path,
          title: ad.title,
          category: internalCategory,
          source_category: category, // Store original category for mapping
          location: ad.location,
          date: ad.date,
          price_text: ad.price_text,
          price_amount: ad.price_amount,
          image_url: ad.image_url,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        }));
        
        const { error: upsertError } = await supabase
          .from('ad_listings_cache')
          .upsert(adsToSave, { onConflict: 'ad_url' });
        
        if (upsertError) {
          console.error(`Failed to save ${category}:`, upsertError);
        } else {
          console.log(`Saved ${newAdsInCategory.length} ads from ${category}`);
        }
      }
      
      // Small delay between categories
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${category}:`, error);
    }
  }

  console.log(`Total unique ads fetched: ${allAds.length}, New ads: ${newlyInsertedUrls.size}`);
  return { allAds, newlyInsertedUrls };
}

// AI-kategorisera nya annonser som hamnade i "other"
async function aiCategorizeNewOtherAds(supabase: any, supabaseUrl: string, newAdUrls: Set<string>) {
  if (newAdUrls.size === 0) {
    console.log('No new ads to AI-categorize');
    return { categorized: 0, failed: 0 };
  }

  console.log(`Starting AI categorization for ${newAdUrls.size} new ads...`);
  
  // Hämta nya annonser som hamnade i "other"
  const { data: otherAds, error } = await supabase
    .from('ad_listings_cache')
    .select('id, title, image_url, category, ad_url')
    .eq('category', 'other')
    .eq('is_active', true)
    .in('ad_url', [...newAdUrls]);
  
  if (error) {
    console.error('Failed to fetch new "other" ads:', error);
    return { categorized: 0, failed: 0 };
  }
  
  if (!otherAds || otherAds.length === 0) {
    console.log('No new "other" ads to categorize (all already categorized)');
    return { categorized: 0, failed: 0 };
  }
  
  console.log(`Found ${otherAds.length} new ads in "other" to AI-categorize`);
  
  let categorized = 0;
  let failed = 0;
  
  for (const ad of otherAds) {
    const aiCategory = await categorizeWithAI(supabaseUrl, ad.title, ad.image_url);
    
    if (aiCategory && aiCategory !== 'other') {
      const { error: updateError } = await supabase
        .from('ad_listings_cache')
        .update({ category: aiCategory })
        .eq('id', ad.id);
      
      if (updateError) {
        console.error(`Failed to update category for "${ad.title}":`, updateError);
        failed++;
      } else {
        console.log(`AI: "${ad.title.substring(0, 30)}..." -> ${aiCategory}`);
        categorized++;
      }
    } else {
      failed++;
    }
    
    // Rate limiting: 300ms mellan AI-anrop
    await delay(300);
  }
  
  console.log(`AI categorization complete: ${categorized} categorized, ${failed} failed/unchanged`);
  return { categorized, failed };
}

// Cleanup categorization - process existing "other" ads gradually
async function runCleanupCategorization(
  supabase: any,
  supabaseUrl: string,
  limit: number
): Promise<{ categorized: number; failed: number }> {
  // Fetch existing "other" ads (oldest first, so we process them in order)
  const { data: otherAds, error } = await supabase
    .from('ad_listings_cache')
    .select('id, title, image_url, category')
    .eq('category', 'other')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch existing "other" ads for cleanup:', error);
    return { categorized: 0, failed: 0 };
  }

  if (!otherAds || otherAds.length === 0) {
    console.log('No existing "other" ads to cleanup');
    return { categorized: 0, failed: 0 };
  }

  console.log(`Cleanup: Processing ${otherAds.length} existing "other" ads...`);

  let categorized = 0;
  let failed = 0;

  for (const ad of otherAds) {
    const aiCategory = await categorizeWithAI(supabaseUrl, ad.title, ad.image_url);

    if (aiCategory && aiCategory !== 'other') {
      const { error: updateError } = await supabase
        .from('ad_listings_cache')
        .update({ category: aiCategory })
        .eq('id', ad.id);

      if (updateError) {
        console.error(`Cleanup: Failed to update "${ad.title}":`, updateError);
        failed++;
      } else {
        console.log(`Cleanup: "${ad.title.substring(0, 30)}..." -> ${aiCategory}`);
        categorized++;
      }
    } else {
      failed++;
    }

    // Rate limiting: 300ms between AI calls
    await delay(300);
  }

  return { categorized, failed };
}


async function fetchAdDetails(adUrl: string, firecrawlApiKey: string): Promise<any> {
  console.log(`Fetching details for: ${adUrl}`);
  
  const response = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: adUrl,
      formats: ['markdown', 'extract'],
      extract: {
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            price_text: { type: 'string' },
            price_amount: { type: 'number' },
            location: { type: 'string' },
            images: { type: 'array', items: { type: 'string' } },
            contact_email: { type: 'string' },
            contact_phone: { type: 'string' },
            seller_name: { type: 'string' },
            seller_username: { type: 'string' },
            condition: { type: 'string' },
          },
          required: ['title'],
        },
      },
      onlyMainContent: true,
      waitFor: 2000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Firecrawl error for ${adUrl}: ${errorText}`);
    return null;
  }

  const data = await response.json();
  const extractData = data.data?.extract || data.extract || {};
  
  return {
    title: extractData.title || null,
    description: extractData.description || null,
    price_text: extractData.price_text || null,
    price_amount: extractData.price_amount || null,
    location: extractData.location || null,
    images: extractData.images || [],
    contact_info: {
      email: extractData.contact_email || null,
      phone: extractData.contact_phone || null,
    },
    seller: {
      name: extractData.seller_name || null,
      username: extractData.seller_username || null,
    },
    condition: extractData.condition || null,
  };
}

async function syncAds(supabase: any, parsebotApiKey: string, firecrawlApiKey: string) {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  
  // Step 1: Fetch all ads from parse.bot (saves batch-wise during fetch)
  const { allAds, newlyInsertedUrls } = await fetchAllAdsFromParsebot(parsebotApiKey, supabase, supabaseUrl);
  
  if (allAds.length === 0) {
    console.log('No ads fetched, aborting sync');
    return { success: false, error: 'No ads fetched' };
  }

  // Step 2: Get current active ads from cache
  const { data: existingAds, error: fetchError } = await supabase
    .from('ad_listings_cache')
    .select('ad_url')
    .eq('is_active', true);

  if (fetchError) {
    console.error('Failed to fetch existing ads:', fetchError);
    return { success: false, error: fetchError.message };
  }

  const existingUrls = new Set<string>(existingAds?.map((a: any) => a.ad_url) || []);
  const newUrls = new Set<string>(allAds.map(a => a.ad_url));

  // Step 3: Mark removed ads as inactive
  const removedUrls = [...existingUrls].filter((url: string) => !newUrls.has(url));
  if (removedUrls.length > 0) {
    console.log(`Marking ${removedUrls.length} ads as inactive`);
    const { error: updateError } = await supabase
      .from('ad_listings_cache')
      .update({ is_active: false })
      .in('ad_url', removedUrls);
    
    if (updateError) {
      console.error('Failed to mark ads as inactive:', updateError);
    }
  }

  // Step 4: Ads are already upserted batch-wise during fetch - skip redundant upsert
  console.log(`All ${allAds.length} ads saved, ${newlyInsertedUrls.size} are new`);

  // Step 5: AI categorize NEW ads that ended up in "other" (automatic categorization)
  let aiCategorized = 0;
  if (supabaseUrl && newlyInsertedUrls.size > 0) {
    console.log(`Running automatic AI categorization on ${newlyInsertedUrls.size} new ads...`);
    const aiResult = await aiCategorizeNewOtherAds(supabase, supabaseUrl, newlyInsertedUrls);
    aiCategorized = aiResult.categorized;
    console.log(`AI auto-categorized ${aiCategorized} new ads`);
  }

  // Step 5b: Cleanup categorization - process up to 50 existing "other" ads per sync
  let cleanupCategorized = 0;
  if (supabaseUrl) {
    console.log('Running cleanup categorization on existing "other" ads...');
    const cleanupResult = await runCleanupCategorization(supabase, supabaseUrl, 50);
    cleanupCategorized = cleanupResult.categorized;
    console.log(`Cleanup categorized ${cleanupCategorized} existing "other" ads`);
  }

  // Step 6: Find ads without details in cache
  const { data: cachedDetails, error: cacheError } = await supabase
    .from('ad_details_cache')
    .select('ad_url');

  if (cacheError) {
    console.error('Failed to fetch cached details:', cacheError);
  }

  const cachedDetailUrls = new Set(cachedDetails?.map((d: any) => d.ad_url) || []);
  const adsNeedingDetails = allAds.filter(ad => !cachedDetailUrls.has(ad.ad_url));

  console.log(`${adsNeedingDetails.length} ads need details fetched`);

  // Step 7: Fetch details for new ads (with rate limiting)
  let detailsFetched = 0;
  const maxDetailsPerSync = 50; // Limit to prevent timeout

  for (const ad of adsNeedingDetails.slice(0, maxDetailsPerSync)) {
    try {
      const details = await fetchAdDetails(ad.ad_url, firecrawlApiKey);
      
      if (details) {
        const { error: insertError } = await supabase
          .from('ad_details_cache')
          .upsert({
            ad_url: ad.ad_url,
            title: details.title,
            description: details.description,
            price_text: details.price_text,
            price_amount: details.price_amount,
            location: details.location,
            images: details.images,
            contact_info: details.contact_info,
            seller: details.seller,
            condition: details.condition,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'ad_url' });

        if (insertError) {
          console.error(`Failed to cache details for ${ad.ad_url}:`, insertError);
        } else {
          detailsFetched++;
        }
      }

      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching details for ${ad.ad_url}:`, error);
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  
  const result = {
    success: true,
    totalAds: allAds.length,
    newAds: newlyInsertedUrls.size,
    aiCategorized,
    cleanupCategorized,
    detailsFetched,
    removedAds: removedUrls.length,
    durationSeconds: duration,
  };

  console.log('Sync complete:', result);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const parsebotApiKey = Deno.env.get('PARSEBOT_API_KEY');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsebotApiKey) {
      console.error('Missing PARSEBOT_API_KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing PARSEBOT_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!firecrawlApiKey) {
      console.error('Missing FIRECRAWL_API_KEY');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing FIRECRAWL_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting ad sync...');
    
    // Run sync directly (edge functions have 150s timeout)
    const result = await syncAds(supabase, parsebotApiKey, firecrawlApiKey);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-ads:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
