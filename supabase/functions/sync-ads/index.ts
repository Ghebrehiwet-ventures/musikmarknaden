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

const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

// All categories from Gearloop - URLs to scrape
const GEARLOOP_CATEGORIES = [
  { slug: 'akustiska-gitarrer-alla', internal: 'instrument' },
  { slug: 'basar-alla', internal: 'instrument' },
  { slug: 'blasinstrument-alla', internal: 'instrument' },
  { slug: 'elgitarrer-alla', internal: 'instrument' },
  { slug: 'strakinstrument-alla', internal: 'instrument' },
  { slug: 'klaviatur-alla', internal: 'instrument' },
  { slug: 'trummor-percussion-alla', internal: 'instrument' },
  { slug: 'synthar-alla', internal: 'synth-modular' },
  { slug: 'eurorack-alla', internal: 'synth-modular' },
  { slug: 'dj-utrustning-alla', internal: 'dj-live' },
  { slug: 'pedaler-effekter-alla', internal: 'pedals-effects' },
  { slug: 'gitarrforstarkare-alla', internal: 'amplifiers' },
  { slug: 'basforstarkare-alla', internal: 'amplifiers' },
  { slug: 'ovriga-forstarkare-alla', internal: 'amplifiers' },
  { slug: 'mikrofoner-alla', internal: 'studio' },
  { slug: 'pa-Live-alla', internal: 'dj-live' },
  { slug: 'api-500-series-alla', internal: 'studio' },
  { slug: 'studio-scenutrustning-alla', internal: 'studio' },
  { slug: 'datorer-alla', internal: 'software-computers' },
  { slug: 'mjukvara-plug-ins-alla', internal: 'software-computers' },
  { slug: 'reservdelar-ovrigt-alla', internal: 'accessories-parts' },
  { slug: 'studiomobler-alla', internal: 'studio' },
];

interface Ad {
  title: string;
  ad_url: string;
  category: string;
  location: string;
  date: string;
  price_text: string | null;
  image_url: string;
}

