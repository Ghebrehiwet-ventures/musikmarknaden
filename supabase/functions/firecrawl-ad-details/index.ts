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
  const description = sourceType === 'musikborsen' 
    ? extractMusikborsenDescription(markdown)
    : extractGearloopDescription(markdown);
  
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
  
  const contactInfo = extractContactInfo(markdown, html);
  const sellerInfo = sourceType === 'gearloop' ? extractSellerInfo(markdown) : undefined;
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

// Gearloop-specific description extraction
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

function extractImages(html: string, sourceType: string): string[] {
  const images: string[] = [];
  
  if (sourceType === 'musikborsen') {
    // Musikbörsen uses WordPress uploads
    const mbRegex = /https?:\/\/musikborsen\.se\/wp-content\/uploads\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
    let match;
    while ((match = mbRegex.exec(html)) !== null) {
      const url = match[0];
      // Skip tiny thumbnails
      if (!url.includes('-150x') && !url.includes('-100x') && !images.includes(url)) {
        images.push(url);
      }
    }
  } else if (sourceType === 'gearloop') {
    // Gearloop uses their CDN
    const glRegex = /https:\/\/assets\.gearloop\.se\/files\/\d+\.(?:jpg|jpeg|png|gif|webp)/gi;
    let match;
    while ((match = glRegex.exec(html)) !== null) {
      const url = match[0];
      if (!images.includes(url)) {
        images.push(url);
      }
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

function extractContactInfo(markdown: string, _html: string): { email?: string; phone?: string } {
  const contactInfo: { email?: string; phone?: string } = {};
  
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

function extractSellerInfo(markdown: string): { name?: string; username?: string } | undefined {
  const lines = markdown.split('\n');
  let name: string | undefined;
  let username: string | undefined;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().includes('medlem sedan')) {
      if (i >= 2) {
        username = lines[i - 1]?.trim();
        name = lines[i - 2]?.trim();
      }
      break;
    }
  }
  
  if (name && /^[×x]$/i.test(name)) name = undefined;
  if (username && /^[×x]$/i.test(username)) username = undefined;
  
  if (name || username) {
    return { name, username };
  }
  return undefined;
}

function extractCondition(markdown: string): string | undefined {
  const match = markdown.match(/Skick:\s*([^\n]+)/i);
  return match ? match[1].trim() : undefined;
}
