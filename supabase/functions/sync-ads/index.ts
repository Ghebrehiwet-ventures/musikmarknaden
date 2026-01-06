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

// Clean image URL by removing HTML entities and quotes
function cleanImageUrl(url: string): string {
  return url
    .replace(/&quot;/g, '')      // Remove &quot;
    .replace(/&amp;/g, '&')      // Decode &amp;
    .replace(/^["']|["']$/g, '') // Remove quotes at start/end
    .trim();
}

// Extract image URLs from HTML - builds a map from ad URL to image URL
function extractImageUrlsFromHtml(rawHtml: string): Map<string, string> {
  const urlToImage = new Map<string, string>();
  
  // Decode HTML entities BEFORE regex parsing
  const html = rawHtml
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
  
  // Pattern 1: Look for <a href="...gearloop.se/ID-slug..."><img src="..."/>
  // Gearloop uses cards with anchors containing images
  const cardRegex = /<a[^>]+href=["']?(https:\/\/gearloop\.se\/\d+[^"'\s>]+)["']?[^>]*>[\s\S]*?<img[^>]+(?:src|data-src)=["']?([^"'\s>]+)["']?/gi;
  
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const adUrl = match[1].split('?')[0]; // Remove query params
    let imageUrl = cleanImageUrl(match[2]);
    
    // Normalize image URL
    if (imageUrl && !imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = 'https://gearloop.se' + imageUrl;
      }
    }
    
    if (imageUrl && imageUrl.includes('assets.gearloop.se')) {
      urlToImage.set(adUrl, imageUrl);
    }
  }
  
  // Pattern 2: Reverse order - img before anchor (some layouts)
  const reverseRegex = /<img[^>]+(?:src|data-src)=["']?([^"'\s>]+)["']?[^>]*>[\s\S]*?<a[^>]+href=["']?(https:\/\/gearloop\.se\/\d+[^"'\s>]+)["']?/gi;
  
  while ((match = reverseRegex.exec(html)) !== null) {
    let imageUrl = cleanImageUrl(match[1]);
    const adUrl = match[2].split('?')[0];
    
    // Normalize image URL
    if (imageUrl && !imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = 'https://gearloop.se' + imageUrl;
      }
    }
    
    // Only add if not already found and is a valid image
    if (!urlToImage.has(adUrl) && imageUrl && imageUrl.includes('assets.gearloop.se')) {
      urlToImage.set(adUrl, imageUrl);
    }
  }
  
  // Pattern 3: Look for background-image:url(...) near ad links
  const bgImageRegex = /style=["'][^"']*background-image:\s*url\(["']?([^"')]+)["']?\)[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']?(https:\/\/gearloop\.se\/\d+[^"'\s>]+)["']?/gi;
  
  while ((match = bgImageRegex.exec(html)) !== null) {
    let imageUrl = cleanImageUrl(match[1]);
    const adUrl = match[2].split('?')[0];
    
    if (imageUrl && !imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = 'https://gearloop.se' + imageUrl;
      }
    }
    
    if (!urlToImage.has(adUrl) && imageUrl && imageUrl.includes('assets.gearloop.se')) {
      urlToImage.set(adUrl, imageUrl);
    }
  }
  
  console.log(`Extracted ${urlToImage.size} image URLs from HTML`);
  return urlToImage;
}

// Parse ads from Gearloop markdown
// Gearloop ads now use format: https://gearloop.se/123456-ad-title
function parseGearloopAds(html: string, markdown: string, internalCategory: string): Ad[] {
  const ads: Ad[] = [];
  
  // First extract image URLs from HTML
  const imageMap = extractImageUrlsFromHtml(html);
  
  // Parse markdown format: #### [Title](https://gearloop.se/123456-slug)
  // Followed by: price date
  const adBlockRegex = /####\s*\[([^\]]+)\]\((https:\/\/gearloop\.se\/\d+[^)]+)\)\s*\n\s*([^\n]*)/g;
  
  let match;
  while ((match = adBlockRegex.exec(markdown)) !== null) {
    const title = match[1].trim();
    const adUrl = match[2].trim().split('?')[0]; // Remove query params
    const priceAndDate = match[3].trim();
    
    // Parse price and date from "5 000 kr 17 dec" format
    const priceMatch = priceAndDate.match(/^([\d\s]+)\s*kr/);
    const priceText = priceMatch ? priceMatch[1].replace(/\s/g, '') + ' kr' : null;
    
    // Extract date (at the end after price)
    const dateMatch = priceAndDate.match(/(\d+\s+\w+)$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    
    // Look up image URL from our extracted map
    const imageUrl = imageMap.get(adUrl) || '';
    
    ads.push({
      title,
      ad_url: adUrl,
      category: internalCategory,
      location: '',
      date: dateStr || new Date().toISOString().split('T')[0],
      price_text: priceText,
      image_url: imageUrl,
    });
  }
  
  // Fallback: Also look for bare URLs with numeric prefix pattern
  if (ads.length === 0) {
    const urlRegex = /https:\/\/gearloop\.se\/(\d+)-([^)\s"]+)/g;
    const seenUrls = new Set<string>();
    
    while ((match = urlRegex.exec(markdown)) !== null) {
      const adUrl = match[0].split('?')[0];
      if (!seenUrls.has(adUrl)) {
        seenUrls.add(adUrl);
        const slug = match[2];
        const title = slug.replace(/-/g, ' ');
        const imageUrl = imageMap.get(adUrl) || '';
        
        ads.push({
          title,
          ad_url: adUrl,
          category: internalCategory,
          location: '',
          date: new Date().toISOString().split('T')[0],
          price_text: null,
          image_url: imageUrl,
        });
      }
    }
  }
  
  const withImages = ads.filter(a => a.image_url).length;
  console.log(`Found ${ads.length} ads in category (${withImages} with images)`);
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
        onlyMainContent: false, // Need full HTML to extract thumbnail images
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
  supabaseUrl: string,
  sourceId: string | null,
  sourceName: string
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
          source_id: sourceId,
          source_name: sourceName,
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

// Backfill images for ads that are missing them
async function backfillMissingImages(supabase: any, supabaseUrl: string, limit: number = 30): Promise<{ backfilled: number; failed: number }> {
  // Find ads with empty image_url
  const { data: adsWithoutImages, error } = await supabase
    .from('ad_listings_cache')
    .select('id, ad_url, title')
    .eq('is_active', true)
    .or('image_url.is.null,image_url.eq.')
    .limit(limit);

  if (error) {
    console.error('Failed to fetch ads without images:', error);
    return { backfilled: 0, failed: 0 };
  }

  if (!adsWithoutImages || adsWithoutImages.length === 0) {
    console.log('No ads missing images');
    return { backfilled: 0, failed: 0 };
  }

  console.log(`Backfilling images for ${adsWithoutImages.length} ads...`);
  
  let backfilled = 0;
  let failed = 0;

  for (const ad of adsWithoutImages) {
    try {
      const details = await fetchAdDetails(supabaseUrl, ad.ad_url);
      
      if (details && details.images && details.images.length > 0) {
        const imageUrl = details.images[0];
        
        const { error: updateError } = await supabase
          .from('ad_listings_cache')
          .update({ image_url: imageUrl })
          .eq('id', ad.id);
        
        if (updateError) {
          console.error(`Failed to update image for "${ad.title}":`, updateError);
          failed++;
        } else {
          console.log(`Backfilled image: ${ad.title.substring(0, 30)}...`);
          backfilled++;
        }
      } else {
        failed++;
      }
      
      await delay(500);
    } catch (err) {
      console.error(`Error backfilling ${ad.ad_url}:`, err);
      failed++;
    }
  }

  console.log(`Image backfill complete: ${backfilled} backfilled, ${failed} failed`);
  return { backfilled, failed };
}

// Pre-load ad details for new ads (runs in background)
async function preloadAdDetails(supabase: any, supabaseUrl: string, newAdUrls: Set<string>, limit: number = 20) {
  if (newAdUrls.size === 0) {
    console.log('No new ads to preload details for');
    return { preloaded: 0, failed: 0 };
  }

  const urlsToProcess = [...newAdUrls].slice(0, limit);
  console.log(`Preloading details (incl descriptions) for ${urlsToProcess.length} new ads...`);

  let preloaded = 0;
  let failed = 0;

  for (const adUrl of urlsToProcess) {
    const details = await fetchAdDetails(supabaseUrl, adUrl);
    
    if (details && details.title) {
      preloaded++;
      console.log(`Preloaded: ${details.title?.substring(0, 30)}... (desc: ${details.description?.length || 0} chars)`);
    } else {
      failed++;
    }
    
    // Rate limiting
    await delay(500);
  }

  console.log(`Preload complete: ${preloaded} loaded, ${failed} failed`);
  return { preloaded, failed };
}

// NOTE: Description backfill has been moved to separate edge function: backfill-descriptions
// This runs hourly via cron job with parallel processing for faster completion

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

async function syncAds(supabase: any, firecrawlApiKey: string, providedSourceId?: string) {
  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  
  // Get or find source info for Gearloop
  let sourceId: string | null = providedSourceId || null;
  let sourceName = 'Gearloop';
  
  if (!sourceId) {
    // Look up source by name
    const { data: source } = await supabase
      .from('scraping_sources')
      .select('id, name')
      .ilike('name', 'gearloop')
      .maybeSingle();
    
    if (source) {
      sourceId = source.id;
      sourceName = source.name;
      console.log(`Found source: ${sourceName} (${sourceId})`);
    } else {
      console.warn('No Gearloop source found in scraping_sources table');
    }
  } else {
    // Get source name from provided ID
    const { data: source } = await supabase
      .from('scraping_sources')
      .select('name')
      .eq('id', sourceId)
      .maybeSingle();
    
    if (source) {
      sourceName = source.name;
    }
  }

  // Create sync log entry at start
  let syncLogId: string | null = null;
  if (sourceId) {
    const { data: syncLog, error: logError } = await supabase
      .from('sync_logs')
      .insert({
        source_id: sourceId,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (logError) {
      console.error('Failed to create sync log:', logError);
    } else {
      syncLogId = syncLog.id;
      console.log(`Created sync log: ${syncLogId}`);
    }
  }

  try {
    // Step 1: Fetch all ads from Gearloop using Firecrawl
    const { allAds, newlyInsertedUrls } = await fetchAllAdsFromGearloop(firecrawlApiKey, supabase, supabaseUrl, sourceId, sourceName);
    
    if (allAds.length === 0) {
      console.log('No ads fetched, aborting sync');
      
      // Update sync log with failure
      if (syncLogId) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: 'No ads fetched from source',
          })
          .eq('id', syncLogId);
      }
      
      return { success: false, error: 'No ads fetched' };
    }

    // Step 2: Get current active ads from cache
    const { data: existingAds, error: fetchError } = await supabase
      .from('ad_listings_cache')
      .select('ad_url')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Failed to fetch existing ads:', fetchError);
      
      // Update sync log with failure
      if (syncLogId) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: fetchError.message,
          })
          .eq('id', syncLogId);
      }
      
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

    // Step 6: Preload ad details for new ads (up to 50 per sync to build cache faster)
    const preloadResult = await preloadAdDetails(supabase, supabaseUrl, newlyInsertedUrls, 50);

    // Step 7: Backfill images for any ads that are still missing them
    const backfillResult = await backfillMissingImages(supabase, supabaseUrl, 40);

    // NOTE: Description backfill now runs separately via backfill-descriptions function (hourly cron)

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Update sync log with success
    if (syncLogId) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          ads_found: allAds.length,
          ads_new: newlyInsertedUrls.size,
          ads_removed: removedUrls.length,
        })
        .eq('id', syncLogId);
      
      console.log(`Sync log ${syncLogId} updated: completed`);
    }
    
    return {
      success: true,
      totalAds: allAds.length,
      newAds: newlyInsertedUrls.size,
      removedAds: removedUrls.length,
      aiCategorized: aiNewResult.categorized + cleanupResult.categorized,
      detailsPreloaded: preloadResult.preloaded,
      imagesBackfilled: backfillResult.backfilled,
      duration: `${duration}s`,
    };
  } catch (error) {
    // Update sync log with failure
    if (syncLogId) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: errorMessage,
        })
        .eq('id', syncLogId);
      
      console.log(`Sync log ${syncLogId} updated: failed - ${errorMessage}`);
    }
    throw error;
  }
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
    
    // Get source_id from request body if provided
    const body = await req.json().catch(() => ({}));
    const sourceId = body.source_id;

    console.log('Starting ad sync with Firecrawl...');
    const result = await syncAds(supabase, firecrawlApiKey, sourceId);

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
