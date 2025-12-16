import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Scraping ad details from:', ad_url);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: ad_url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
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

    console.log('Scrape successful, parsing ad details');

    // Extract ad details from the scraped content
    const markdown = data.data?.markdown || data.markdown || '';
    const html = data.data?.html || data.html || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Parse the scraped content to extract ad details
    const adDetails = parseGearloopAd(markdown, html, metadata);

    console.log('Parsed ad details:', adDetails);

    return new Response(
      JSON.stringify(adDetails),
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

function parseGearloopAd(markdown: string, html: string, metadata: Record<string, unknown>) {
  // Extract title from metadata or markdown
  const title = (metadata.title as string) || extractTitle(markdown) || 'Okänd titel';
  
  // Extract description - get the main content from markdown
  const description = extractDescription(markdown);
  
  // Extract price
  const priceMatch = markdown.match(/(\d[\d\s]*)\s*kr/i);
  const priceText = priceMatch ? `${priceMatch[1].replace(/\s/g, '')} kr` : null;
  const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;
  
  // Extract location
  const location = extractLocation(markdown);
  
  // Extract images from HTML
  const images = extractImages(html);
  
  // Extract contact info
  const contactInfo = extractContactInfo(markdown, html);

  return {
    title,
    description,
    price_text: priceText,
    price_amount: priceAmount,
    location,
    images,
    contact_info: contactInfo,
  };
}

function extractTitle(markdown: string): string {
  // Try to find a header
  const headerMatch = markdown.match(/^#\s+(.+)$/m);
  if (headerMatch) return headerMatch[1];
  
  // Get first line as fallback
  const firstLine = markdown.split('\n').find(line => line.trim().length > 0);
  return firstLine?.trim() || '';
}

function extractDescription(markdown: string): string {
  // Remove headers and extract main content
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  let foundContent = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip headers, empty lines at start, and navigation elements
    if (trimmed.startsWith('#') || trimmed.startsWith('[') || trimmed.includes('|')) {
      if (foundContent) continue;
      continue;
    }
    if (trimmed.length > 0) {
      foundContent = true;
      contentLines.push(trimmed);
    }
  }
  
  return contentLines.join('\n').trim() || 'Ingen beskrivning tillgänglig';
}

function extractLocation(markdown: string): string {
  // Common Swedish cities and location patterns
  const locationPatterns = [
    /(?:Plats|Ort|Stad|Kommun):\s*([^\n,]+)/i,
    /(?:finns i|hämtas i|säljes i|ligger i)\s+([A-ZÅÄÖ][a-zåäö]+)/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = markdown.match(pattern);
    if (match) return match[1].trim();
  }
  
  // Try to find Swedish city names
  const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Sundsvall', 'Eskilstuna', 'Karlstad', 'Växjö', 'Halmstad', 'Sundbyberg', 'Kungsbacka', 'Vallentuna', 'Ljusnarsberg'];
  
  for (const city of cities) {
    if (markdown.includes(city)) return city;
  }
  
  return 'Okänd plats';
}

function extractImages(html: string): string[] {
  const images: string[] = [];
  
  // Match img tags with gearloop/assets URLs
  const imgRegex = /<img[^>]+src=["']([^"']*(?:gearloop|assets\.gearloop)[^"']*)["'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (!images.includes(src) && !src.includes('icon') && !src.includes('logo')) {
      images.push(src);
    }
  }
  
  // Also try to find image URLs in the content
  const urlRegex = /https:\/\/assets\.gearloop\.se\/files\/[^\s"'<>]+\.(?:jpg|jpeg|png|gif|webp)/gi;
  while ((match = urlRegex.exec(html)) !== null) {
    if (!images.includes(match[0])) {
      images.push(match[0]);
    }
  }
  
  return images;
}

function extractContactInfo(markdown: string, html: string): { email?: string; phone?: string } {
  const contactInfo: { email?: string; phone?: string } = {};
  
  // Extract email
  const emailMatch = markdown.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  // Extract phone number (Swedish format)
  const phoneMatch = markdown.match(/(?:0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2}|\+46[-\s]?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2})/);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }
  
  return contactInfo;
}
