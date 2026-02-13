import { createClient } from "npm:@supabase/supabase-js@2";

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

// Gearloop category slug -> internal category mapping
// Category pages on Gearloop all show the same global listing, so we paginate
// the main page (gearloop.se/?page=N) and use the category link in each ad card
// to determine the internal category.
const GEARLOOP_CATEGORY_MAP: Record<string, string> = {
  'akustiska-gitarrer': 'guitars-bass',
  'basar': 'guitars-bass',
  'elgitarrer': 'guitars-bass',
  'strakinstrument': 'strings-other',
  'blasinstrument': 'wind-brass',
  'klaviatur': 'keys-pianos',
  'trummor-percussion': 'drums-percussion',
  'synthar': 'synth-modular',
  'eurorack': 'synth-modular',
  'dj-utrustning': 'dj-live',
  'pa-live': 'dj-live',
  'pedaler-effekter': 'pedals-effects',
  'gitarrforstarkare': 'amplifiers',
  'basforstarkare': 'amplifiers',
  'ovriga-forstarkare': 'amplifiers',
  'mikrofoner': 'studio',
  'api-500-series': 'studio',
  'studio-scenutrustning': 'studio',
  'studiomobler': 'studio',
  'datorer': 'software-computers',
  'mjukvara-plug-ins': 'software-computers',
  'reservdelar-ovrigt': 'accessories-parts',
  'service-reparation': 'services',
};

interface Ad {
  title: string;
  ad_url: string;
  category: string;
  location: string;
  date: string;
  price_text: string | null;
  price_amount: number | null;
  image_url: string;
  source_category?: string;
}

interface ScrapeQualityConfig {
  min_ads?: number;
  max_invalid_ratio?: number;
  min_image_ratio?: number;
  require_images?: boolean;
}

interface QualityReport {
  total: number;
  valid: number;
  invalid: number;
  invalid_ratio: number;
  image_ratio: number;
}

const DEFAULT_QUALITY_CONFIG: Required<ScrapeQualityConfig> = {
  min_ads: 1,
  max_invalid_ratio: 0.4,
  min_image_ratio: 0.1,
  require_images: false,
};

