import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect source from URL
function getSourceType(url: string): 'musikborsen' | 'gearloop' | 'dlxmusic' | 'gear4music' | 'blocket' | 'jam' | 'unknown' {
  if (url.includes('musikborsen.se')) return 'musikborsen';
  if (url.includes('gearloop.se')) return 'gearloop';
  if (url.includes('dlxmusic.se')) return 'dlxmusic';
  if (url.includes('gear4music.se') || url.includes('gear4music.com')) return 'gear4music';
  if (url.includes('blocket.se')) return 'blocket';
  if (url.includes('jam.se')) return 'jam';
  return 'unknown';
}

serve(async (req) => {
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
    const hasBadBlocketImages = sourceType === 'blocket' && cachedImagesCount <= 1;
    const hasBadBlocketDescription = sourceType === 'blocket' && looksLikeBadBlocketDescription(cached.description || '');
    const bypassCacheForBlocket = hasBadBlocketImages || hasBadBlocketDescription;

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

    console.log(`× Cache miss - scraping from Firecrawl [${sourceType}]:`, ad_url);
    const scrapeStart = Date.now();

    // Blocket loads images dynamically with JS - need to wait for rendering
    const needsWait = sourceType === 'blocket';
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
        onlyMainContent: false, // Get full page for better image extraction
        ...(needsWait && { waitFor: 6000 }), // Blocket gallery often loads after initial render
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

    const scrapeTime = Date.now() - scrapeStart;
    console.log(`Scrape successful in ${scrapeTime}ms, parsing ad details for source: ${sourceType}`);

    const markdown = data.data?.markdown || data.markdown || '';
    const processedHtml = data.data?.html || data.html || '';
    const rawHtml = data.data?.rawHtml || data.rawHtml || '';
    const html = sourceType === 'blocket' && rawHtml ? rawHtml : processedHtml;
    const metadata = data.data?.metadata || data.metadata || {};

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
  sourceType: 'musikborsen' | 'gearloop' | 'dlxmusic' | 'gear4music' | 'blocket' | 'jam' | 'unknown'
) {
  // For Jam.se, use dedicated parser
  if (sourceType === 'jam') {
    return parseJamAdDetails(markdown, html, metadata);
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
  const condition = extractCondition(markdown);

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
    'Bell',
    'Chevron',
    'Person silhouette',
    'Checklist checkmark',
    'En del av Vend',
    'upphovsrättslagen',
    'Logga in',
    'Notiser',
    'Meddelanden',
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
  
  // Strategy 1: Try JSON-LD structured data (cleanest source)
  const jsonLdDescription = extractBlocketDescriptionFromJsonLd(html);
  if (jsonLdDescription && jsonLdDescription.length > 20 && !looksLikeBadBlocketDescription(jsonLdDescription)) {
    console.log('Blocket: Got description from JSON-LD, length:', jsonLdDescription.length);
    return jsonLdDescription;
  }
  
  // Strategy 2: Try Next.js __NEXT_DATA__ (contains full ad data)
  const nextDataDescription = extractBlocketDescriptionFromNextData(html);
  if (nextDataDescription && nextDataDescription.length > 20 && !looksLikeBadBlocketDescription(nextDataDescription)) {
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
            
            if (desc.length > 20) {
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
    const candidates = findDescriptionCandidates(data, 0);
    
    // Sort by length (longer is usually better for descriptions)
    candidates.sort((a, b) => b.length - a.length);
    
    // Return the best candidate that passes quality checks
    for (const candidate of candidates) {
      if (candidate.length > 50 && !looksLikeBadBlocketDescription(candidate)) {
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
  
  // Blocket-specific patterns to skip
  const skipPatterns = [
    /^Gå till annonsen$/i,
    /^Torget\//i,
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
  
  for (const line of lines) {
    // Normalize: remove invisible chars, trim
    const trimmed = line.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!trimmed) continue;
    
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
    // Extract the article section only to avoid "related ads" images
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const articleHtml = articleMatch ? articleMatch[1] : '';
    
    if (articleHtml) {
      // 1. Get initial image from imageSlider() call
      const sliderMatch = articleHtml.match(/imageSlider\(['"]([^'"]+)['"]\)/);
      if (sliderMatch && sliderMatch[1].includes('assets.gearloop.se')) {
        images.push(sliderMatch[1]);
      }
      
      // 2. Get all data-image attributes (carousel thumbnails point to full images)
      const dataImageRegex = /data-image=["']([^"']+)["']/gi;
      let match;
      while ((match = dataImageRegex.exec(articleHtml)) !== null) {
        const url = match[1];
        if (url.includes('assets.gearloop.se') && !images.includes(url)) {
          images.push(url);
        }
      }
      
      // 3. Check for background-image in style attributes within article
      const bgImageRegex = /style="[^"]*background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
      while ((match = bgImageRegex.exec(articleHtml)) !== null) {
        const url = match[1];
        if (url.includes('assets.gearloop.se') && !images.includes(url)) {
          images.push(url);
        }
      }
    }
    
    // NO FALLBACK - if no images in article, ad has no images
    // This prevents picking up images from "Mer från samma kategori" section
    if (images.length === 0) {
      console.log('Gearloop: No images found in article - ad has no images');
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

// Jam.se-specific parser - uses JSON-LD and og: tags for clean extraction
function parseJamAdDetails(markdown: string, html: string, metadata: Record<string, unknown>) {
  console.log('Jam: Starting dedicated Jam.se parser');
  
  // 1. Extract title from JSON-LD or og:title (avoid cookie banner text)
  let title = '';
  
  // Try JSON-LD first
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.name) {
        title = jsonLd.name;
        console.log('Jam: Got title from JSON-LD:', title);
      }
    } catch (e) {
      console.log('Jam: Failed to parse JSON-LD');
    }
  }
  
  // Fallback to og:title
  if (!title) {
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) {
      title = ogTitleMatch[1].split(' - ')[0].split(' | ')[0];
      console.log('Jam: Got title from og:title:', title);
    }
  }
  
  // Fallback to metadata title (but clean it)
  if (!title && metadata.title) {
    title = (metadata.title as string).split(' - ')[0].split(' | ')[0];
    // Skip if it's cookie banner text
    if (title.toLowerCase().includes('cookie') || title.toLowerCase().includes('webbsidan använder')) {
      title = '';
    }
  }
  
  if (!title) {
    title = 'Okänd titel';
  }
  
  // 2. Extract description from JSON-LD or product description section
  let description = '';
  
  // Try JSON-LD first
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.description) {
        description = jsonLd.description;
        console.log('Jam: Got description from JSON-LD, length:', description.length);
      }
    } catch (e) {
      // Already logged above
    }
  }
  
  // Fallback: extract from og:description
  if (!description) {
    const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDescMatch) {
      description = ogDescMatch[1];
      console.log('Jam: Got description from og:description');
    }
  }
  
  // Fallback: look for product description div
  if (!description) {
    // Jam uses tws-textblock for product descriptions
    const descBlockMatch = html.match(/<div[^>]*class="[^"]*tws-textblock[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (descBlockMatch) {
      description = descBlockMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      console.log('Jam: Got description from tws-textblock');
    }
  }
  
  if (!description) {
    description = 'Ingen beskrivning tillgänglig';
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
  };
}

// Jam.se-specific image extraction - only extract THIS product's images
function extractJamImages(html: string, metadata: Record<string, unknown>): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  
  console.log('Jam: Starting image extraction');
  
  // Helper to add image with deduplication
  const addImage = (url: string): boolean => {
    if (!url || seen.has(url)) return false;
    // Only accept cdn.abicart.com images
    if (!url.includes('cdn.abicart.com')) return false;
    // Skip tiny thumbnails
    if (url.includes('/50/') || url.includes('/100/')) return false;
    seen.add(url);
    images.push(url);
    return true;
  };
  
  // Priority 1: og:image (most reliable - specific to THIS product)
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  if (ogImageMatch && ogImageMatch[1].includes('cdn.abicart.com')) {
    addImage(ogImageMatch[1]);
    console.log('Jam: Got image from og:image');
  }
  
  // Priority 2: JSON-LD Product image
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] === 'Product' && jsonLd.image) {
        const jsonImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
        for (const img of jsonImages) {
          if (typeof img === 'string') {
            addImage(img);
          } else if (img?.url) {
            addImage(img.url);
          }
        }
        console.log('Jam: Got images from JSON-LD');
      }
    } catch (e) {
      console.log('Jam: Failed to parse JSON-LD for images');
    }
  }
  
  // Priority 3: Product gallery - look for tws-product-image or similar container
  // Only extract from product gallery section, NOT from related products
  const productGalleryMatch = html.match(/<div[^>]*class="[^"]*tws-product-image[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (productGalleryMatch) {
    const galleryHtml = productGalleryMatch[1];
    // Extract source attribute from tws-react-img divs
    const sourceMatches = galleryHtml.matchAll(/source="(https:\/\/cdn\.abicart\.com\/shop\/[^"]+)"/gi);
    for (const match of sourceMatches) {
      addImage(match[1]);
    }
    console.log('Jam: Got images from product gallery');
  }
  
  // Cap at 10 images to prevent gallery flooding
  if (images.length > 10) {
    console.log(`Jam: Capping images from ${images.length} to 10`);
    return images.slice(0, 10);
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

function extractCondition(markdown: string): string | undefined {
  const match = markdown.match(/Skick:\s*([^\n]+)/i);
  return match ? match[1].trim() : undefined;
}
