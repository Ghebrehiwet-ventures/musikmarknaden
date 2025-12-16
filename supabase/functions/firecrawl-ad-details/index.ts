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
  const title = (metadata.title as string)?.split(' - ')[0] || extractTitle(markdown) || 'Okänd titel';
  
  // Extract description - get the main content from markdown
  const description = extractDescription(markdown);
  
  // Extract price
  const priceMatch = markdown.match(/(\d[\d\s]*):?-?\s*kr/i) || markdown.match(/(\d[\d\s]*)\s*kr/i);
  const priceText = priceMatch ? `${priceMatch[1].replace(/\s/g, '')} kr` : null;
  const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;
  
  // Extract location
  const location = extractLocation(markdown);
  
  // Extract images from HTML - filter out avatars and icons
  const images = extractImages(html);
  
  // Extract contact info
  const contactInfo = extractContactInfo(markdown, html);

  // Extract seller info
  const sellerInfo = extractSellerInfo(markdown);
  
  // Extract condition
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

function extractDescription(markdown: string): string {
  const lines = markdown.split('\n');
  const contentLines: string[] = [];
  
  // Keywords that indicate we should skip lines
  const skipPatterns = [
    /^!\[/,                           // Markdown images
    /^\[.*\]\(.*gearloop/i,           // Links to gearloop
    /^- \[/,                          // List items with links
    /sveriges marknadsplats/i,        // Footer text
    /om gearloop/i,
    /^support$/i,
    /^villkor$/i,
    /^tips$/i,
    /medlem sedan/i,
    /visningar:/i,
    /skickas \*\*ej\*\*/i,
    /^\d{1,2}:\d{2}$/,                // Time stamps like 11:06
    /^\d+\s*kr\d/,                    // Price with date attached
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Skip if matches any skip pattern
    const shouldSkip = skipPatterns.some(p => p.test(trimmed));
    if (shouldSkip) continue;
    
    // Skip pure navigation/header elements
    if (trimmed.startsWith('#') || trimmed === '|' || trimmed.startsWith('---')) continue;
    
    contentLines.push(trimmed);
  }
  
  // Take the description part - usually after price/location info
  let desc = contentLines.join('\n').trim();
  
  // Clean up markdown artifacts
  desc = desc.replace(/!\[\]\([^)]+\)/g, '');  // Remove empty markdown images
  desc = desc.replace(/×!/g, '');               // Remove weird artifacts
  desc = desc.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Convert links to text
  desc = desc.replace(/\*\*/g, '');             // Remove bold markers
  
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

function extractImages(html: string): string[] {
  const images: string[] = [];
  
  // Match asset URLs specifically
  const urlRegex = /https:\/\/assets\.gearloop\.se\/files\/\d+\.(?:jpg|jpeg|png|gif|webp)/gi;
  let match;
  
  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[0];
    // Skip duplicates
    if (!images.includes(url)) {
      images.push(url);
    }
  }
  
  return images;
}

function extractContactInfo(markdown: string, html: string): { email?: string; phone?: string } {
  const contactInfo: { email?: string; phone?: string } = {};
  
  const emailMatch = markdown.match(/[\w.-]+@[\w.-]+\.\w+/);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  const phoneMatch = markdown.match(/(?:0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2}|\+46[-\s]?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2}[-\s]?\d{2})/);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }
  
  return contactInfo;
}

function extractSellerInfo(markdown: string): { name?: string; username?: string } | undefined {
  const lines = markdown.split('\n');
  let foundMember = false;
  let name: string | undefined;
  let username: string | undefined;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.toLowerCase().includes('medlem sedan')) {
      foundMember = true;
      // Look backwards for name/username
      if (i >= 2) {
        username = lines[i - 1]?.trim();
        name = lines[i - 2]?.trim();
      }
      break;
    }
  }
  
  if (name || username) {
    return { name, username };
  }
  return undefined;
}

function extractCondition(markdown: string): string | undefined {
  const match = markdown.match(/Skick:\s*([^\n]+)/i);
  return match ? match[1].trim() : undefined;
}
