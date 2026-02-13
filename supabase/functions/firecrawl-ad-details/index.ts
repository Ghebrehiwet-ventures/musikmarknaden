import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect source from URL
function getSourceType(url: string): 'musikborsen' | 'gearloop' | 'dlxmusic' | 'gear4music' | 'blocket' | 'jam' | 'woocommerce' | 'unknown' {
  if (url.includes('musikborsen.se')) return 'musikborsen';
  if (url.includes('gearloop.se')) return 'gearloop';
  if (url.includes('dlxmusic.se')) return 'dlxmusic';
  if (url.includes('gear4music.se') || url.includes('gear4music.com')) return 'gear4music';
  if (url.includes('blocket.se')) return 'blocket';
  if (url.includes('jam.se')) return 'jam';
  // WooCommerce-based stores
  if (url.includes('uppsalamusikverkstad.se')) return 'woocommerce';
  if (url.includes('slagverket.com')) return 'woocommerce';
  return 'unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ad_url } = await req.json();

    if (!ad_url) {
      return new Response(
        JSON.stringify({ error: 'ad_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sourceType = getSourceType(ad_url);

    // Check cache first
    const { data: cached } = await supabase
      .from('ad_details_cache')
      .select('*')
      .eq('ad_url', ad_url)
      .maybeSingle();

  if (cached) {
    const updatedAt = new Date(cached.updated_at);
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    // Check if cached result indicates a dead link
    if (cached.title === 'Page not found' || cached.description?.includes('Sidan kunde tyvärr inte hittas')) {
      console.log('× Cached as dead link:', ad_url);
      
      // Mark listing as inactive
      await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('ad_url', ad_url);
      
      return new Response(
        JSON.stringify({
          error: 'AD_NOT_FOUND',
          message: 'Annonsen finns inte längre på källsidan',
          isDeadLink: true,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Return cached data if less than 7 days old
    const cachedImagesCount = Array.isArray(cached.images) ? cached.images.length : 0;
    const cachedDesc = cached.description || '';
    const hasBadBlocketImages = sourceType === 'blocket' && cachedImagesCount <= 1;
    const hasBadBlocketDescription = sourceType === 'blocket' && looksLikeBadBlocketDescription(cachedDesc);
    const hasSellerBioDescription = sourceType === 'blocket' && looksLikeSellerBio(cachedDesc);
    const bypassCacheForBlocket = hasBadBlocketImages || hasBadBlocketDescription || hasSellerBioDescription;

    if (daysSinceUpdate < 7 && !bypassCacheForBlocket) {
        console.log('✓ Cache hit for:', ad_url, `(${daysSinceUpdate.toFixed(1)} days old)`);
        return new Response(
          JSON.stringify({
            title: cached.title,
            description: cached.description,
            price_text: cached.price_text,
            price_amount: cached.price_amount,
            location: cached.location,
            images: cached.images || [],
            contact_info: cached.contact_info || {},
            seller: cached.seller,
            condition: cached.condition,
            specifications: cached.specifications || [],
            fromCache: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } else if (daysSinceUpdate < 7 && bypassCacheForBlocket) {
      console.log(`× Blocket cache incomplete (images=${cachedImagesCount}, badDesc=${hasBadBlocketDescription}) - rescraping:`, ad_url);
    } else {
        console.log('Cache expired for:', ad_url, `(${daysSinceUpdate.toFixed(1)} days old)`);
      }
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`× Cache miss - scraping [${sourceType}]:`, ad_url);
    const scrapeStart = Date.now();

    let markdown = '';
    let html = '';
    let metadata: Record<string, unknown> = {};

    // For server-rendered sites (WooCommerce), try direct HTTP fetch first — much faster
    // and avoids Firecrawl timeouts on slow servers like Slagverket
    const useDirectFetch = sourceType === 'woocommerce' || sourceType === 'gearloop';

    if (useDirectFetch) {
      console.log('Trying direct HTTP fetch (server-rendered site)...');
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        const directResponse = await fetch(ad_url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Musikmarknaden/1.0; +https://musikmarknaden.com)',
            'Accept': 'text/html,application/xhtml+xml',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (directResponse.ok) {
          html = await directResponse.text();
          // Extract metadata from HTML
          const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
          const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
          const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
          metadata = {
            title: titleMatch ? titleMatch[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").trim() : '',
            ogImage: ogImageMatch ? ogImageMatch[1] : '',
            description: ogDescMatch ? ogDescMatch[1] : '',
          };
          console.log(`Direct fetch successful in ${Date.now() - scrapeStart}ms (${html.length} bytes)`);
        } else {
          console.warn(`Direct fetch failed: HTTP ${directResponse.status}`);
          html = ''; // Fall through to Firecrawl
        }
      } catch (directError) {
        console.warn('Direct fetch failed (timeout/error), falling back to Firecrawl:', directError);
        html = '';
      }
    }

    // Firecrawl fallback (or primary for JS-rendered sites like Blocket)
    if (!html) {
      // Some sources load images dynamically with JS - need to wait for rendering
      const needsWait = sourceType === 'blocket' || sourceType === 'jam';
      const waitTime = sourceType === 'blocket' ? 6000 : sourceType === 'jam' ? 3000 : 0;
      const formats = sourceType === 'blocket'
        ? ['markdown', 'html', 'rawHtml']
        : ['markdown', 'html'];
      
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: ad_url,
          formats,
          onlyMainContent: sourceType === 'jam',
          ...(needsWait && { waitFor: waitTime }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Firecrawl API error:', data);
        return new Response(
          JSON.stringify({ error: data.error || `Request failed with status ${response.status}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      markdown = data.data?.markdown || data.markdown || '';
      const processedHtml = data.data?.html || data.html || '';
      const rawHtml = data.data?.rawHtml || data.rawHtml || '';
      html = sourceType === 'blocket' && rawHtml ? rawHtml : processedHtml;
      metadata = data.data?.metadata || data.metadata || {};
    }

    const scrapeTime = Date.now() - scrapeStart;
    console.log(`Scrape successful in ${scrapeTime}ms, parsing ad details for source: ${sourceType}`);

    const adDetails = parseAdDetails(markdown, html, metadata, sourceType);

    console.log('Parsed ad details:', adDetails);

    // Check if this is a dead link (404 page from source)
    const isDeadLink = adDetails.title === 'Page not found' || 
                       adDetails.description?.includes('Sidan kunde tyvärr inte hittas');

    if (isDeadLink) {
      console.log('× Detected dead link from scrape:', ad_url);
      
      // Mark listing as inactive
      await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('ad_url', ad_url);

      // Still cache it so we don't keep re-scraping
      await supabase
        .from('ad_details_cache')
        .upsert({
          ad_url,
          title: 'Page not found',
          description: 'Annonsen finns inte längre',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'ad_url' });

      return new Response(
        JSON.stringify({
          error: 'AD_NOT_FOUND',
          message: 'Annonsen finns inte längre på källsidan',
          isDeadLink: true,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to cache
    const { error: upsertError } = await supabase
      .from('ad_details_cache')
      .upsert({
        ad_url,
        title: adDetails.title,
        description: adDetails.description,
        price_text: adDetails.price_text,
        price_amount: adDetails.price_amount,
        location: adDetails.location,
        images: adDetails.images,
        contact_info: adDetails.contact_info,
        seller: adDetails.seller,
        condition: adDetails.condition,
        specifications: adDetails.specifications || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: 'ad_url' });

    if (upsertError) {
      console.error('Failed to cache ad details:', upsertError);
    } else {
      console.log('Cached ad details for:', ad_url);
    }

    // Also update the listing with image and description for faster loading
    // BUT: only update image if it passes the sanitizer (not a badge/placeholder)
    let firstImage = adDetails.images && adDetails.images.length > 0 ? adDetails.images[0] : null;
    const shortDescription = adDetails.description?.substring(0, 500) || null;
    
    // For DLX: double-check the first image isn't a placeholder before updating listing
    if (firstImage && sourceType === 'dlxmusic') {
      const lowUrl = firstImage.toLowerCase();
      if (lowUrl.includes('sv_dlx_music_') || lowUrl.includes('404') || 
          lowUrl.includes('logo') || lowUrl.includes('banner')) {
        console.log('DLX: Skipping placeholder image for listing update:', firstImage);
        firstImage = null;
      }
    }
    
    if (firstImage || shortDescription) {
      const updateData: Record<string, string | null> = {};
      if (firstImage) updateData.image_url = firstImage;
      
      // Only save description if it passes quality check (not UI junk)
      if (shortDescription && !looksLikeBadBlocketDescription(shortDescription)) {
        updateData.description = shortDescription;
      } else if (shortDescription) {
        console.log('Skipping bad description for listing update:', shortDescription.substring(0, 50) + '...');
      }
      
      if (Object.keys(updateData).length > 0) {
        const { error: listingUpdateError } = await supabase
          .from('ad_listings_cache')
          .update(updateData)
          .eq('ad_url', ad_url);
        
        if (listingUpdateError) {
          console.error('Failed to update listing with image/description:', listingUpdateError);
        } else {
          console.log('Updated listing with image:', !!firstImage, 'description:', !!updateData.description);
        }
      }
    }

    return new Response(
      JSON.stringify({ ...adDetails, fromCache: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping ad details:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape ad details';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Main parser - routes to source-specific logic
function parseAdDetails(
  markdown: string, 
  html: string, 
  metadata: Record<string, unknown>,
  sourceType: 'musikborsen' | 'gearloop' | 'dlxmusic' | 'gear4music' | 'blocket' | 'jam' | 'woocommerce' | 'unknown'
) {
  // For Jam.se, use dedicated parser
  if (sourceType === 'jam') {
    return parseJamAdDetails(markdown, html, metadata);
  }
  
  // For WooCommerce stores, use dedicated parser
  if (sourceType === 'woocommerce') {
    return parseWooCommerceAdDetails(markdown, html, metadata);
  }
  
  const title = (metadata.title as string)?.split(' - ')[0]?.split(' | ')[0] || extractTitle(markdown) || 'Okänd titel';
  
  // Extract description with source-specific cleaning
  let description: string;
  if (sourceType === 'blocket') {
    description = extractBlocketDescription(markdown, html);
  } else if (sourceType === 'gearloop') {
    // For Gearloop, extract from HTML to get clean description
    description = extractGearloopDescriptionFromHtml(html);
  } else if (sourceType === 'musikborsen') {
    description = extractMusikborsenDescription(markdown);
  } else if (sourceType === 'gear4music') {
    description = extractGear4MusicDescription(html);
  } else {
    description = extractGearloopDescription(markdown);
  }
  
  // Extract price
  const priceMatch = markdown.match(/(\d[\d\s]*):?-?\s*kr/i) || markdown.match(/(\d[\d\s]*)\s*kr/i);
  const priceText = priceMatch ? `${priceMatch[1].replace(/\s/g, '')} kr` : null;
  const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;
  
  // Extract location with source-specific patterns
  let location: string;
  if (sourceType === 'musikborsen') {
    location = extractMusikborsenLocation(markdown);
  } else if (sourceType === 'blocket') {
    location = extractBlocketLocation(markdown);
  } else {
    location = extractLocation(markdown);
  }
  
  // Extract images with source-specific patterns
  // For Blocket, pass the ad_url from metadata to filter images by ad ID
  const adUrl = (metadata.sourceURL as string) || '';
  const images = extractImages(markdown, html, sourceType, adUrl);
  
  // Extract contact info - pass sourceType to avoid fabricated phone numbers
  const contactInfo = extractContactInfo(markdown, html, sourceType);
  const sellerInfo = sourceType === 'gearloop' ? extractSellerInfoFromHtml(html) : undefined;
  const condition = sourceType === 'gearloop'
    ? extractGearloopConditionFromSidebar(html)
    : extractCondition(markdown);

  return {
    title,
    description,
    price_text: priceText,
    price_amount: priceAmount,
    location,
    images,
    contact_info: contactInfo,
    seller: sellerInfo,
    condition,
    specifications: [],
  };
}

function extractTitle(markdown: string): string {
  const headerMatch = markdown.match(/^#\s+(.+)$/m);
  if (headerMatch) return headerMatch[1];
  const firstLine = markdown.split('\n').find(line => line.trim().length > 0);
  return firstLine?.trim() || '';
}

// Musikbörsen-specific description extraction
function extractMusikborsenDescription(markdown: string): string {
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  
  // Patterns specific to Musikbörsen junk
  const skipPatterns = [
    /^meny$/i,                              // Navigation "Meny"
    /^menu$/i,
    /copyright.*musikbörsen/i,              // Copyright text
    /all rights reserved/i,
    /alla rättigheter förbehållna/i,
    /vi använder cookies/i,
    /integritetsinställningar/i,
    /manage consent/i,
    /nödvändiga cookies/i,
    /analytiska cookies/i,
    /reklam-cookies/i,
    /\| kaka \|/i,
    /\| varaktighet \|/i,
    /\| beskrivning \|/i,
    /^\|[\s-]+\|/,                         // Table separators
    /^\|.*\|.*\|$/,                        // Table rows
    /gdpr cookie/i,
    /cookielawinfo/i,
    /cookie consent/i,
    /alltid aktiverad/i,
    /spara & acceptera/i,
    /powered by.*cookieyes/i,
    /cookieyes/i,
    /stäng$/i,
    /fält markerade med/i,
    /om du är en människa/i,
    /^\*\\$/,                              // Escaped asterisk patterns
    /^\\?\*$/,                             // Just asterisks
    /namn\s*\\\*$/i,                       // Form field labels
    /e-post\s*\\\*$/i,
    /telefon$/i,
    /köp \/ fråga/i,
    /^övriga$/i,
    /^others$/i,
    /^analyser$/i,
    /^analytics$/i,
    /^reklam$/i,
    /^advertisement$/i,
    /^nödvändiga$/i,
    /webbläsare/i,
    /tredjepartscookies/i,
    /surfupplevelse/i,
    /denna cookie/i,
    /^!\[/,                                // Markdown images
    /^\[.*\]\(.*\)/,                       // Markdown links
    /^- \[/,                               // List items with links
    /no description/i,
    /^session$/i,
    /^\d+ (year|month|day|minut)/i,
    /^begagnat$/i,                         // Navigation links
    /^musikbörsen$/i,
    /^kontakta oss$/i,
    /^sälj på musikbörsen/i,
    /^nyheter$/i,
    /^logga in$/i,
    /^registrera$/i,
    /^om oss$/i,
    /^villkor$/i,
    /delbetalning.*klarna/i,              // Marketing text
    /erbjuder.*byte/i,
    /byt in ditt.*mot/i,
  ];
  
  let inCookieSection = false;
  let foundMainContent = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Detect start of cookie section
    if (/vi använder cookies/i.test(trimmed)) {
      inCookieSection = true;
      continue;
    }
    
    // Skip everything after cookie section starts
    if (inCookieSection) continue;
    
    // Skip if matches any skip pattern
    const shouldSkip = skipPatterns.some(p => p.test(trimmed));
    if (shouldSkip) continue;
    
    // Skip pure navigation/header elements
    if (trimmed.startsWith('#') || trimmed === '|' || trimmed.startsWith('---')) continue;
    
    // Skip price lines (shown separately)
    if (/^\d[\d\s.,]*\s*kr$/i.test(trimmed)) continue;
    
    // Skip E-post/Telefon contact lines (shown separately)
    if (/^e-post:/i.test(trimmed)) continue;
    if (/^telefon:/i.test(trimmed)) continue;
    
    // Skip copyright lines anywhere
    if (/copyright\s*\d{4}/i.test(trimmed)) continue;
    
    contentLines.push(trimmed);
    foundMainContent = true;
  }
  
  let desc = contentLines.join('\n').trim();
  
  // Clean up markdown artifacts
  desc = desc.replace(/!\[\]\([^)]+\)/g, '');
  desc = desc.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  desc = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  desc = desc.replace(/\*\*/g, '');
  desc = desc.replace(/\\\*/g, '');
  desc = desc.replace(/\\+/g, '');
  
  // Remove copyright lines that might have slipped through
  desc = desc.replace(/Copyright\s*\d{4}.*$/gmi, '');
  desc = desc.replace(/All rights reserved\.?/gi, '');
  
  // Remove "Meny" if it appears at start
  desc = desc.replace(/^Meny\n+/i, '');
  
  // Remove duplicate consecutive lines
  const uniqueLines = desc.split('\n')
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .filter(line => line.trim().length > 0);
  desc = uniqueLines.join('\n');
  
  // Final cleanup - remove any remaining cookie-related text that slipped through
  desc = desc.replace(/E-post:.*Köp \/ Fråga \/ Meddelande/gs, '');
  
  // If description is too short or just dashes, return fallback
  if (!desc || desc === '-' || desc.length < 5) {
    return 'Ingen beskrivning tillgänglig';
  }
  
  return desc;
}

// Gearloop-specific description extraction from HTML
// This extracts ONLY the actual ad description, not seller panel or UI elements
function extractGearloopDescriptionFromHtml(html: string): string {
  // Look for the main description paragraph with class "mt-6 break-words"
  // This is where Gearloop puts the actual ad description
  const descMatch = html.match(/<p[^>]*class="[^"]*mt-6[^"]*break-words[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  
  if (descMatch && descMatch[1]) {
    let desc = descMatch[1];
    
    // Remove HTML tags but preserve line breaks
    desc = desc.replace(/<br\s*\/?>/gi, '\n');
    desc = desc.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    desc = desc.replace(/&nbsp;/g, ' ');
    desc = desc.replace(/&amp;/g, '&');
    desc = desc.replace(/&lt;/g, '<');
    desc = desc.replace(/&gt;/g, '>');
    desc = desc.replace(/&quot;/g, '"');
    desc = desc.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    desc = desc.trim();
    
    if (desc && desc.length > 5) {
      console.log('Gearloop: Extracted description from HTML, length:', desc.length);
      return desc;
    }
  }
  
  // Fallback: try to find description in article section, avoiding seller info
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    // Look for any paragraph that's not in the seller section
    const articleHtml = articleMatch[1];
    
    // Find paragraphs that contain actual content (not just single words or UI elements)
    const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    const candidates: string[] = [];
    
    while ((match = paragraphRegex.exec(articleHtml)) !== null) {
      let text = match[1];
      // Skip if it contains typical UI/seller elements
      if (/Medlem sedan|Visningar:|Kan skickas|Skicka meddelande|text-gray-600/i.test(text)) continue;
      if (/avatar|rounded-full/i.test(match[0])) continue;
      
      text = text.replace(/<[^>]+>/g, '').trim();
      // Must be substantial text (more than 20 chars and not just a price/date)
      if (text.length > 20 && !/^\d+\s*kr$/i.test(text) && !/^\d{1,2}\s+(jan|feb|mar|apr)/i.test(text)) {
        candidates.push(text);
      }
    }
    
    if (candidates.length > 0) {
      // Return the longest candidate as it's likely the description
      const desc = candidates.reduce((a, b) => a.length > b.length ? a : b);
      console.log('Gearloop: Extracted description from article fallback, length:', desc.length);
      return desc;
    }
  }
  
  console.log('Gearloop: No description found in HTML');
  return 'Ingen beskrivning tillgänglig';
}

// Legacy markdown-based extraction (kept for non-Gearloop sources)
// Gear4Music-specific description extraction
function extractGear4MusicDescription(html: string): string {
  // Look for the product description section
  // Gear4Music has product features in list items and description in specific sections
  
  const descriptionParts: string[] = [];
  
  // 1. Try to find "Centrala funktioner" / "Key Features" section
  const featuresMatch = html.match(/<[^>]*(?:class|id)="[^"]*(?:key-features|product-features|feature-list)[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|div|section)>/i);
  if (featuresMatch) {
    const features = featuresMatch[1].replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, '').trim();
    if (features) descriptionParts.push(features);
  }
  
  // 2. Look for product description in common patterns
  const descPatterns = [
    /<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/section>/i,
  ];
  
  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let desc = match[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      if (desc.length > 20) {
        descriptionParts.push(desc);
        break;
      }
    }
  }
  
  // 3. Extract list items that contain product features (common on Gear4Music)
  const listItemRegex = /<li[^>]*>([^<]{10,200})<\/li>/gi;
  let match;
  const features: string[] = [];
  while ((match = listItemRegex.exec(html)) !== null && features.length < 10) {
    const text = match[1].trim();
    // Skip navigation items
    if (text.length < 100 && !text.includes('http') && 
        !text.includes('Logga in') && !text.includes('Registrera') &&
        !text.includes('Kundtjänst') && !text.includes('Cookie')) {
      features.push('• ' + text);
    }
  }
  
  if (features.length > 0 && descriptionParts.length === 0) {
    descriptionParts.push(features.join('\n'));
  }
  
  const description = descriptionParts.join('\n\n').trim();
  
  if (!description || description.length < 10) {
    return 'Ingen beskrivning tillgänglig';
  }
  
  console.log('Gear4Music: Extracted description, length:', description.length);
  return description;
}

function extractGearloopDescription(markdown: string): string {
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  
  const skipPatterns = [
    /^!\[/,
    /^\[.*\]\(.*gearloop/i,
    /^- \[/,
    /sveriges marknadsplats/i,
    /om gearloop/i,
    /^support$/i,
    /^villkor$/i,
    /^tips$/i,
    /medlem sedan/i,
    /visningar:/i,
    /skickas \*\*ej\*\*/i,
    /^\d{1,2}:\d{2}$/,
    /^\d+\s*kr\d/,
    /^\d[\d\s]*kr\d/i,
    /^×$/,
    /^x$/i,
    /^Säljes$/i,
    /^Köpes$/i,
    /^\d{1,2}\s+(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)$/i,
    /^\d[\d\s]*:-?$/,
    /^Skick:/i,
    /^Ny medlem$/i,
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const shouldSkip = skipPatterns.some(p => p.test(trimmed));
    if (shouldSkip) continue;
    
    if (trimmed.startsWith('#') || trimmed === '|' || trimmed.startsWith('---')) continue;
    if (/^\d[\d\s]*kr\s*\d{1,2}\s*(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i.test(trimmed)) continue;
    
    contentLines.push(trimmed);
  }
  
  let desc = contentLines.join('\n').trim();
  
  desc = desc.replace(/!\[\]\([^)]+\)/g, '');
  desc = desc.replace(/×!/g, '');
  desc = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  desc = desc.replace(/\*\*/g, '');
  desc = desc.replace(/^×\n/gm, '');
  desc = desc.replace(/\n×$/gm, '');
  
  const uniqueLines = desc.split('\n').filter((line, i, arr) => i === 0 || line !== arr[i - 1]);
  desc = uniqueLines.join('\n');
  
  return desc || 'Ingen beskrivning tillgänglig';
}

function extractLocation(markdown: string): string {
  const locationPatterns = [
    /(?:Plats|Ort|Stad|Kommun):\s*([^\n,]+)/i,
    /(?:finns i|hämtas i|säljes i|ligger i)\s+([A-ZÅÄÖ][a-zåäö]+)/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = markdown.match(pattern);
    if (match) return match[1].trim();
  }
  
  const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Sundsvall', 'Eskilstuna', 'Karlstad', 'Växjö', 'Halmstad', 'Sundbyberg', 'Kungsbacka', 'Vallentuna', 'Ljusnarsberg'];
  
  for (const city of cities) {
    if (markdown.includes(city)) return city;
  }
  
  return '';
}

function extractMusikborsenLocation(markdown: string): string {
  // Musikbörsen often has location in contact info like "Musikbörsen i Göteborg"
  const mbLocationMatch = markdown.match(/musikbörsen\s+(?:i\s+)?([A-ZÅÄÖ][a-zåäö]+)/i);
  if (mbLocationMatch) return mbLocationMatch[1];
  
  // Look in title or near "hos" keyword
  const hosMatch = markdown.match(/hos\s+musikbörsen\s+(?:i\s+)?([A-ZÅÄÖ][a-zåäö]+)/i);
  if (hosMatch) return hosMatch[1];
  
  // Fall back to general location extraction
  return extractLocation(markdown);
}

// Check if Blocket text looks like seller bio / shop "om oss" instead of the actual ad body
function looksLikeSellerBio(description: string): boolean {
  if (!description || description.length < 200) return false;
  const lower = description.toLowerCase();
  const bioMarkers = [
    'välkommen på besök',
    'besök möjligt',
    'telefon och mail',
    'medlem i:',
    'medlem i ',
    'sedan 19',  // "sedan 1986", "sedan 1995"
    'bygger och reparerar',
    'bra paketerbjudanden',
    'inbyte',
    'externa visningar',
    'studiebesök',
    'endagskurser',
    'kurser jag kan erbjuda',
    'specialitéer',
    'specialiteter',
    'kulturskola',
    'folkhögskola',
    'musikhögskola',
    'i blocket-butiken visas',
    'blocket-butiken visas',
    'ateljén',
    'stråkstudion',
    'violinbyggare',
    'violinbyggarmästare',
    'sveriges violinbyggare',
    's.v.i.t.',
    'branschförbundet',
    'www.',   // seller's own website
    '.com',
    'dagar i veckan',
    'efter överenskommelse',
    'ta gärna kontakt med mig',
    'fråga gärna om',
  ];
  let hits = 0;
  for (const m of bioMarkers) {
    if (lower.includes(m)) hits++;
  }
  // Long text + several bio markers = seller bio, not ad
  if (hits >= 2 && description.length > 400) return true;
  if (hits >= 1 && description.length > 1200) return true;
  return false;
}

// Check if a Blocket description looks like UI garbage instead of real ad content
function looksLikeBadBlocketDescription(description: string): boolean {
  if (!description || description.length < 10) return true;
  if (description === 'Ingen beskrivning tillgänglig') return true;
  
  // Check for common UI markers that indicate we scraped wrong content (footer/nav)
  const badMarkers = [
    'Torget/',
    'Villkor',
    'Användarvillkor',
    'Fraktvillkor',
    'Personuppgifts- och cookiepolicy',
    'Cookieinställningar',
    'Information och inspiration',
    'Blocket Admin',
    'Blocketbutik',
    'Om Blocket',
    'Press',
    'Jobb',
    'Blocket är en del av Vend',
    'Kontakta oss',
    'Säker handel',
    'Frakt med köpskydd',
    'Annonseringsregler',
    'HouseBlocket',
    'Dela-ikon',
    'Anmäl annons',
    'Instagram-logotyp',
    'YouTube-logotyp',
    'Facebook-logotyp',
    'Vend ansvarar',
    'Läs mer',
    'Bell',
    'Notiser',
    'Ny annons',
    'Meddelanden',
    'Logga in',
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
      if (markerCount >= 2) {
        console.log('Blocket: Description looks bad - contains multiple UI markers');
        return true;
      }
    }
  }
  
  // Check if it's mostly short lines (typical of scraped navigation)
  const lines = description.split('\n').filter(l => l.trim());
  const shortLines = lines.filter(l => l.length < 20);
  if (lines.length > 5 && shortLines.length / lines.length > 0.7) {
    console.log('Blocket: Description looks bad - mostly short lines (navigation?)');
    return true;
  }
  
  return false;
}

// Blocket-specific description extraction with JSON-LD and __NEXT_DATA__ priority
function extractBlocketDescription(markdown: string, html: string): string {
  console.log('Blocket: Extracting description from HTML and markdown');
  
  // Strategy 1: Try JSON-LD structured data (cleanest source) – must not be seller bio
  const jsonLdDescription = extractBlocketDescriptionFromJsonLd(html);
  if (jsonLdDescription && jsonLdDescription.length > 20
      && !looksLikeBadBlocketDescription(jsonLdDescription)
      && !looksLikeSellerBio(jsonLdDescription)) {
    console.log('Blocket: Got description from JSON-LD, length:', jsonLdDescription.length);
    return jsonLdDescription;
  }
  
  // Strategy 2: Try Next.js __NEXT_DATA__ – prefer SHORT ad body over long seller bio
  const nextDataDescription = extractBlocketDescriptionFromNextData(html);
  if (nextDataDescription && nextDataDescription.length > 20
      && !looksLikeBadBlocketDescription(nextDataDescription)
      && !looksLikeSellerBio(nextDataDescription)) {
    console.log('Blocket: Got description from __NEXT_DATA__, length:', nextDataDescription.length);
    return nextDataDescription;
  }
  
  // Strategy 3: Fallback to improved markdown cleaning
  console.log('Blocket: Falling back to markdown extraction');
  return extractBlocketDescriptionFromMarkdown(markdown);
}

// Extract description from JSON-LD structured data
function extractBlocketDescriptionFromJsonLd(html: string): string | null {
  if (!html) return null;
  
  try {
    // Find all JSON-LD script blocks
    const jsonLdPattern = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    
    while ((match = jsonLdPattern.exec(html)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const data = JSON.parse(jsonContent);
        
        // Handle both single object and array formats
        const items = Array.isArray(data) ? data : [data];
        
        for (const item of items) {
          // Look for Product or Offer type with description
          if (item.description && typeof item.description === 'string' && item.description.length > 20) {
            // Clean HTML entities
            let desc = item.description
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#(\d+);/g, (_: string, code: string) => String.fromCharCode(parseInt(code)))
              .trim();
            
            if (desc.length > 20 && !looksLikeSellerBio(desc)) {
              return desc;
            }
          }
        }
      } catch {
        // Continue to next JSON-LD block
        continue;
      }
    }
  } catch (e) {
    console.log('Blocket: Error parsing JSON-LD:', e);
  }
  
  return null;
}

// Extract description from Next.js __NEXT_DATA__
function extractBlocketDescriptionFromNextData(html: string): string | null {
  if (!html) return null;
  
  try {
    const nextDataPattern = /<script[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
    const match = html.match(nextDataPattern);
    
    if (!match) return null;
    
    const data = JSON.parse(match[1]);
    
    // Recursively search for description candidates in the nested structure
    let candidates = findDescriptionCandidates(data, 0);
    // Exclude seller bio / shop "om oss" text
    candidates = candidates.filter(c => !looksLikeSellerBio(c));
    // Prefer SHORT description = actual ad body; long text is often seller bio
    candidates.sort((a, b) => a.length - b.length);
    
    // Return the best candidate that passes quality checks (prefer ad-like length)
    for (const candidate of candidates) {
      if (candidate.length > 20 && !looksLikeBadBlocketDescription(candidate)) {
        return candidate;
      }
    }
  } catch (e) {
    console.log('Blocket: Error parsing __NEXT_DATA__:', e);
  }
  
  return null;
}

// Recursively find description candidates in an object
function findDescriptionCandidates(obj: unknown, depth: number): string[] {
  const candidates: string[] = [];
  
  // Limit recursion depth
  if (depth > 10) return candidates;
  
  if (!obj || typeof obj !== 'object') return candidates;
  
  // Check if this object has a description-like key
  const descKeys = ['description', 'body', 'text', 'content', 'descriptionText'];
  
  for (const key of descKeys) {
    if (key in (obj as Record<string, unknown>)) {
      const value = (obj as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length > 30) {
        // Check it looks like actual content, not UI text
        const hasMultipleWords = value.split(/\s+/).length > 5;
        const hasSentenceStructure = /[.!?]/.test(value);
        const noUIMarkers = !value.includes('Logga in') && !value.includes('Villkor') && !value.includes('Cookie');
        
        if (hasMultipleWords && hasSentenceStructure && noUIMarkers) {
          candidates.push(value);
        }
      }
    }
  }
  
  // Recurse into arrays
  if (Array.isArray(obj)) {
    for (const item of obj) {
      candidates.push(...findDescriptionCandidates(item, depth + 1));
    }
  } else {
    // Recurse into object values
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        candidates.push(...findDescriptionCandidates(value, depth + 1));
      }
    }
  }
  
  return candidates;
}

// Fallback: Extract from markdown with improved cleaning
function extractBlocketDescriptionFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  
  // Blocket-specific patterns to skip (breadcrumb, nav, footer, UI)
  const skipPatterns = [
    /^Gå till annonsen/i,  // "Gå till annonsen" or "Gå till annonsen Torget/..."
    /^Torget\//i,
    /^Typ av gitarr:\s*\*\*Elgitarrer\*\*/i,
    /^Skick:\s*\*\*Bra skick/i,  // condition line - don't put in description
    /^Karta\s*\d+/i,  // location line "Karta12263 Enskede"
    /^Pil (vänster|höger)/i,
    /^\(\d+\/\d+\)$/,
    /Lägg till i favoriter/i,
    /^Lastbil i rörelse/i,
    /^Kan skickas$/i,
    /^Köp nu/i,
    /^Skicka (meddelande|prisförslag)/i,
    /^Be säljaren att skicka/i,
    /^Frakt från/i,
    /^köpskydd/i,
    /^Läs mer$/i,
    /^Dela annons$/i,
    /^Anmäl annons$/i,
    /^Senast ändrad:/i,
    /^Annons-ID:/i,
    /^Villkor\s/i,
    /^Information och inspiration/i,
    /^Om Blocket/i,
    /^Kontakta oss/i,
    /^Blocket är en del av Vend/i,
    /upphovsrättslagen/i,
    /^© \d+/,
    /^En del av Vend$/i,
    /^(Instagram|YouTube|Facebook)-logotyp/i,
    /^HouseBlocketBlocket/i,
    /^(Bell|Circle with)/i,
    /^Ny annons$/i,
    /^Speech bubbles/i,
    /^Logga in$/i,
    /^Meddelanden$/i,
    /^Notiser$/i,
    /^Miniatyrbild$/i,
    /^!\[/,
    /^Karta\d+/i,
    /^Du måste vara inloggad/i,
    /^Visa hela beskrivningen/i,
    /^Plustecken/i,
    /^Kryss$/i,
    /^Påminn mig senare/i,
    /^Blocket har fått ett lyft/i,
    /^Säljare$/i,
    /^Säljaren har/i,
    /^Privat$/i,
    /^Omdömen$/i,
    /^Visa omdömen$/i,
    /^Svarsfrekvens:/i,
    /^Svarstid:/i,
    /^Medlem sedan/i,
    /^Verifierad med BankID$/i,
    /^Checklist checkmark circle filled/i,
    /^Person silhouette/i,
    /^Alla annonser från säljaren$/i,
    /^Kontakt$/i,
    /^Chatta$/i,
    /^Ring säljaren/i,
    /^Blocket$/i,
    /^Jobb$/i,
    /^Bostad$/i,
    /^Fordon$/i,
    /^Köp & sälj$/i,
    /^Person$/i,
    /^Begagnat$/i,
    /^Nytt$/i,
    /^Laddar$/i,
    /^Bokmärknad$/i,
    /^Annonsvy$/i,
    /^Listaikon$/i,
    /^Bild \d+ av \d+$/i,
    /^Galleribildsikon$/i,
    /^Chevron/i,
    /^Pil höger$/i,
    /^Säljes$/i,
    /^Bortskänkes$/i,
    /^Du kanske också gillar/i,
    /^Visa alla$/i,
    /^Liknande annonser/i,
    /^Fler annonser$/i,
  ];
  
  let skipRest = false;
  
  // Stop at first line that looks like Blocket footer/nav (description is above this)
  const footerStartPatterns = [
    /^Dela-ikon$/i,
    /^Anmäl annons$/i,
    /^Villkor\s/i,
    /^Användarvillkor/i,
    /^Fraktvillkor/i,
    /^Personuppgifts- och cookiepolicy/i,
    /^Cookieinställningar/i,
    /^Information och inspiration/i,
    /^Blocket Admin/i,
    /^Om Blocket$/i,
    /^Kontakta oss$/i,
    /^Blocket är en del av Vend/i,
    /^HouseBlocket/i,
    /^Gå till annonsen\s/i,
  ];
  // Stop at seller bio / shop "om oss" (actual ad description is above this)
  const sellerBioStartPatterns = [
    /^Försäljning av (violin|viola|cello|stränginstrument)/i,
    /^När du ska köpa din nya/i,
    /^Bra paketerbjudanden\.?\s*Inbyte/i,
    /^Externa visningar/i,
    /^Kurser\s*$/i,
    /^Jag kan erbjuda.*kurser/i,
    /^Medlem i\s*:/i,
    /^Specialitéer\s*[-–]/i,
    /^Välkommen på besök/i,
    /^Besök möjligt/i,
    /^Telefon och mail besvaras/i,
    /^Violinbyggarmästare\s+\w+/i,
    /^bygger och reparerar alla stråkinstrument/i,
    /^Gå gärna in på hemsidan/i,
    /^www\.\w+\.(com|se)/i,
  ];

  for (const line of lines) {
    // Normalize: remove invisible chars, trim
    const trimmed = line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!trimmed) continue;
    
    // Stop at Blocket footer (description is always above this)
    if (footerStartPatterns.some(p => p.test(trimmed))) {
      console.log('Blocket: Stopping at footer/nav:', trimmed.slice(0, 50));
      skipRest = true;
      break;
    }
    // Stop at seller bio so we keep only the actual ad body
    if (sellerBioStartPatterns.some(p => p.test(trimmed))) {
      console.log('Blocket: Stopping at seller bio:', trimmed.slice(0, 60));
      skipRest = true;
      break;
    }
    
    // Stop at related ads sections
    if (/^Mer som det här/i.test(trimmed) ||
        /^Du kanske också gillar/i.test(trimmed) ||
        /säljarens övriga annonser/i.test(trimmed) ||
        /tips på nya annonser/i.test(trimmed) ||
        /^Liknande annonser/i.test(trimmed) ||
        /^Fler annonser/i.test(trimmed) ||
        /^Visa alla$/i.test(trimmed)) {
      console.log('Blocket: Stopping at related ads section:', trimmed);
      skipRest = true;
      break;
    }
    
    if (skipRest) continue;
    
    // Skip prices (shown separately)
    if (/^\d[\d\s.,]*\s*kr$/i.test(trimmed)) continue;
    
    // Skip if matches any skip pattern (more tolerant matching)
    if (skipPatterns.some(p => p.test(trimmed))) continue;
    
    // Skip headers
    if (trimmed.startsWith('#')) continue;
    
    // Skip very short lines that are likely UI elements
    if (trimmed.length < 3) continue;
    
    // Skip location lines like "Sigtuna, Uppsala län"
    if (/^[A-ZÅÄÖ][a-zåäö]+,\s*[A-ZÅÄÖ][a-zåäö]+\s+län$/i.test(trimmed)) continue;
    
    // Skip lines that are just numbers with prefixes (like "2Lägg till i favoriter" variants)
    if (/^\d+[A-ZÅÄÖ]/i.test(trimmed) && trimmed.length < 30) continue;
    
    contentLines.push(trimmed);
  }
  
  let desc = contentLines.join('\n').trim();
  
  // Clean up markdown artifacts
  desc = desc.replace(/!\[\]\([^)]+\)/g, '');
  desc = desc.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  desc = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  desc = desc.replace(/\*\*/g, '');
  
  // Remove duplicate consecutive lines
  const uniqueLines = desc.split('\n')
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .filter(line => line.trim().length > 0);
  desc = uniqueLines.join('\n');
  
  // If we still got seller-bio text (e.g. stop patterns didn't match), keep only first part = ad body
  if (looksLikeSellerBio(desc)) {
    const maxAdLen = 900;
    const cutAt = desc.indexOf('Välkommen!');
    const cutAt2 = desc.indexOf('Bra paketerbjudanden');
    const cutAt3 = desc.indexOf('Externa visningar');
    const firstBio = Math.min(
      cutAt > 0 ? cutAt : maxAdLen,
      cutAt2 > 0 ? cutAt2 : maxAdLen,
      cutAt3 > 0 ? cutAt3 : maxAdLen,
      maxAdLen
    );
    if (firstBio > 50) {
      desc = desc.substring(0, firstBio).trim();
      if (!/[\n.!?]$/.test(desc)) desc += '.';
      console.log('Blocket: Trimmed seller bio from markdown, kept', desc.length, 'chars');
    }
  }
  // Cap at 2000 chars
  if (desc.length > 2000) {
    desc = desc.substring(0, 2000) + '...';
  }
  
  if (!desc || desc.length < 5) {
    return 'Ingen beskrivning tillgänglig';
  }
  
  console.log('Blocket: Extracted description from markdown, length:', desc.length);
  return desc;
}

// Blocket-specific location extraction
function extractBlocketLocation(markdown: string): string {
  // Blocket has location in format: "Sigtuna, Uppsala län"
  // or in breadcrumb-like format after city name
  
  // Pattern 1: City, County format
  const cityCountyMatch = markdown.match(/([A-ZÅÄÖ][a-zåäö]+),\s*([A-ZÅÄÖ][a-zåäö]+\s+län)/);
  if (cityCountyMatch) {
    return cityCountyMatch[1]; // Return just the city
  }
  
  // Pattern 2: Look for "Karta" followed by postcode and city
  const mapMatch = markdown.match(/Karta\s*(\d{5})\s*([A-ZÅÄÖ][a-zåäö]+)/i);
  if (mapMatch) {
    return mapMatch[2]; // Return the city name
  }
  
  // Fall back to general location extraction
  return extractLocation(markdown);
}

// Blocket-specific image extraction
function extractBlocketImages(markdown: string, html: string, adUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  
  // Extract the ad ID from the URL (e.g., "19932942" from .../item/19932942)
  const adIdMatch = adUrl.match(/item\/(\d+)/);
  const adId = adIdMatch ? adIdMatch[1] : null;
  
  console.log(`Blocket: Extracting images for ad ID: ${adId}`);
  
  // Helper to process and add image URL
  const addImage = (url: string): boolean => {
    // Skip profile placeholders
    if (url.includes('profile_placeholders')) {
      console.log('Blocket: Skipping profile placeholder:', url);
      return false;
    }
    
    // Filter by ad ID - only include images belonging to THIS ad
    if (adId) {
      const imgItemMatch = url.match(/item\/(\d+)\//);
      if (imgItemMatch && imgItemMatch[1] !== adId) {
        console.log(`Blocket: Skipping image from other ad ${imgItemMatch[1]} (expected ${adId})`);
        return false;
      }
    }
    
    // Upgrade to 960w for better quality (1200w doesn't exist, causes 404)
    // Handle /default/, /480w/, and /480x480c// formats
    url = url.replace(/\/default\//, '/960w/');
    url = url.replace(/\/\d+w\//, '/960w/');
    url = url.replace(/\/\d+x\d+c\/\//, '/960w/');
    
    // Deduplicate based on the image hash (last part of URL)
    const hashMatch = url.match(/\/([^\/]+)$/);
    const key = hashMatch ? hashMatch[1] : url;
    
    if (!seen.has(key)) {
      seen.add(key);
      images.push(url);
      return true;
    }
    return false;
  };
  
  // Priority 1: HTML data-image attributes (main gallery images)
  // Format: data-image="https://images.blocketcdn.se/dynamic/default/item/19933733/..."
  if (html) {
    const dataImagePattern = /data-image="(https:\/\/images\.blocketcdn\.se[^"]+)"/g;
    let match;
    while ((match = dataImagePattern.exec(html)) !== null) {
      addImage(match[1]);
    }
    console.log(`Blocket: Found ${images.length} images from data-image attributes`);
  }
  
  // Priority 2: data-srcset attributes (pick 960w or largest available)
  if (images.length === 0 && html) {
    const srcsetPattern = /data-srcset="([^"]+)"/g;
    let match;
    while ((match = srcsetPattern.exec(html)) !== null) {
      const srcset = match[1];
      // Try to find 960w version, or fall back to first URL
      const url960 = srcset.match(/(https:\/\/images\.blocketcdn\.se\/dynamic\/960w\/[^\s,]+)/);
      const url1280 = srcset.match(/(https:\/\/images\.blocketcdn\.se\/dynamic\/1280w\/[^\s,]+)/);
      const urlAny = srcset.match(/(https:\/\/images\.blocketcdn\.se[^\s,]+)/);
      
      const bestUrl = url960?.[1] || url1280?.[1] || urlAny?.[1];
      if (bestUrl) addImage(bestUrl);
    }
    console.log(`Blocket: Found ${images.length} images from data-srcset attributes`);
  }
  
  // Priority 3: data-src or src attributes from Blocket CDN
  if (images.length === 0 && html) {
    const htmlPattern = /(?:data-src|src)="(https:\/\/images\.blocketcdn\.se\/dynamic\/[^"]+)"/g;
    let match;
    while ((match = htmlPattern.exec(html)) !== null) {
      addImage(match[1]);
    }
    console.log(`Blocket: Found ${images.length} images from data-src/src attributes`);
  }
  
  // Priority 4: Markdown images (fallback)
  if (images.length === 0) {
    const imgPattern = /!\[[^\]]*\]\((https:\/\/images\.blocketcdn\.se[^)]+)\)/g;
    let match;
    while ((match = imgPattern.exec(markdown)) !== null) {
      addImage(match[1]);
    }
    console.log(`Blocket: Found ${images.length} images from markdown`);
  }

  // Fallback: scan for any Blocket CDN URLs in raw HTML / embedded JSON (covers Next.js __NEXT_DATA__)
  // This is safe because we still filter by adId.
  const combined = `${html}\n${markdown}`;
  // Some pages embed URLs as escaped strings (e.g. https:\/\/images...), normalize first.
  const normalizedCombined = combined.replace(/\\\//g, '/');
  const urlPattern = /https:\/\/images\.blocketcdn\.se\/dynamic\/[A-Za-z0-9\/._-]+/g;

  let m;
  while ((m = urlPattern.exec(normalizedCombined)) !== null) {
    addImage(m[0]);
  }

  console.log(`Blocket: Total extracted ${images.length} images for ad ${adId}`);
  return images;
}

// Helper to get base image URL without WordPress size suffix
function getBaseImageUrl(url: string): string {
  // Remove WordPress size suffixes like -300x200, -768x1024, etc.
  return url.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|gif|webp))/i, '');
}

// DLX placeholder/badge images that should NOT be used as product images
function isDlxPlaceholderImage(url: string): boolean {
  if (!url) return true;
  const lowUrl = url.toLowerCase();
  return (
    lowUrl.includes('sv_dlx_music_used') ||
    lowUrl.includes('sv_dlx_music_topseller') ||
    lowUrl.includes('sv_dlx_music_campaign') ||
    lowUrl.includes('sv_dlx_music_news') ||
    lowUrl.includes('sv_dlx_music_download') ||
    lowUrl.includes('sv_dlx_music_demo') ||
    lowUrl.includes('sv_dlx_music_bstock') ||
    lowUrl.includes('404') ||
    lowUrl.includes('logo') ||
    lowUrl.includes('icon') ||
    lowUrl.includes('avatar') ||
    lowUrl.includes('banner') ||
    lowUrl.includes('i.ytimg.com') ||
    lowUrl.includes('youtube.com') ||
    lowUrl.includes('facebook.com') ||
    lowUrl.includes('twitter.com')
  );
}

function extractImages(markdown: string, html: string, sourceType: string, adUrl: string = ''): string[] {
  const images: string[] = [];
  
  if (sourceType === 'blocket') {
    // Use Blocket-specific extraction with ad URL filtering
    return extractBlocketImages(markdown, html, adUrl);
  } else if (sourceType === 'musikborsen') {
    // For Musikbörsen, look for WordPress uploads but deduplicate by base URL
    const mbRegex = /https?:\/\/musikborsen\.se\/wp-content\/uploads\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    const seenBaseUrls = new Set<string>();
    let match;
    
    while ((match = mbRegex.exec(html)) !== null) {
      const url = match[0];
      const baseUrl = getBaseImageUrl(url);
      
      // Skip if we already have a version of this image
      if (seenBaseUrls.has(baseUrl)) continue;
      
      // Skip small thumbnails, icons, and logos
      if (url.includes('-150x') || url.includes('-100x') || 
          url.includes('-50x') || url.includes('logo') || 
          url.includes('icon') || url.includes('avatar')) continue;
      
      seenBaseUrls.add(baseUrl);
      
      // Use the original (base) URL for best quality
      images.push(baseUrl);
    }
  } else if (sourceType === 'gearloop') {
    const decodeUrl = (raw: string) => raw.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    const addGearloop = (url: string) => {
      const u = decodeUrl(url);
      if (u.includes('assets.gearloop.se') && !images.includes(u)) images.push(u);
    };

    // Extract the article section first to avoid "related ads" images
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const articleHtml = articleMatch ? articleMatch[1] : '';

    if (articleHtml) {
      // 1. imageSlider('...') or imageSlider("...")
      const sliderMatch = articleHtml.match(/imageSlider\s*\(\s*["']([^"']+)["']\s*\)/);
      if (sliderMatch) addGearloop(sliderMatch[1]);

      // 2. data-image attributes
      const dataImageRegex = /data-image=["']([^"']+)["']/gi;
      let match;
      while ((match = dataImageRegex.exec(articleHtml)) !== null) addGearloop(match[1]);

      // 3. background-image in style
      const bgImageRegex = /background-image:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi;
      while ((match = bgImageRegex.exec(articleHtml)) !== null) addGearloop(match[1]);

      // 4. <img src="..." or data-src="..." (lazy-loaded images)
      const imgSrcRegex = /<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
      while ((match = imgSrcRegex.exec(articleHtml)) !== null) addGearloop(match[1]);
    }

    // 5. Fallback: og:image (main product image for sharing) – safe and usually correct
    if (images.length === 0 && html) {
      const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
      if (ogMatch && ogMatch[1].includes('gearloop')) {
        addGearloop(ogMatch[1]);
        console.log('Gearloop: Using og:image fallback');
      }
    }

    if (images.length === 0) {
      console.log('Gearloop: No images found in article or og:image');
    }
  } else if (sourceType === 'dlxmusic') {
    // DLX Music: Extract ONLY from the main product gallery section
    // This section contains the lightbox images for the actual product
    // DO NOT extract from the entire page - that picks up "Relaterade Produkter"
    
    const seenUrls = new Set<string>();
    
    // 1. Try to find the lightbox gallery section specifically
    // DLX uses <section id="lightBoxImages"> for the product image gallery
    const galleryMatch = html.match(/<section[^>]*id="lightBoxImages"[^>]*>([\s\S]*?)<\/section>/i);
    
    if (galleryMatch) {
      const galleryHtml = galleryMatch[1];
      console.log('DLX: Found lightBoxImages section');
      
      // Extract data-src attributes first (these are the full-size images)
      const dataSrcRegex = /data-src="([^"]+)"/gi;
      let match;
      while ((match = dataSrcRegex.exec(galleryHtml)) !== null) {
        let url = match[1];
        
        // Make absolute URL if relative
        if (url.startsWith('/')) {
          url = 'https://www.dlxmusic.se' + url;
        }
        
        // Skip placeholders
        if (seenUrls.has(url)) continue;
        if (isDlxPlaceholderImage(url)) {
          console.log('DLX details: Filtered placeholder image:', url);
          continue;
        }
        
        seenUrls.add(url);
        images.push(url);
      }
      
      // If no data-src, try regular src attributes within the gallery
      if (images.length === 0) {
        const srcRegex = /src="(https?:\/\/www\.dlxmusic\.se\/storage\/[^"]+)"/gi;
        while ((match = srcRegex.exec(galleryHtml)) !== null) {
          const url = match[1];
          if (seenUrls.has(url)) continue;
          if (isDlxPlaceholderImage(url)) continue;
          seenUrls.add(url);
          images.push(url);
        }
      }
    } else {
      console.log('DLX: No lightBoxImages section found, trying product-detail__images-container');
      
      // Fallback: try product-detail__images-container 
      const containerMatch = html.match(/<div[^>]*class="[^"]*product-detail__images[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*(?:small-12|medium-|product-detail__info)/i);
      
      if (containerMatch) {
        const containerHtml = containerMatch[1];
        
        const imgRegex = /src="(https?:\/\/www\.dlxmusic\.se\/storage\/[^"]+)"/gi;
        let match;
        while ((match = imgRegex.exec(containerHtml)) !== null) {
          const url = match[1];
          if (seenUrls.has(url)) continue;
          if (isDlxPlaceholderImage(url)) continue;
          seenUrls.add(url);
          images.push(url);
        }
      }
    }
    
    // NO FALLBACK to generic /storage/ extraction!
    // If we can't find the gallery, the product has no images
    
    console.log(`DLX: Found ${images.length} images in product gallery`);
    
    if (images.length === 0) {
      console.log('DLX: No valid product images found in gallery - ad has no images');
    }
    
    return images;
  } else if (sourceType === 'gear4music') {
    // Gear4Music: Extract ONLY "actual item" (secondhand) images
    // MARKDOWN-FIRST approach: The markdown explicitly labels images as:
    // - "Bild av det faktiska föremålet" (actual item / secondhand)
    // - "Bild av ny artikel" (stock photo)
    
    const seenMediaIds = new Set<string>();
    const actualItemImages: string[] = [];
    
    console.log('Gear4Music: Starting markdown-first image extraction');
    
    // Step 1: PRIMARY - Extract from markdown bullets labeled "Bild av det faktiska föremålet"
    // Markdown format spans multiple lines with escaped newlines:
    // - [Bild av det faktiska föremålet \
    //   ![alt](thumbnail)\
    //   \
    //   Loading zoom](HIGH_RES_URL "title")
    // Use [\s\S]*? to match across newlines (non-greedy)
    const actualItemPattern = /Bild av det faktiska föremålet[\s\S]*?Loading zoom\]\((https:\/\/r2\.gear4music\.com\/media\/[^"\s)]+)/gi;
    let match;
    
    while ((match = actualItemPattern.exec(markdown)) !== null) {
      const url = match[1];
      
      // Extract media ID (format: media/XXX/XXXXXXX) for deduplication
      const mediaIdMatch = url.match(/media\/(\d+\/\d+)/);
      if (!mediaIdMatch) continue;
      
      const mediaId = mediaIdMatch[1];
      if (seenMediaIds.has(mediaId)) continue;
      seenMediaIds.add(mediaId);
      
      // Prefer 1200px version, upgrade if needed
      let highResUrl = url;
      if (!url.includes('/1200/')) {
        highResUrl = url.replace(/\/\d+\/preview\.jpg/, '/1200/preview.jpg');
      }
      
      actualItemImages.push(highResUrl);
    }
    
    console.log(`Gear4Music: Markdown extracted ${actualItemImages.length} actual-item images`);
    
    // Step 2: FALLBACK - If markdown yielded nothing, try HTML with SECONDHAND in title
    if (actualItemImages.length === 0) {
      console.log('Gear4Music: Falling back to HTML SECONDHAND title matching');
      
      // Look for images where title contains "SECONDHAND"
      const imgWithTitleRegex = /<img[^>]*title="([^"]*SECONDHAND[^"]*)"[^>]*(?:data-src|src)="(https:\/\/r2\.gear4music\.com\/media\/[^"]+)"/gi;
      
      while ((match = imgWithTitleRegex.exec(html)) !== null) {
        const url = match[2];
        
        // Skip non-product assets
        if (url.includes('/payment/') || url.includes('/badge') || 
            url.includes('/logo') || url.includes('/brand/') ||
            url.includes('/dist/images/')) continue;
        
        const mediaIdMatch = url.match(/media\/(\d+\/\d+)/);
        if (!mediaIdMatch) continue;
        
        const mediaId = mediaIdMatch[1];
        if (seenMediaIds.has(mediaId)) continue;
        seenMediaIds.add(mediaId);
        
        // Upgrade to 1200px
        let highResUrl = url;
        if (!url.includes('/1200/')) {
          highResUrl = url.replace(/\/\d+\/preview\.jpg/, '/1200/preview.jpg');
        }
        
        actualItemImages.push(highResUrl);
      }
      
      console.log(`Gear4Music: HTML fallback found ${actualItemImages.length} SECONDHAND images`);
    }
    
    // Step 3: NO FINAL FALLBACK - if we can't identify actual item images, return empty
    // This prevents stock photos from being shown
    if (actualItemImages.length === 0) {
      console.log('Gear4Music: No actual-item images found - returning empty to avoid stock photos');
    }
    
    // Cap at 12 images max
    const finalImages = actualItemImages.slice(0, 12);
    console.log(`Gear4Music: Final image count: ${finalImages.length}`);
    
    return finalImages;
  } else if (sourceType === 'woocommerce') {
    // WooCommerce stores (Uppsala Musikverkstad, Slagverket, etc.)
    console.log('WooCommerce: Starting image extraction');
    
    const seenBaseUrls = new Set<string>();
    
    // Helper to check if URL is a placeholder/flag image
    const isWooCommercePlaceholder = (url: string): boolean => {
      const lowUrl = url.toLowerCase();
      // Flag images
      if (lowUrl.includes('sveriges-flagga') || 
          lowUrl.includes('flag_of_') ||
          lowUrl.includes('/se.png') ||
          lowUrl.includes('/dk.png') ||
          lowUrl.includes('/no.png') ||
          lowUrl.includes('/fi.png') ||
          lowUrl.includes('flag-')) return true;
      // Common non-product images
      if (lowUrl.includes('placeholder') ||
          lowUrl.includes('no-image') ||
          lowUrl.includes('woocommerce-placeholder') ||
          lowUrl.includes('logo') ||
          lowUrl.includes('icon') ||
          lowUrl.includes('avatar') ||
          lowUrl.includes('banner') ||
          lowUrl.includes('badge') ||
          lowUrl.includes('payment') ||
          lowUrl.includes('trustpilot') ||
          lowUrl.includes('shipping') ||
          lowUrl.includes('checkout') ||
          lowUrl.includes('cart')) return true;
      return false;
    };
    
    // Priority 1: Look for WooCommerce product gallery - search entire HTML for gallery images
    // The gallery structure varies, so we look for data-large_image attributes anywhere in the page
    // and also look for images within woocommerce-product-gallery__image containers
    
    // First, try to find all data-large_image attributes (most reliable for full-size images)
    const largeImageRegex = /data-large_image="([^"]+)"/gi;
    let match;
    while ((match = largeImageRegex.exec(html)) !== null) {
      const url = match[1];
      if (!isWooCommercePlaceholder(url)) {
        const baseUrl = getBaseImageUrl(url);
        if (!seenBaseUrls.has(baseUrl)) {
          seenBaseUrls.add(baseUrl);
          images.push(baseUrl);
          console.log('WooCommerce: Found large image:', baseUrl.substring(baseUrl.lastIndexOf('/') + 1));
        }
      }
    }
    
    if (images.length > 0) {
      console.log('WooCommerce: Found product gallery with', images.length, 'images');
    }
    
    // Priority 2: Look for og:image (usually the main product image)
    if (images.length === 0) {
      const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImageMatch && !isWooCommercePlaceholder(ogImageMatch[1])) {
        const baseUrl = getBaseImageUrl(ogImageMatch[1]);
        if (!seenBaseUrls.has(baseUrl)) {
          seenBaseUrls.add(baseUrl);
          images.push(baseUrl);
          console.log('WooCommerce: Found og:image');
        }
      }
    }
    
    // Priority 3: Search for wp-content/uploads images in product area
    if (images.length === 0) {
      console.log('WooCommerce: No gallery found, searching for wp-content/uploads images');
      
      const uploadRegex = /(?:src|href)="(https?:\/\/[^"]+wp-content\/uploads[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
      let match;
      while ((match = uploadRegex.exec(html)) !== null) {
        const url = match[1];
        if (!isWooCommercePlaceholder(url)) {
          const baseUrl = getBaseImageUrl(url);
          if (!seenBaseUrls.has(baseUrl)) {
            seenBaseUrls.add(baseUrl);
            images.push(baseUrl);
          }
        }
      }
    }
    
    console.log(`WooCommerce: Found ${images.length} product images`);
    return images;
  } else {
    // Generic image extraction (Note: Blocket is handled at the top of extractImages())
    const genericRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    let match;
    while ((match = genericRegex.exec(html)) !== null) {
      const url = match[0];
      // Skip common assets that aren't product images
      if (!url.includes('logo') && !url.includes('icon') && !url.includes('avatar') && !images.includes(url)) {
        images.push(url);
      }
    }
  }
  
  return images;
}

// WooCommerce-specific parser for Uppsala Musikverkstad, Slagverket, etc.
function parseWooCommerceAdDetails(markdown: string, html: string, metadata: Record<string, unknown>) {
  console.log('WooCommerce: Starting dedicated parser');
  
  // Skip patterns for cookie/consent text
  const badPatterns = [
    /cookie/i,
    /samtycke/i,
    /gdpr/i,
    /integritetspolicy/i,
    /consent/i,
    /varukorg/i,
    /checkout/i,
    /trustpilot/i,
  ];
  
  const isBadText = (t: string): boolean => badPatterns.some(p => p.test(t));
  
  // 1. Extract title from JSON-LD or og:title
  let title = '';
  let jsonLdData: Record<string, unknown> | null = null;
  
  // Try JSON-LD first
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product') {
        jsonLdData = jsonLd;
        if (jsonLd.name && !isBadText(jsonLd.name)) {
          title = jsonLd.name;
          console.log('WooCommerce: Got title from JSON-LD:', title);
        }
      }
    } catch (e) {
      console.log('WooCommerce: JSON-LD parse error');
    }
  }
  
  // Fallback to og:title
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch && !isBadText(ogTitleMatch[1])) {
      title = ogTitleMatch[1].split(' - ')[0].split(' | ')[0].trim();
      console.log('WooCommerce: Got title from og:title:', title);
    }
  }
  
  // Fallback to meta title or H1
  if (!title) {
    const metaTitleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (metaTitleMatch && !isBadText(metaTitleMatch[1])) {
      title = metaTitleMatch[1].split(' - ')[0].split(' | ')[0].trim();
    }
  }
  
  if (!title) {
    const h1Match = markdown.match(/^#\s+(.+)$/m);
    if (h1Match && !isBadText(h1Match[1])) {
      title = h1Match[1].trim();
    }
  }
  
  if (!title) {
    title = 'Okänd produkt';
  }
  
  // 2. Extract description (avoid duplicating "Beskrivning" header)
  // Use a more robust approach that handles nested divs
  let description = '';
  
  // Helper to extract text content between a start marker and an end marker
  const extractBetweenMarkers = (html: string, startPattern: RegExp, endPatterns: RegExp[]): string => {
    const startMatch = html.match(startPattern);
    if (!startMatch) return '';
    
    const startIndex = startMatch.index! + startMatch[0].length;
    let endIndex = html.length;
    
    for (const endPattern of endPatterns) {
      const remaining = html.substring(startIndex);
      const endMatch = remaining.match(endPattern);
      if (endMatch && endMatch.index !== undefined) {
        const possibleEnd = startIndex + endMatch.index;
        if (possibleEnd < endIndex) {
          endIndex = possibleEnd;
        }
      }
    }
    
    return html.substring(startIndex, endIndex);
  };
  
  // Try to find tab-description content - look for the panel and extract until next tab/section
  const tabDescStart = /<div[^>]*id="tab-description"[^>]*>/i;
  const tabDescEnd = [
    /<div[^>]*id="tab-(?!description)[^"]*"[^>]*>/i,  // Next tab
    /<div[^>]*class="[^"]*woocommerce-Tabs-panel--(?!description)[^"]*"[^>]*>/i,
    /<\/div>\s*<\/div>\s*<\/div>/i,  // Closing of tabs container
  ];
  
  let rawDescHtml = extractBetweenMarkers(html, tabDescStart, tabDescEnd);
  
  if (rawDescHtml) {
    // Clean HTML to text - preserve paragraph structure
    let rawDesc = rawDescHtml
      .replace(/<h2[^>]*>.*?<\/h2>/gi, '') // Remove "BESKRIVNING" heading
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<hr\s*\/?>/gi, '\n---\n') // Horizontal rule as separator
      .replace(/<br\s*\/?>/gi, '\n') // Convert br to newlines
      .replace(/<\/p>/gi, '\n\n') // Convert paragraph ends to double newlines
      .replace(/<p[^>]*>/gi, '') // Remove opening p tags
      .replace(/<\/li>/gi, '\n') // Convert list items to newlines
      .replace(/<li[^>]*>/gi, '• ') // Add bullet points
      .replace(/<\/ul>/gi, '\n') // Add newline after lists
      .replace(/<\/ol>/gi, '\n')
      .replace(/<[^>]+>/g, ' ') // Remove remaining HTML
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#8211;/g, '–')
      .replace(/&#8230;/g, '…')
      // Clean up whitespace while PRESERVING newlines
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/ ?\n ?/g, '\n') // Trim spaces around newlines
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .trim();
    
    // Remove leading "Beskrivning" if present
    rawDesc = rawDesc.replace(/^Beskrivning\s*/i, '');
    
    if (rawDesc && !isBadText(rawDesc) && rawDesc.length > 20) {
      description = rawDesc;
      console.log('WooCommerce: Got description from tab-description, length:', description.length);
    }
  }
  
  // Try JSON-LD as fallback
  if (!description && jsonLdData) {
    const jsonDesc = jsonLdData.description as string | undefined;
    if (jsonDesc && !isBadText(jsonDesc)) {
      let cleanDesc = jsonDesc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      cleanDesc = cleanDesc.replace(/^Beskrivning\s*/i, '');
      if (cleanDesc.length > 20) {
        description = cleanDesc;
        console.log('WooCommerce: Got description from JSON-LD, length:', description.length);
      }
    }
  }
  
  // Try og:description
  if (!description) {
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDescMatch && !isBadText(ogDescMatch[1]) && ogDescMatch[1].length > 20) {
      description = ogDescMatch[1].replace(/^Beskrivning\s*/i, '');
      console.log('WooCommerce: Got description from og:description');
    }
  }
  
  // Try short description
  if (!description) {
    const shortDescHtml = extractBetweenMarkers(
      html, 
      /<div[^>]*class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>/i,
      [/<\/div>\s*<div/i, /<form/i]
    );
    if (shortDescHtml) {
      let rawDesc = shortDescHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
      rawDesc = rawDesc.replace(/^Beskrivning\s*/i, '');
      if (rawDesc && !isBadText(rawDesc) && rawDesc.length > 20) {
        description = rawDesc;
        console.log('WooCommerce: Got description from short-description');
      }
    }
  }
  
  if (!description) {
    description = 'Ingen beskrivning tillgänglig';
  }
  
  // 3. Extract specifications (from SPECIFIKATION tab) as structured array
  const specifications: Array<{ label: string; value: string }> = [];
  const specPatterns = [
    /<div[^>]*id="tab-additional_information"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*woocommerce-Tabs-panel--additional_information[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<table[^>]*class="[^"]*woocommerce-product-attributes[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
  ];
  
  for (const pattern of specPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      // Parse table rows
      const tableHtml = match[1] || match[0];
      const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
      for (const rowMatch of rowMatches) {
        const rowHtml = rowMatch[1];
        const labelMatch = rowHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
        const valueMatch = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
        if (labelMatch && valueMatch) {
          const label = labelMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
          const value = valueMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
          if (label && value && !isBadText(label) && !isBadText(value)) {
            specifications.push({ label, value });
          }
        }
      }
      if (specifications.length > 0) {
        console.log('WooCommerce: Got specifications, rows:', specifications.length);
        break;
      }
    }
    if (specifications.length > 0) break;
  }
  
  // Helper to parse Swedish price format (1.999 or 1 999 = 1999, komma is decimal)
  const parseSwedishPrice = (rawPrice: string): number => {
    // Remove spaces and &nbsp;
    let clean = rawPrice.replace(/\s/g, '').replace(/&nbsp;/g, '');
    // Swedish: period is thousand separator, comma is decimal
    // If format is like "1.999" (with period as thousand sep), remove periods
    // If format is like "1999,50" (comma as decimal), convert to dot
    if (clean.includes('.') && clean.includes(',')) {
      // "1.999,50" -> "1999.50"
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes('.') && !clean.includes(',')) {
      // "1.999" with no comma - likely thousand separator, not decimal
      // Check: if there are exactly 3 digits after the period, it's a thousand sep
      const parts = clean.split('.');
      if (parts.length === 2 && parts[1].length === 3) {
        clean = clean.replace(/\./g, ''); // "1.999" -> "1999"
      }
    } else if (clean.includes(',')) {
      // "1999,50" -> "1999.50"
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean);
  };
  
  // 4. Extract price - PRIORITIZE SALE PRICE (ins element) over regular price (del element)
  let priceText: string | null = null;
  let priceAmount: number | null = null;
  
  // First try to find sale price structure: <del>old</del><ins>new</ins>
  const salePriceMatch = html.match(/<ins[^>]*>[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?(\d[\d\s,.]*)[\s\S]*?<\/span>[\s\S]*?<\/ins>/i);
  if (salePriceMatch) {
    priceAmount = parseSwedishPrice(salePriceMatch[1]);
    if (!isNaN(priceAmount) && priceAmount > 0) {
      priceText = `${Math.round(priceAmount)} kr`;
      console.log('WooCommerce: Got SALE price:', priceText);
    }
  }
  
  // Fallback: check for single price element (no sale)
  if (!priceText) {
    // Skip prices inside <del> (old price)
    const priceMatch = html.match(/<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?(\d[\d\s,.]*)[\s\S]*?<\/span>/gi);
    if (priceMatch) {
      // Find price NOT inside a <del> tag - check if there's only one price element
      const allPrices: number[] = [];
      for (const pm of priceMatch) {
        const numMatch = pm.match(/(\d[\d\s,.]*)/);
        if (numMatch) {
          const val = parseSwedishPrice(numMatch[1]);
          if (!isNaN(val) && val > 0) allPrices.push(val);
        }
      }
      // If multiple prices, the LOWEST is usually the sale price
      if (allPrices.length > 0) {
        priceAmount = Math.min(...allPrices);
        priceText = `${Math.round(priceAmount)} kr`;
        console.log('WooCommerce: Got price (lowest of', allPrices.length, '):', priceText);
      }
    }
  }
  
  // Try JSON-LD as final fallback
  if (!priceText && jsonLdData) {
    const offers = jsonLdData.offers as Record<string, unknown> | undefined;
    if (offers?.price) {
      priceAmount = parseFloat(offers.price as string);
      if (!isNaN(priceAmount)) {
        priceText = `${Math.round(priceAmount)} kr`;
        console.log('WooCommerce: Got price from JSON-LD:', priceText);
      }
    }
  }
  
  // 5. Location - use store name from URL
  let location = '';
  const sourceUrl = (metadata.sourceURL as string) || '';
  if (sourceUrl.includes('uppsalamusikverkstad')) {
    location = 'Uppsala Musikverkstad';
  } else if (sourceUrl.includes('slagverket')) {
    location = 'Slagverket';
  } else {
    location = 'Webbutik';
  }
  
  // 6. Extract images
  const images = extractImages(markdown, html, 'woocommerce', sourceUrl);
  
  // 7. Contact info (stores don't usually expose personal contact)
  const contactInfo: { email?: string; phone?: string } = {};
  
  console.log(`WooCommerce: Parsed - title: "${title}", price: ${priceText}, images: ${images.length}, desc length: ${description.length}, specs: ${specifications.length}`);
  
  return {
    title,
    description,
    price_text: priceText,
    price_amount: priceAmount,
    location,
    images,
    contact_info: contactInfo,
    seller: undefined,
    condition: undefined,
    specifications,
  };
}

// Jam.se-specific parser - uses JSON-LD and og: tags for clean extraction
function parseJamAdDetails(markdown: string, html: string, metadata: Record<string, unknown>) {
  console.log('Jam: Starting dedicated Jam.se parser');
  
  // Skip patterns for cookie/consent text that might appear in titles
  const badTitlePatterns = [
    /cookie/i,
    /samtycke/i,
    /webbsidan använder/i,
    /gdpr/i,
    /integritetspolicy/i,
    /consent/i,
  ];
  
  const isBadTitle = (t: string): boolean => badTitlePatterns.some(p => p.test(t));
  
  // 1. Extract title from JSON-LD or og:title (avoid cookie banner text)
  let title = '';
  
  // Try JSON-LD first (most reliable)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.name && !isBadTitle(jsonLd.name)) {
        title = jsonLd.name;
        console.log('Jam: Got title from JSON-LD:', title);
      }
    } catch (e) {
      console.log('Jam: Failed to parse JSON-LD');
    }
  }
  
  // Priority 2: og:title (usually product-specific)
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch && !isBadTitle(ogTitleMatch[1])) {
      title = ogTitleMatch[1].split(' - ')[0].split(' | ')[0].trim();
      console.log('Jam: Got title from og:title:', title);
    }
  }
  
  // Priority 3: H1 tag (main product heading)
  if (!title) {
    const h1Match = html.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && !isBadTitle(h1Match[1])) {
      title = h1Match[1].trim();
      console.log('Jam: Got title from product H1:', title);
    }
  }
  
  // Priority 4: Any H1 tag
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match && !isBadTitle(h1Match[1])) {
      title = h1Match[1].trim();
      console.log('Jam: Got title from H1:', title);
    }
  }
  
  // Priority 5: metadata title (fallback, but validate it)
  if (!title && metadata.title) {
    const metaTitle = (metadata.title as string).split(' - ')[0].split(' | ')[0];
    if (!isBadTitle(metaTitle)) {
      title = metaTitle;
      console.log('Jam: Got title from metadata:', title);
    }
  }
  
  if (!title) {
    title = 'Okänd titel';
  }
  
  // 2. Extract description - AVOID cookie text, find actual product description
  // On jam.se, the description is in the product info area BEFORE the "Beskrivning" heading
  // The "Beskrivning" section only contains article number
  let description = '';
  
  // Bad description patterns (cookie/consent text)
  const badDescriptionPatterns = [
    /cookie/i,
    /webbplatsen.*använder/i,
    /analysera trafik/i,
    /annonsmätning/i,
    /webbläsare/i,
    /samtycke/i,
    /gdpr/i,
    /integritetspolicy/i,
    /^art\.?\s*nr/i,
    /^\d+$/,
  ];
  
  const isBadDescription = (text: string): boolean => {
    // Jam.se "teaser" descriptions can be very short (e.g. "Bra skick" = 9 chars)
    if (!text || text.length < 5) return true;
    return badDescriptionPatterns.some(p => p.test(text));
  };
  
  // Priority 1: JSON-LD description (rarely present on jam.se, but use when available)
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.description && !isBadDescription(jsonLd.description)) {
        description = jsonLd.description;
        console.log('Jam: Got description from JSON-LD, length:', description.length);
      }
    } catch (e) {
      // Will try other methods
    }
  }

  // Priority 2: Extract short description from HTML in the product info area.
  // Jam.se structure: price (e.g. "4 995 SEK") -> short desc (e.g. "Bra skick") -> "Leverans:"
  // The description is often just a few words like "Bra skick", "Nyskick", "Fint skick"
  if (!description) {
    // Look for common short condition descriptions that appear right after price
    const conditionPatterns = [
      /\b(Bra skick|Nyskick|Fint skick|Gott skick|Mycket bra skick|Använt skick|Begagnat skick|Demo|Utställningsex|B-stock)\b/i,
    ];
    
    for (const pattern of conditionPatterns) {
      const conditionMatch = html.match(pattern);
      if (conditionMatch) {
        description = conditionMatch[1];
        console.log('Jam: Got condition description:', description);
        break;
      }
    }
  }
  
  // Priority 3: Try to extract text between price and "Leverans:" from clean HTML
  if (!description) {
    const htmlText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();

    // Find price pattern like "4 995 SEK" or "1 750 SEK"
    const priceMatch = htmlText.match(/\b(\d[\d\s]*)\s*(SEK|kr)\b/i);
    if (priceMatch && priceMatch.index !== undefined) {
      const afterPrice = htmlText.slice(priceMatch.index + priceMatch[0].length).trim();

      // Find where description ends (before "Leverans:", "Läs mer", etc.)
      const stopCandidates = [
        afterPrice.search(/\bLeverans\s*:/i),
        afterPrice.search(/\bLäs mer\b/i),
        afterPrice.search(/\bBeskrivning\b/i),
        afterPrice.search(/\bKöp\b/i),
        afterPrice.search(/\bLägg i/i),
      ].filter((i) => i > 0);

      const stopIdx = stopCandidates.length > 0 ? Math.min(...stopCandidates) : Math.min(afterPrice.length, 200);

      const candidate = afterPrice
        .slice(0, stopIdx)
        .replace(/\s+/g, ' ')
        .trim();

      // Accept short descriptions (even 5 chars like "Demo")
      if (candidate && candidate.length >= 3 && candidate.length <= 300 && !isBadDescription(candidate)) {
        description = candidate;
        console.log('Jam: Got description from HTML near price:', description);
      }
    }
  }

  // Priority 3: Look for product description in markdown - jam.se often has a short "teaser" line near the price
  // Example: "Stereo resonator med MIDI" (short, but valid)
  if (!description) {
    const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);

    // Find an anchor point near the product title (first occurrence)
    const titleIndex = title && title !== 'Okänd titel'
      ? lines.findIndex(l => l.toLowerCase().includes(title.toLowerCase().slice(0, Math.min(24, title.length)).toLowerCase()))
      : -1;

    const start = titleIndex >= 0 ? titleIndex + 1 : 0;
    const stopRegex = /^(Läs mer\.{0,3}|Leverans|Beskrivning|Besökta produkter|Art\.?\s*nr)/i;

    const candidates: string[] = [];

    for (let i = start; i < Math.min(lines.length, start + 30); i++) {
      const line = lines[i];

      if (stopRegex.test(line)) break;
      if (/^\d[\d\s.,]*\s*(sek|kr)$/i.test(line)) continue;
      if (/^(Köp|Lägg i kundvagn|Dela)$/i.test(line)) continue;
      if (/^\[.*\]\(.*\)$/.test(line)) continue;
      if (line.startsWith('![')) continue;

      const cleanLine = line
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*/g, '')
        .trim();

      if (cleanLine.length >= 5 && !isBadDescription(cleanLine) && !/^\d/.test(cleanLine)) {
        candidates.push(cleanLine);
      }

      // If we already collected a couple of lines, stop early.
      if (candidates.join(' ').length >= 120) break;
    }

    if (candidates.length > 0) {
      description = candidates.join(' ').replace(/\s+/g, ' ').trim();
      console.log('Jam: Got description from markdown near title, length:', description.length);
    }
  }
  
  // Priority 3: og:description
  if (!description) {
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDescMatch && !isBadDescription(ogDescMatch[1])) {
      description = ogDescMatch[1];
      console.log('Jam: Got description from og:description');
    }
  }
  
  // Priority 4: meta description
  if (!description) {
    const metaDescMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);
    if (metaDescMatch && !isBadDescription(metaDescMatch[1])) {
      description = metaDescMatch[1];
      console.log('Jam: Got description from meta description');
    }
  }
  
  // Priority 5: Look for tws-textblock or product-description class
  if (!description) {
    const descPatterns = [
      /<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*tws-textblock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/p>/gi,
    ];
    
    for (const pattern of descPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const rawDesc = match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim();
        if (rawDesc && !isBadDescription(rawDesc)) {
          description = rawDesc;
          console.log('Jam: Got description from HTML class pattern, length:', description.length);
          break;
        }
      }
      if (description) break;
    }
  }
  
  if (!description) {
    description = 'Ingen beskrivning tillgänglig';
    console.log('Jam: No description found, using fallback');
  }
  
  // 3. Extract price
  let priceText: string | null = null;
  let priceAmount: number | null = null;
  
  // Try JSON-LD first
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.offers?.price) {
        priceAmount = parseFloat(jsonLd.offers.price);
        priceText = `${priceAmount} kr`;
        console.log('Jam: Got price from JSON-LD:', priceText);
      }
    } catch (e) {
      // Already logged above
    }
  }
  
  // Fallback to regex
  if (!priceText) {
    const priceMatch = markdown.match(/(\d[\d\s]*):?-?\s*kr/i);
    if (priceMatch) {
      priceText = `${priceMatch[1].replace(/\s/g, '')} kr`;
      priceAmount = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    }
  }
  
  // 4. Extract location (Jam.se is a store, location is fixed)
  const location = 'Jam.se';
  
  // 5. Extract images - CRITICAL: Only get THIS product's images
  const images = extractJamImages(html, metadata);
  
  // 6. Contact info (Jam is a store, use store contact)
  const contactInfo: { email?: string; phone?: string } = {};
  // Could add jam.se store contact if needed
  
  console.log(`Jam: Parsed - title: "${title}", images: ${images.length}, desc length: ${description.length}`);
  
  return {
    title,
    description,
    price_text: priceText,
    price_amount: priceAmount,
    location,
    images,
    contact_info: contactInfo,
    seller: undefined,
    condition: undefined,
    specifications: [],
  };
}

// Jam.se-specific image extraction - only extract THIS product's images
function extractJamImages(html: string, metadata: Record<string, unknown>): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  console.log('Jam: Starting image extraction');
  console.log('Jam: Source URL:', (metadata.sourceURL as string) || 'unknown');

  // Log a small slice of HTML to inspect structure (requested for debugging)
  try {
    console.log('Jam: HTML head (first 5000 chars):', html.slice(0, 5000));
  } catch (_) {
    // ignore
  }

  // Helper to upgrade thumbnail URLs to high-resolution
  // Jam.se (Abicart) image URLs often include max-width/max-height query params.
  // Prefer the largest available size by bumping max-width/max-height.
  const normalizeJamImageUrl = (url: string): string => {
    const decoded = url.replace(/&amp;/g, '&');

    // Strip very small sizing and request bigger assets
    if (decoded.includes('max-width=')) {
      return decoded
        .replace(/max-width=\d+/i, 'max-width=1440')
        .replace(/max-height=\d+/i, 'max-height=1440')
        .replace(/quality=\d+/i, 'quality=80');
    }

    // Some paths use a size folder: /art13/hXXXX/128/filename -> /art13/hXXXX/filename
    return decoded.replace(/(\/art\d+\/h\d+)\/\d+\//, '$1/');
  };

  const extractArticlePathFromUrl = (url: string): string | null => {
    const decoded = url.replace(/&amp;/g, '&');
    const m = decoded.match(/\/(art\d+\/h\d+)\//i);
    return m ? m[1].toLowerCase() : null;
  };

  // 1) Determine which Abicart "article path" belongs to THIS product.
  // Prefer og:image (typically the main product image). If missing, pick the most frequent artX/hY in the HTML.
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  const ogArticlePath = ogImageMatch ? extractArticlePathFromUrl(ogImageMatch[1]) : null;

  const articleCounts = new Map<string, number>();
  for (const m of html.matchAll(
    /https:\/\/cdn\.abicart\.com\/shop\/[^\s"'<>]+\/(art\d+\/h\d+)\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
  )) {
    const p = m[1].toLowerCase();
    articleCounts.set(p, (articleCounts.get(p) ?? 0) + 1);
  }

  let articlePath: string | null = ogArticlePath;
  if (!articlePath && articleCounts.size > 0) {
    let best: { path: string; count: number } | null = null;
    for (const [path, count] of articleCounts.entries()) {
      if (!best || count > best.count) best = { path, count };
    }
    articlePath = best?.path ?? null;
  }

  console.log('Jam: Selected articlePath:', articlePath ?? 'none', 'og:', ogArticlePath ?? 'none');

  // Helper to add image with deduplication + product filtering
  const addImage = (url: string, source: string): boolean => {
    if (!url) return false;

    // Skip obvious bad URLs
    if (url.includes('no-image') || url.includes('placeholder')) return false;
    if (url.includes('logo') || url.includes('icon')) return false;

    // Decode HTML entities first for consistent checking
    const decoded = url.replace(/&amp;/g, '&');

    // Upgrade/normalize to high-res
    const highResUrl = normalizeJamImageUrl(decoded);

    // Final safety: skip if it STILL looks like a thumbnail after normalization
    if (/\/(?:128|256|512)\//.test(highResUrl) || /max-width=(?:12[0-8]|25[0-6]|[1-9]\d?)\b/i.test(highResUrl)) {
      console.log(`Jam: Skipping thumbnail (post-normalize) from ${source}:`, highResUrl.slice(0, 100));
      return false;
    }

    // Only accept images that match THIS product's article path
    if (articlePath && !highResUrl.toLowerCase().includes(`/${articlePath}/`)) {
      return false;
    }

    // Deduplicate by normalized URL
    const normalizedUrl = highResUrl.split('?')[0].toLowerCase();
    if (seen.has(normalizedUrl)) return false;
    seen.add(normalizedUrl);

    console.log(`Jam: Added image from ${source}:`, highResUrl);
    images.push(highResUrl);
    return true;
  };

  const needMore = () => images.length < 3;

  // Priority 1: JSON-LD Product image (when available)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.image) {
        const jsonImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
        for (const img of jsonImages) {
          if (typeof img === 'string') {
            addImage(img, 'JSON-LD');
          } else if (img?.url) {
            addImage(img.url, 'JSON-LD');
          }
        }
      }
    } catch (e) {
      console.log('Jam: Failed to parse JSON-LD for images');
    }
  }

  // Priority 2: og:image (usually product-specific)
  if (ogImageMatch) {
    addImage(ogImageMatch[1], 'og:image');
  }

  // Priority 3: Look for the main product gallery/slider containers
  if (needMore()) {
    const productGalleryPatterns = [
      /<div[^>]*class="[^"]*(?:product[^\"]*(?:gallery|slider)|(?:gallery|slider)[^\"]*product)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*tws-product-image[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*product-gallery[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*main-image[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    ];

    for (const pattern of productGalleryPatterns) {
      const galleryMatch = html.match(pattern);
      if (!galleryMatch) continue;
      const galleryHtml = galleryMatch[1];

      // Extract source attribute from tws-react-img divs
      for (const m of galleryHtml.matchAll(/source="([^"]+)"/gi)) {
        if (m[1].includes('cdn.abicart.com')) addImage(m[1], 'tws-gallery');
      }

      // Also look for regular img tags
      for (const m of galleryHtml.matchAll(/<img[^>]*src="([^"]+)"/gi)) {
        if (m[1].includes('cdn.abicart.com')) addImage(m[1], 'gallery-img');
      }

      if (!needMore()) break;
    }
  }

  // Priority 4: Look for data-zoom / data-large attributes (high-res gallery images)
  if (needMore()) {
    const zoomMatches = html.matchAll(/data-(?:zoom|large|big|src-large)="([^"]+)"/gi);
    for (const match of zoomMatches) {
      addImage(match[1], 'data-zoom');
      if (!needMore()) break;
    }
  }

  // Priority 5: Scan for "origpic" images, but STILL filtered by articlePath
  if (needMore()) {
    // Keep the proven origpic matcher and rely on addImage() filtering by articlePath.
    const origPicMatches2 = html.matchAll(/https:\/\/cdn\.abicart\.com\/shop\/[^\s"'<>]+origpic[^\s"'<>]*/gi);
    for (const match of origPicMatches2) {
      addImage(match[0], 'origpic-pattern');
      if (!needMore()) break;
    }
  }

  // Cap at 5 images - if we have more, something is wrong
  if (images.length > 5) {
    console.log(`Jam: Capping images from ${images.length} to 5`);
    return images.slice(0, 5);
  }

  console.log(`Jam: Final image count: ${images.length}`);
  return images;
}


function extractContactInfo(
  markdown: string, 
  html: string, 
  sourceType: 'musikborsen' | 'gearloop' | 'dlxmusic' | 'gear4music' | 'blocket' | 'jam' | 'unknown'
): { email?: string; phone?: string } {
  const contactInfo: { email?: string; phone?: string } = {};
  
  // For DLX Music: They are a store, contact info is fixed (no per-product seller)
  // Don't extract phone numbers from random text - can pick up product codes
  if (sourceType === 'dlxmusic') {
    // DLX store contact - could set a fixed email if needed
    console.log('DLX: Skipping contact extraction (store, not private seller)');
    return contactInfo;
  }
  
  // For Gearloop: They do NOT show phone numbers publicly (requires login to message)
  // So we should NOT extract phone numbers from random text that might match patterns
  if (sourceType === 'gearloop') {
    // Only extract email if explicitly in the description (rare)
    const emailMatch = markdown.match(/[\w.-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      contactInfo.email = emailMatch[0];
    }
    // No phone extraction for Gearloop - they don't display it
    console.log('Gearloop: Skipping phone extraction (not publicly displayed)');
    return contactInfo;
  }
  
  // For Blocket: Contact is through the platform (messaging), not direct phone/email
  if (sourceType === 'blocket') {
    // Blocket sellers communicate through the platform's messaging system
    console.log('Blocket: Skipping contact extraction (platform messaging used)');
    return contactInfo;
  }
  
  // For Musikbörsen: Extract from the seller contact section specifically
  if (sourceType === 'musikborsen') {
    // Look for "E-post:" followed by email in the seller section
    // The format is "E-post: malmo@musikborsen.se" or similar
    const emailLabelMatch = markdown.match(/E-post:\s*([\w.-]+@[\w.-]+\.\w+)/i);
    if (emailLabelMatch) {
      contactInfo.email = emailLabelMatch[1];
      console.log('Musikbörsen: Extracted email from E-post label:', contactInfo.email);
    } else {
      // Fallback: try HTML - look for email near "Säljes av" section
      const sellerSectionMatch = html.match(/Säljes\s+av[\s\S]{0,500}?([\w.-]+@[\w.-]+\.se)/i);
      if (sellerSectionMatch) {
        contactInfo.email = sellerSectionMatch[1];
        console.log('Musikbörsen: Extracted email from HTML seller section:', contactInfo.email);
      } else {
        // Last fallback: look for store-specific emails (not info@)
        const storeEmailMatch = markdown.match(/((?:malmo|goteborg|stockholm|orebro|helsingborg|uppsala)@musikborsen\.se)/i);
        if (storeEmailMatch) {
          contactInfo.email = storeEmailMatch[1].toLowerCase();
          console.log('Musikbörsen: Extracted store-specific email:', contactInfo.email);
        }
      }
    }
    
    // Look for "Telefon:" followed by phone number
    const phoneLabelMatch = markdown.match(/Telefon:\s*([\d\s-]+)/i);
    if (phoneLabelMatch) {
      contactInfo.phone = phoneLabelMatch[1].trim();
      console.log('Musikbörsen: Extracted phone from Telefon label:', contactInfo.phone);
    }
    
    return contactInfo;
  }
  
  // For other sources, extract normally
  const emailMatch = markdown.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  // More flexible phone matching for Swedish numbers
  const phonePatterns = [
    /\+46[-\s]?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2}/,
    /0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2}/,
    /0\d{2,3}-\d{2}\s?\d{2}\s?\d{2}/,
  ];
  
  for (const pattern of phonePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      contactInfo.phone = match[0];
      break;
    }
  }
  
  return contactInfo;
}

// Extract seller info from HTML for Gearloop
function extractSellerInfoFromHtml(html: string): { name?: string; username?: string } | undefined {
  // Look for the seller section in Gearloop's HTML
  // The username is typically in a <p class="text-gray-600"> near "Medlem sedan"
  
  // Find the seller panel section
  const sellerMatch = html.match(/<p[^>]*class="[^"]*text-gray-600[^"]*"[^>]*>([^<]+)&nbsp;<\/p>/i);
  
  let username: string | undefined;
  if (sellerMatch && sellerMatch[1]) {
    username = sellerMatch[1].trim();
    // Clean up any HTML entities
    username = username.replace(/&nbsp;/g, '').trim();
    
    // Skip if it looks like UI text
    if (username && !/Medlem sedan|Visningar|Kan skickas/i.test(username) && username.length > 1) {
      console.log('Gearloop: Extracted seller username from HTML:', username);
      return { username };
    }
  }
  
  // Fallback: try to find username near avatar section
  const avatarSectionMatch = html.match(/class="[^"]*rounded-full[^"]*"[\s\S]{0,500}?<p[^>]*>([^<]+)<\/p>/i);
  if (avatarSectionMatch && avatarSectionMatch[1]) {
    username = avatarSectionMatch[1].replace(/&nbsp;/g, '').trim();
    if (username && username.length > 1 && !/Medlem sedan|Visningar/i.test(username)) {
      console.log('Gearloop: Extracted seller username from avatar section:', username);
      return { username };
    }
  }
  
  return undefined;
}

/** Gearloop: take condition only from the side menu (sidomeny), not from description text. */
function extractGearloopConditionFromSidebar(html: string): string | undefined {
  // Strip the main article so we don't pick up "Skick: Vintage-skick med..." from the body
  const withoutArticle = html.replace(/<article[^>]*>[\s\S]*?<\/article>/gi, '');
  const match = withoutArticle.match(/Skick:\s*([^\n<]+)/i);
  const value = match ? match[1].trim() : undefined;
  // Side menu values are short (e.g. "Bra", "Mycket bra skick"); ignore long text from elsewhere
  if (value && value.length <= 80) {
    return value;
  }
  return undefined;
}

function extractCondition(markdown: string): string | undefined {
  const match = markdown.match(/Skick:\s*([^\n]+)/i);
  return match ? match[1].trim() : undefined;
}