// Clean image URL by removing HTML entities and quotes
function cleanImageUrl(url: string): string {
  return url
    .replace(/&quot;/g, '')      // Remove &quot;
    .replace(/&amp;/g, '&')      // Decode &amp;
    .replace(/^["']|["']$/g, '') // Remove quotes at start/end
    .trim();
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeGearloopAd(ad: Ad): Ad | null {
  const title = normalizeText(ad.title);
  const adUrl = normalizeText(ad.ad_url);
  const imageUrl = normalizeText(ad.image_url || '');
  const location = normalizeText(ad.location || '');

  if (!title || title.length < 3) return null;
  if (!adUrl.startsWith('https://gearloop.se/')) return null;

  return {
    ...ad,
    title,
    ad_url: adUrl.split('?')[0],
    image_url: imageUrl,
    location,
  };
}

function getAbortReason(
  sourceName: string,
  report: QualityReport,
  config: Required<ScrapeQualityConfig>
): string | null {
  if (report.valid === 0) {
    return `Quality gate failed for ${sourceName}: no valid ads parsed`;
  }

  if (report.total >= 10 && report.invalid_ratio > config.max_invalid_ratio) {
    return `Quality gate failed for ${sourceName}: invalid_ratio=${report.invalid_ratio.toFixed(2)}`;
  }

  if (config.require_images && report.image_ratio < config.min_image_ratio) {
    return `Quality gate failed for ${sourceName}: image_ratio=${report.image_ratio.toFixed(2)}`;
  }

  if (report.valid < config.min_ads) {
    return `Quality gate failed for ${sourceName}: valid=${report.valid} < min_ads=${config.min_ads}`;
  }

  return null;
}

function normalizeAndValidateAds(
  ads: Ad[],
  sourceName: string,
  qualityConfig?: ScrapeQualityConfig
): { ads: Ad[]; report: QualityReport; abort_reason: string | null } {
  const config = { ...DEFAULT_QUALITY_CONFIG, ...(qualityConfig || {}) };
  const normalized: Ad[] = [];
  for (const ad of ads) {
    const cleaned = normalizeGearloopAd(ad);
    if (cleaned) normalized.push(cleaned);
  }

  const report: QualityReport = {
    total: ads.length,
    valid: normalized.length,
    invalid: Math.max(0, ads.length - normalized.length),
    invalid_ratio: ads.length ? (ads.length - normalized.length) / ads.length : 1,
    image_ratio: normalized.length
      ? normalized.filter(a => a.image_url && a.image_url.length > 0).length / normalized.length
      : 0,
  };

  console.log(
    `Quality report for ${sourceName}: total=${report.total}, valid=${report.valid}, invalid=${report.invalid}, invalid_ratio=${report.invalid_ratio.toFixed(2)}, image_ratio=${report.image_ratio.toFixed(2)}`
  );

  const abortReason = getAbortReason(sourceName, report, config);
  return { ads: normalized, report, abort_reason: abortReason };
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
    
    if (imageUrl && (imageUrl.includes('assets.gearloop.se') || imageUrl.includes('gearloop.se'))) {
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
    if (!urlToImage.has(adUrl) && imageUrl && (imageUrl.includes('assets.gearloop.se') || imageUrl.includes('gearloop.se'))) {
      urlToImage.set(adUrl, imageUrl);
    }
  }

  // Pattern 2b: img with data-src (lazy) before anchor
  const reverseRegex2 = /<img[^>]+(?:data-src)=["']?([^"'\s>]+)["']?[^>]*>[\s\S]*?<a[^>]+href=["']?(https:\/\/gearloop\.se\/\d+[^"'\s>]+)["']?/gi;
  while ((match = reverseRegex2.exec(html)) !== null) {
    let imageUrl = cleanImageUrl(match[1]);
    const adUrl = match[2].split('?')[0];
    if (imageUrl && !imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
      else if (imageUrl.startsWith('/')) imageUrl = 'https://gearloop.se' + imageUrl;
    }
    if (!urlToImage.has(adUrl) && imageUrl && (imageUrl.includes('assets.gearloop.se') || imageUrl.includes('gearloop.se'))) {
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
    
    if (!urlToImage.has(adUrl) && imageUrl && (imageUrl.includes('assets.gearloop.se') || imageUrl.includes('gearloop.se'))) {
      urlToImage.set(adUrl, imageUrl);
    }
  }
  
  console.log(`Extracted ${urlToImage.size} image URLs from Gearloop HTML`);
  return urlToImage;
}

/** Extract all ad URLs from HTML (any href to gearloop.se/ID-slug). Used when card patterns miss links. */
function extractAllAdUrlsFromHtml(html: string): Set<string> {
  const urls = new Set<string>();
  const fullUrlRegex = /href=["']?(https:\/\/gearloop\.se\/\d+-[^"'\s>]+)["']?/gi;
  const relativeRegex = /href=["'](\/\d+-[^"'\s>]+)["']/gi;
  let m;
  while ((m = fullUrlRegex.exec(html)) !== null) {
    urls.add(m[1].split('?')[0]);
  }
  while ((m = relativeRegex.exec(html)) !== null) {
    urls.add(('https://gearloop.se' + m[1]).split('?')[0]);
  }
  console.log(`Extracted ${urls.size} ad URLs from Gearloop HTML (all links)`);
  return urls;
}

/** Resolve Gearloop category slug to internal category using the ad card's category link */
function resolveGearloopCategory(html: string, adUrl: string): string {
  // Each ad card on Gearloop links to its category, e.g. (pedaler-effekter-alla)
  // We find the category link nearest to this ad URL in the HTML
  const escaped = adUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nearbyRegex = new RegExp(escaped + '[\\s\\S]{0,500}?\\(([a-z0-9-]+)-alla\\)', 'i');
  const m = nearbyRegex.exec(html);
  if (m) {
    const slug = m[1];
    if (GEARLOOP_CATEGORY_MAP[slug]) return GEARLOOP_CATEGORY_MAP[slug];
  }
  // Also try in markdown: [Category](category-slug-alla)
  return 'other';
}

/** Extract category from markdown context around an ad */
function resolveGearloopCategoryFromMarkdown(markdown: string, adUrl: string): string {
  const escaped = adUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Look for category link after the ad URL: [Pedaler & Effekter](pedaler-effekter-alla)
  const re = new RegExp(escaped + '[\\s\\S]{0,800}?\\[([^\\]]+)\\]\\(([a-z0-9-]+)-alla\\)', 'i');
  const m = re.exec(markdown);
  if (m) {
    const slug = m[2];
    if (GEARLOOP_CATEGORY_MAP[slug]) return GEARLOOP_CATEGORY_MAP[slug];
  }
  return 'other';
}

// Parse ads from Gearloop main page (gearloop.se/?page=N)
// Each ad has a category link in the HTML that tells us which category it belongs to
function parseGearloopAds(html: string, markdown: string): Ad[] {
  const ads: Ad[] = [];
  const imageMap = extractImageUrlsFromHtml(html);

  // Primary: Parse markdown format: #### [Title](https://gearloop.se/123456-slug)
  const adBlockRegex = /####\s*\[([^\]]+)\]\((https:\/\/gearloop\.se\/\d+[^)]+)\)\s*\n\s*([^\n]*)/g;

  let match;
  while ((match = adBlockRegex.exec(markdown)) !== null) {
    const title = match[1].trim();
    const adUrl = match[2].trim().split('?')[0];
    const priceAndDate = match[3].trim();

    const priceMatch = priceAndDate.match(/^([\d\s]+)\s*kr/);
    const priceText = priceMatch ? priceMatch[1].replace(/\s/g, '') + ' kr' : null;
    const dateMatch = priceAndDate.match(/(\d+\s+\w+)$/);
    const dateStr = dateMatch ? dateMatch[1] : '';
    const imageUrl = imageMap.get(adUrl) || '';

    // Resolve category from the markdown/html context
    let category = resolveGearloopCategoryFromMarkdown(markdown, adUrl);
    if (category === 'other') category = resolveGearloopCategory(html, adUrl);

    // Extract location from markdown (line with city name after the ad block)
    let location = '';
    const locRegex = new RegExp(adUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,300}?\\n([A-ZÅÄÖ][a-zåäö]+(?:\\s[A-ZÅÄÖ]?[a-zåäö]+)*)\\n', 'i');
    const locMatch = locRegex.exec(markdown);
    if (locMatch) location = locMatch[1].trim();

    ads.push({
      title,
      ad_url: adUrl,
      category,
      location,
      date: dateStr || new Date().toISOString().split('T')[0],
      price_text: priceText,
      image_url: imageUrl,
      source_category: '',
    });
  }

  // Fallback: bare URLs in markdown
  const urlRegex = /https:\/\/gearloop\.se\/(\d+)-([^)\s"]+)/g;
  const seenUrls = new Set(ads.map((a) => a.ad_url));
  while ((match = urlRegex.exec(markdown)) !== null) {
    const adUrl = match[0].split('?')[0];
    if (seenUrls.has(adUrl)) continue;
    seenUrls.add(adUrl);
    const slug = match[2];
    const title = slug.replace(/-/g, ' ');
    const imageUrl = imageMap.get(adUrl) || '';
    let category = resolveGearloopCategoryFromMarkdown(markdown, adUrl);
    if (category === 'other') category = resolveGearloopCategory(html, adUrl);

    ads.push({ title, ad_url: adUrl, category, location: '', date: new Date().toISOString().split('T')[0], price_text: null, image_url: imageUrl, source_category: '' });
  }

  // Fallback: all ad URLs from HTML
  const allHtmlUrls = extractAllAdUrlsFromHtml(html);
  for (const adUrl of allHtmlUrls) {
    const normalized = adUrl.split('?')[0];
    if (seenUrls.has(normalized)) continue;
    seenUrls.add(normalized);
    const slugMatch = normalized.match(/\/\d+-([^/]+)$/);
    const title = slugMatch ? slugMatch[1].replace(/-/g, ' ') : normalized;
    const imageUrl = imageMap.get(normalized) || '';
    const category = resolveGearloopCategory(html, normalized);

    ads.push({ title, ad_url: normalized, category, location: '', date: new Date().toISOString().split('T')[0], price_text: null, image_url: imageUrl, source_category: '' });
  }

  const withImages = ads.filter((a) => a.image_url).length;
  console.log(`Gearloop: Found ${ads.length} ads on page (${withImages} with images)`);
  return ads;
}

const MAX_GEARLOOP_PAGES = 80; // ~25 ads/page × 80 = ~2000 ads max

// Fetch a single page from Gearloop main listing
async function fetchGearloopPage(firecrawlApiKey: string, page: number): Promise<Ad[]> {
  const url = page <= 1 ? 'https://gearloop.se/' : `https://gearloop.se/?page=${page}`;
  console.log(`Gearloop: Fetching page ${page}: ${url}`);

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
        onlyMainContent: false,
        waitFor: 5000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gearloop: Firecrawl error page ${page}: ${response.status} - ${errorText}`);
      return [];
    }

    const data = await response.json();
    const html = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';

    if (!html && !markdown) {
      console.warn(`Gearloop: No content for page ${page}`);
      return [];
    }

    return parseGearloopAds(html, markdown);
  } catch (error) {
    console.error(`Gearloop: Error fetching page ${page}:`, error);
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
  existingUrlSet: Set<string>,
  sourceName: string
): Promise<{ allAds: Ad[], newlyInsertedUrls: Set<string> }> {
  const allAds: Ad[] = [];
  const seenUrls = new Set<string>();
  const newlyInsertedUrls = new Set<string>();

  console.log(`Gearloop: Paginating main listing (gearloop.se/?page=N)...`);

  let page = 1;
  let emptyPages = 0;

  while (page <= MAX_GEARLOOP_PAGES) {
    try {
      const pageAds = await fetchGearloopPage(firecrawlApiKey, page);

      if (pageAds.length === 0) {
        emptyPages++;
        if (emptyPages >= 2) {
          console.log(`Gearloop: 2 consecutive empty pages at page ${page}, stopping.`);
          break;
        }
        page++;
        await delay(1000);
        continue;
      }

      emptyPages = 0;
      let newOnPage = 0;

      for (const ad of pageAds) {
        if (!seenUrls.has(ad.ad_url)) {
          seenUrls.add(ad.ad_url);
          allAds.push(ad);
          newOnPage++;
          if (!existingUrlSet.has(ad.ad_url)) {
            newlyInsertedUrls.add(ad.ad_url);
          }
        }
      }

      console.log(`Gearloop page ${page}: ${pageAds.length} ads (${newOnPage} new unique, total: ${allAds.length})`);

      // If we got very few new ads, we're likely seeing repeats — stop
      if (newOnPage === 0) {
        console.log(`Gearloop: No new unique ads on page ${page}, stopping.`);
        break;
      }

      page++;
      await delay(1500); // Rate limit
    } catch (error) {
      console.error(`Gearloop: Error on page ${page}:`, error);
      page++;
      await delay(2000);
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
      .select('id, name, config')
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
    let existingAdsQuery = supabase
      .from('ad_listings_cache')
      .select('ad_url')
      .eq('is_active', true);
    if (sourceId) {
      existingAdsQuery = existingAdsQuery.eq('source_id', sourceId);
    }
    const { data: existingAds, error: fetchError } = await existingAdsQuery;
    if (fetchError) {
      console.error('Failed to fetch existing ads:', fetchError);
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
    const existingUrlSet = new Set<string>(existingAds?.map((a: any) => a.ad_url) || []);

    const { allAds, newlyInsertedUrls } = await fetchAllAdsFromGearloop(
      firecrawlApiKey,
      existingUrlSet,
      sourceName
    );

    const qualityConfig = (sourceId
      ? (await supabase
          .from('scraping_sources')
          .select('config')
          .eq('id', sourceId)
          .maybeSingle()).data?.config
      : null) as ScrapeQualityConfig | null;

    const { ads: validatedAds, report, abort_reason } = normalizeAndValidateAds(
      allAds,
      sourceName,
      qualityConfig || undefined
    );
    
    if (abort_reason) {
      console.error(`Abort sync for ${sourceName}: ${abort_reason}`);
      if (syncLogId) {
        await supabase
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: abort_reason,
            total_ads_fetched: report.total,
            valid_ads: report.valid,
            invalid_ads: report.invalid,
            invalid_ratio: report.invalid_ratio,
            image_ratio: report.image_ratio,
            abort_reason,
          })
          .eq('id', syncLogId);
      }
      return {
        success: false,
        error: abort_reason,
        abort_reason,
        total_ads_fetched: report.total,
        valid_ads: report.valid,
        invalid_ads: report.invalid,
        invalid_ratio: report.invalid_ratio,
        image_ratio: report.image_ratio,
      };
    }

    if (validatedAds.length === 0) {
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
      
      return {
        success: false,
        error: 'No ads fetched',
        total_ads_fetched: report.total,
        valid_ads: report.valid,
        invalid_ads: report.invalid,
        invalid_ratio: report.invalid_ratio,
        image_ratio: report.image_ratio,
      };
    }

    const now = new Date().toISOString();
    const adsToSave = validatedAds.map(ad => ({
      ad_url: ad.ad_url,
      ad_path: ad.ad_url.split('/').pop() || '',
      title: ad.title,
      category: ad.category,
      source_category: ad.source_category || null,
      source_id: sourceId,
      source_name: sourceName,
      location: ad.location,
      date: ad.date,
      price_text: ad.price_text,
      price_amount: ad.price_amount,
      image_url: ad.image_url,
      is_active: true,
      last_seen_at: now,
    }));

    const batchSize = 100;
    for (let i = 0; i < adsToSave.length; i += batchSize) {
      const batch = adsToSave.slice(i, i + batchSize);
      const { error: upsertError } = await supabase
        .from('ad_listings_cache')
        .upsert(batch, { onConflict: 'ad_url' });
      if (upsertError) {
        console.error(`Upsert error for batch ${i}:`, upsertError);
        throw upsertError;
      }
    }

    // Mark ads not seen in this scrape as inactive using last_seen_at
    if (sourceId) {
      const { error: updateError } = await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('source_id', sourceId)
        .eq('is_active', true)
        .lt('last_seen_at', now);
      if (updateError) {
        console.error('Failed to mark ads as inactive:', updateError);
      }
    }

    const newUrls = new Set<string>(validatedAds.map(a => a.ad_url));
    const removedCount = [...existingUrlSet].filter(url => !newUrls.has(url)).length;

    console.log(`All ${validatedAds.length} ads saved, ${newlyInsertedUrls.size} are new`);

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
          ads_found: validatedAds.length,
          ads_new: newlyInsertedUrls.size,
          ads_removed: removedCount,
          total_ads_fetched: report.total,
          valid_ads: report.valid,
          invalid_ads: report.invalid,
          invalid_ratio: report.invalid_ratio,
          image_ratio: report.image_ratio,
          abort_reason,
        })
        .eq('id', syncLogId);
      
      console.log(`Sync log ${syncLogId} updated: completed`);
    }
    
    return {
      success: true,
      ads_found: validatedAds.length,
      ads_new: newlyInsertedUrls.size,
      ads_updated: 0,
      totalAds: validatedAds.length,
      newAds: newlyInsertedUrls.size,
      removedAds: removedCount,
      aiCategorized: aiNewResult.categorized + cleanupResult.categorized,
      detailsPreloaded: preloadResult.preloaded,
      imagesBackfilled: backfillResult.backfilled,
      duration: `${duration}s`,
      total_ads_fetched: report.total,
      valid_ads: report.valid,
      invalid_ads: report.invalid,
      invalid_ratio: report.invalid_ratio,
      image_ratio: report.image_ratio,
      abort_reason,
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
