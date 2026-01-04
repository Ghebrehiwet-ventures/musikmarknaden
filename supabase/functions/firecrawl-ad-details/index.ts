import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detect source from URL
function getSourceType(url: string): 'musikborsen' | 'gearloop' | 'dlxmusic' | 'unknown' {
  if (url.includes('musikborsen.se')) return 'musikborsen';
  if (url.includes('gearloop.se')) return 'gearloop';
  if (url.includes('dlxmusic.se')) return 'dlxmusic';
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
      if (daysSinceUpdate < 7) {
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

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: ad_url,
        formats: ['markdown', 'html'],
        onlyMainContent: false, // Get full page for better image extraction
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
    const html = data.data?.html || data.html || '';
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
    const firstImage = adDetails.images && adDetails.images.length > 0 ? adDetails.images[0] : null;
    const shortDescription = adDetails.description?.substring(0, 500) || null;
    
    if (firstImage || shortDescription) {
      const updateData: Record<string, string | null> = {};
      if (firstImage) updateData.image_url = firstImage;
      if (shortDescription) updateData.description = shortDescription;
      
      const { error: listingUpdateError } = await supabase
        .from('ad_listings_cache')
        .update(updateData)
        .eq('ad_url', ad_url);
      
      if (listingUpdateError) {
        console.error('Failed to update listing with image/description:', listingUpdateError);
      } else {
        console.log('Updated listing with image:', !!firstImage, 'description:', !!shortDescription);
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
  sourceType: 'musikborsen' | 'gearloop' | 'dlxmusic' | 'unknown'
) {
  const title = (metadata.title as string)?.split(' - ')[0]?.split(' | ')[0] || extractTitle(markdown) || 'Okänd titel';
  
  // Extract description with source-specific cleaning
  let description: string;
  if (sourceType === 'gearloop') {
    // For Gearloop, extract from HTML to get clean description
    description = extractGearloopDescriptionFromHtml(html);
  } else if (sourceType === 'musikborsen') {
    description = extractMusikborsenDescription(markdown);
  } else {
    description = extractGearloopDescription(markdown);
  }
  
  // Extract price
  const priceMatch = markdown.match(/(\d[\d\s]*):?-?\s*kr/i) || markdown.match(/(\d[\d\s]*)\s*kr/i);
  const priceText = priceMatch ? `${priceMatch[1].replace(/\s/g, '')} kr` : null;
  const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;
  
  // Extract location with source-specific patterns
  const location = sourceType === 'musikborsen'
    ? extractMusikborsenLocation(markdown)
    : extractLocation(markdown);
  
  // Extract images with source-specific patterns
  const images = extractImages(html, sourceType);
  
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

// Helper to get base image URL without WordPress size suffix
function getBaseImageUrl(url: string): string {
  // Remove WordPress size suffixes like -300x200, -768x1024, etc.
  return url.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|gif|webp))/i, '');
}

function extractImages(html: string, sourceType: string): string[] {
  const images: string[] = [];
  
  if (sourceType === 'musikborsen') {
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
  } else {
    // Generic image extraction
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

function extractContactInfo(
  markdown: string, 
  html: string, 
  sourceType: 'musikborsen' | 'gearloop' | 'dlxmusic' | 'unknown'
): { email?: string; phone?: string } {
  const contactInfo: { email?: string; phone?: string } = {};
  
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