// Parse ads from Gearloop markdown
// Gearloop ads now use format: https://gearloop.se/123456-ad-title
function parseGearloopAds(html: string, markdown: string, internalCategory: string): Ad[] {
  const ads: Ad[] = [];
  
  // Parse markdown format: #### [Title](https://gearloop.se/123456-slug)
  // Followed by: price date
  const adBlockRegex = /####\s*\[([^\]]+)\]\((https:\/\/gearloop\.se\/\d+[^)]+)\)\s*\n\s*([^\n]*)/g;
  
  let match;
  while ((match = adBlockRegex.exec(markdown)) !== null) {
    const title = match[1].trim();
    const adUrl = match[2].trim();
    const priceAndDate = match[3].trim();
    
    // Parse price and date from "5 000 kr 17 dec" format
    const priceMatch = priceAndDate.match(/^([\d\s]+)\s*kr/);
    const priceText = priceMatch ? priceMatch[1].replace(/\s/g, '') + ' kr' : null;
    
    // Extract date (at the end after price)
    const dateMatch = priceAndDate.match(/(\d+\s+\w+)$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    
    ads.push({
      title,
      ad_url: adUrl,
      category: internalCategory,
      location: '',
      date: dateStr || new Date().toISOString().split('T')[0],
      price_text: priceText,
      image_url: '',
    });
  }
  
  // Fallback: Also look for bare URLs with numeric prefix pattern
  if (ads.length === 0) {
    const urlRegex = /https:\/\/gearloop\.se\/(\d+)-([^)\s"]+)/g;
    const seenUrls = new Set<string>();
    
    while ((match = urlRegex.exec(markdown)) !== null) {
      const adUrl = match[0];
      if (!seenUrls.has(adUrl)) {
        seenUrls.add(adUrl);
        const slug = match[2];
        const title = slug.replace(/-/g, ' ');
        
        ads.push({
          title,
          ad_url: adUrl,
          category: internalCategory,
          location: '',
          date: new Date().toISOString().split('T')[0],
          price_text: null,
          image_url: '',
        });
      }
    }
  }
  
  console.log(`Found ${ads.length} ads in category`);
  return ads;
}

// Fetch ads from a single Gearloop category page using Firecrawl
async function fetchCategoryWithFirecrawl(
  firecrawlApiKey: string, 
  category: { slug: string; internal: string }
): Promise<Ad[]> {
  const url = `https://gearloop.se/kategori/${category.slug}`;
  console.log(`Fetching category: ${url}`);
  
  try {
    const response = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error for ${category.slug}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    
    if (!html && !markdown) {
      console.warn(`No content for ${category.slug}`);
      return [];
    }
    
    const ads = parseGearloopAds(html, markdown, category.internal);
    console.log(`${category.slug}: Found ${ads.length} ads`);
    
    return ads;
  } catch (error) {
    console.error(`Error fetching ${category.slug}:`, error);
    return [];
  }
}

// Fetch ad details using firecrawl-ad-details function
async function fetchAdDetails(supabaseUrl: string, adUrl: string): Promise<any> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/firecrawl-ad-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_url: adUrl }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch details for ${adUrl}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching details for ${adUrl}:`, error);
    return null;
  }
}

async function fetchAllAdsFromGearloop(
  firecrawlApiKey: string, 
  supabase: any, 
  supabaseUrl: string
): Promise<{ allAds: Ad[], newlyInsertedUrls: Set<string> }> {
  const allAds: Ad[] = [];
  const seenUrls = new Set<string>();
  const newlyInsertedUrls = new Set<string>();

  console.log(`Starting to fetch ads from ${GEARLOOP_CATEGORIES.length} categories using Firecrawl...`);

  // Get existing ad URLs to detect truly new ads
  const { data: existingAds } = await supabase
    .from('ad_listings_cache')
    .select('ad_url');
  const existingUrlSet = new Set<string>(existingAds?.map((a: any) => a.ad_url) || []);

  for (const category of GEARLOOP_CATEGORIES) {
    try {
      const categoryAds = await fetchCategoryWithFirecrawl(firecrawlApiKey, category);
      
      // Deduplicate
      const newAdsInCategory: Ad[] = [];
      for (const ad of categoryAds) {
        if (!seenUrls.has(ad.ad_url)) {
          seenUrls.add(ad.ad_url);
          allAds.push(ad);
          newAdsInCategory.push(ad);
          
          if (!existingUrlSet.has(ad.ad_url)) {
            newlyInsertedUrls.add(ad.ad_url);
          }
        }
      }
      
      console.log(`${category.slug}: ${categoryAds.length} ads (${newAdsInCategory.length} unique, total: ${allAds.length})`);
      
      // Batch save after each category
      if (newAdsInCategory.length > 0) {
        const adsToSave = newAdsInCategory.map(ad => ({
          ad_url: ad.ad_url,
          ad_path: ad.ad_url.split('/').pop() || '',
          title: ad.title,
          category: ad.category,
          source_category: category.slug,
          source_name: 'gearloop',
          location: ad.location,
          date: ad.date,
          price_text: ad.price_text,
          price_amount: null,
          image_url: ad.image_url,
          is_active: true,
          last_seen_at: new Date().toISOString(),
        }));
        
        const { error: upsertError } = await supabase
          .from('ad_listings_cache')
          .upsert(adsToSave, { onConflict: 'ad_url' });
        
        if (upsertError) {
          console.error(`Failed to save ${category.slug}:`, upsertError);
        } else {
          console.log(`Saved ${newAdsInCategory.length} ads from ${category.slug}`);
        }
      }
      
      // Rate limiting - Firecrawl has limits
      await delay(1000);
    } catch (error) {
      console.error(`Error processing ${category.slug}:`, error);
    }
  }

  console.log(`Total unique ads fetched: ${allAds.length}, New ads: ${newlyInsertedUrls.size}`);
  return { allAds, newlyInsertedUrls };
}

// Pre-load ad details for new ads (runs in background)
async function preloadAdDetails(supabase: any, supabaseUrl: string, newAdUrls: Set<string>, limit: number = 10) {
  if (newAdUrls.size === 0) {
    console.log('No new ads to preload details for');
    return { preloaded: 0, failed: 0 };
  }

  const urlsToProcess = [...newAdUrls].slice(0, limit);
  console.log(`Preloading details for ${urlsToProcess.length} new ads...`);

  let preloaded = 0;
  let failed = 0;

  for (const adUrl of urlsToProcess) {
    const details = await fetchAdDetails(supabaseUrl, adUrl);
    
    if (details && details.title) {
      preloaded++;
      console.log(`Preloaded: ${details.title?.substring(0, 30)}...`);
    } else {
      failed++;
    }
    
    // Rate limiting
    await delay(500);
  }

  console.log(`Preload complete: ${preloaded} loaded, ${failed} failed`);
  return { preloaded, failed };
}

// AI-kategorisera nya annonser som hamnade i "other"
async function aiCategorizeNewOtherAds(supabase: any, supabaseUrl: string, newAdUrls: Set<string>) {
  if (newAdUrls.size === 0) {
    console.log('No new ads to AI-categorize');
    return { categorized: 0, failed: 0 };
  }

  console.log(`Starting AI categorization for ${newAdUrls.size} new ads...`);
  
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
    console.log('No new "other" ads to categorize');
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

    await delay(300);
  }

  return { categorized, failed };
}

async function syncAds(supabase: any, firecrawlApiKey: string) {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  
  // Step 1: Fetch all ads from Gearloop using Firecrawl
  const { allAds, newlyInsertedUrls } = await fetchAllAdsFromGearloop(firecrawlApiKey, supabase, supabaseUrl);
  
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

  console.log(`All ${allAds.length} ads saved, ${newlyInsertedUrls.size} are new`);

  // Step 4: AI categorize new "other" ads
  const aiNewResult = await aiCategorizeNewOtherAds(supabase, supabaseUrl, newlyInsertedUrls);

  // Step 5: Run cleanup categorization (process 20 existing "other" ads per sync)
  const cleanupResult = await runCleanupCategorization(supabase, supabaseUrl, 20);

  // Step 6: Preload ad details for new ads (up to 15 per sync to avoid timeouts)
  const preloadResult = await preloadAdDetails(supabase, supabaseUrl, newlyInsertedUrls, 15);

  const duration = Math.round((Date.now() - startTime) / 1000);
  
  return {
    success: true,
    totalAds: allAds.length,
    newAds: newlyInsertedUrls.size,
    removedAds: removedUrls.length,
    aiCategorized: aiNewResult.categorized + cleanupResult.categorized,
    detailsPreloaded: preloadResult.preloaded,
    duration: `${duration}s`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting ad sync with Firecrawl...');
    const result = await syncAds(supabase, firecrawlApiKey);

    console.log('Sync complete:', result);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
