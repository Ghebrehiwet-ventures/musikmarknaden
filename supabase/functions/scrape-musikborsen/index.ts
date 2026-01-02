import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MusikborsenProduct {
  title: string;
  ad_url: string;
  price_text: string | null;
  price_amount: number | null;
  location: string;
  image_url: string;
  category: string;
}

function parsePrice(priceText: string): { text: string; amount: number | null } {
  const cleanText = priceText.replace(/\s+/g, ' ').trim();
  const match = cleanText.match(/(\d[\d\s]*)/);
  if (match) {
    const amount = parseInt(match[1].replace(/\s/g, ''), 10);
    return { text: cleanText, amount: isNaN(amount) ? null : amount };
  }
  return { text: cleanText, amount: null };
}

// Keyword-based categorization matching internal categories
// Extended with more brands, models, and Swedish terms
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'instrument': [
    // Guitars & brands
    'gitarr', 'guitar', 'fender', 'gibson', 'ibanez', 'epiphone', 'schecter', 'stratocaster', 'telecaster', 'les paul',
    'prs', 'paul reed smith', 'g&l', 'music man', 'suhr', 'charvel', 'jackson', 'esp', 'ltd', 'squier',
    'gretsch', 'rickenbacker', 'taylor', 'martin', 'takamine', 'yamaha fg', 'yamaha c', 'cordoba', 'godin',
    'hagström', 'hagstrom', 'larrivee', 'collings', 'santa cruz', 'guild', 'ovation', 'breedlove',
    // Bass
    'bas', 'bass', 'precision', 'jazz bass', 'hofner', 'stingray', 'warwick', 'sandberg', 'spector', 'lakland',
    'dingwall', 'sadowsky', 'fodera', 'mayones', 'marleaux', 'zon', 'esh', 'elrick',
    // Drums
    'trumm', 'drum', 'virvel', 'snare', 'cymbal', 'hi-hat', 'pearl', 'sonor', 'tama', 'dw', 'zildjian', 'sabian',
    'mapex', 'gretsch drums', 'ludwig', 'yamaha drums', 'paiste', 'meinl', 'istanbul', 'bosphorus',
    'kick', 'bastrumma', 'tom', 'floor tom', 'ride', 'crash', 'splash', 'china', 'slagverk', 'percussion',
    // Keys
    'piano', 'flygel', 'rhodes', 'wurlitzer', 'clavinet', 'keyboard', 'tangent', 'klaver',
    // Wind/String
    'saxofon', 'trumpet', 'violin', 'cello', 'flöjt', 'klarinett', 'oboe', 'fagott', 'trombon', 'valthorn',
    'ukulele', 'mandolin', 'banjo', 'munspel', 'dragspel', 'accordion', 'fiol', 'viola', 'kontrabas'
  ],
  'amplifiers': [
    'förstärkare', 'amp', 'combo', 'marshall', 'vox', 'mesa', 'boogie', 'mesa boogie', 'mesa/boogie',
    'peavey', 'engl', 'orange', 'blackstar', 'laney', 'ampeg', 'head', 'topteil', 'topp',
    'cab', 'cabinet', 'speaker', 'högtalare', 'rörtop', 'tube amp', 'rörförstärkare',
    'fender amp', 'fender twin', 'fender deluxe', 'fender bassman', 'blues junior', 'hot rod',
    'soldano', 'bogner', 'friedman', 'diezel', 'hughes & kettner', 'h&k', 'randall', 'egnater',
    'quilter', 'quilter labs', 'markbass', 'hartke', 'gallien krueger', 'gk', 'aguilar', 'eden',
    'roland jc', 'jazz chorus', 'kemper', 'line 6', 'helix', 'fractal', 'axe-fx', 'neural dsp', 'quad cortex'
  ],
  'pedals-effects': [
    'pedal', 'effekt', 'effect', 'drive', 'overdrive', 'distortion', 'fuzz', 'effektpedal', 'gitarrpedal',
    'delay', 'reverb', 'echo', 'chorus', 'flanger', 'phaser', 'wah', 'tremolo', 'vibrato',
    'boss', 'mxr', 'electro-harmonix', 'ehx', 'strymon', 'eventide', 'tc electronic',
    'walrus', 'jhs', 'keeley', 'ibanez ts', 'tube screamer', 'big muff', 'looper', 'multieffekt',
    'fulltone', 'analogman', 'earthquaker', 'eqd', 'chase bliss', 'meris', 'source audio',
    'way huge', 'dunlop', 'cry baby', 'klon', 'klone', 'timmy', 'blues breaker', 'rat', 'ds-1', 'bd-2',
    'tuner pedal', 'noise gate', 'compressor pedal', 'booster', 'boost pedal', 'preamp pedal'
  ],
  'synth-modular': [
    'synth', 'synthesizer', 'moog', 'korg', 'roland', 'yamaha dx', 'prophet', 'juno', 'jupiter',
    'eurorack', 'modular', 'sequencer', 'arturia', 'nord', 'access virus', 'dave smith', 'dsi', 'sequential',
    'minilogue', 'monologue', 'microkorg', 'minmoog', 'minimoog', 'op-1', 'teenage engineering', 'op-z',
    'sampler', 'mpc', 'maschine', 'elektron', 'octatrack', 'digitakt', 'digitone', 'model:samples',
    'analogsynt', 'analog synth', 'polysynth', 'monosynth', 'oberheim', 'arp', 'buchla', 'make noise',
    'behringer synth', 'deepmind', 'model d', 'prologue', 'rev2', 'peak', 'summit', 'hydrasynth',
    'waldorf', 'blofeld', 'microfreak', 'grandmother', 'matriarch', 'subsequent', 'sub 37',
    'rs-505', 'sh-101', 'jx-3p', 'jp-8000', 'jd-800', 'v-synth', 'd-50', 'dx7', 'sy77', 'cs-80',
    'cp4', 'cp40', 'nord stage', 'nord electro', 'nord lead', 'clavia'
  ],
  'studio': [
    'mikrofon', 'microphone', 'neumann', 'shure', 'sennheiser', 'akg', 'rode', 'audio-technica',
    'interface', 'ljudkort', 'audio interface', 'preamp', 'kompressor', 'compressor',
    'eq', 'equalizer', 'mixer', 'mackie', 'mischpult', 'mixing desk', 'mixerbord',
    'monitor', 'studiomonitor', 'focusrite', 'universal audio', 'uad', 'api', 'neve', 'ssl',
    'scarlett', 'apollo', 'clarett', 'genelec', 'adam audio', 'yamaha hs', 'krk', 'jbl', 'dynaudio',
    'sm57', 'sm58', 'u87', 'c414', 'at2020', 'nt1', 'tlm', 'condensator', 'kondensator',
    'audient', 'motu', 'rme', 'apogee', 'steinberg', 'behringer umc', 'presonus', 'antelope',
    'outboard', 'channel strip', 'la-2a', '1176', 'dbx', 'distressor', 'avalon', 'manley', 'tube-tech',
    'patchbay', 'di-box', 'di box', 'reamp'
  ],
  'dj-live': [
    'dj', 'turntable', 'skivspelare', 'cdj', 'controller', 'pioneer', 'technics', 'rane', 'serato', 'traktor',
    'pa', 'pa-system', 'line array', 'subwoofer', 'sub', 'aktiv högtalare', 'powered speaker',
    'ljus', 'lighting', 'dmx', 'moving head', 'laser', 'strobe', 'fog', 'haze', 'ljuseffekt',
    'denon dj', 'numark', 'allen & heath', 'xone', 'djm', 'ddj', 'rekordbox', 'virtual dj',
    'in-ear', 'iem', 'monitor system', 'stagebox', 'snake', 'splitter', 'di-box live',
    'turbosound', 'rcf', 'qsc', 'electro-voice', 'ev', 'jbl prx', 'jbl eon', 'yamaha dxr',
    'smoke machine', 'rökmaskin', 'par can', 'led bar', 'wash', 'spot'
  ],
  'accessories-parts': [
    'case', 'väska', 'bag', 'gigbag', 'flightcase', 'hardcase', 'softcase',
    'stativ', 'stand', 'kabel', 'cable', 'sträng', 'string', 'plektrum', 'pick',
    'strap', 'rem', 'gitarrem', 'mikrofonstativ', 'pedalboard', 'pickups', 'pickup',
    'sadel', 'bridge', 'tuner', 'stämapparat', 'capo', 'slide', 'bottleneck',
    'dämpare', 'mute', 'trumbälte', 'cymbalställ', 'hi-hat stand', 'snare stand',
    'noter', 'notställ', 'music stand', 'metronom', 'strängvinda', 'string winder',
    'kabelhärva', 'adapter', 'power supply', 'strömförsörjning', 'isolated power',
    'humbucker', 'single coil', 'p90', 'emg', 'seymour duncan', 'dimarzio', 'lollar', 'bare knuckle'
  ]
};

// Decode HTML entities like &amp; -> &
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Short keywords that need word boundaries to avoid false positives
const SHORT_KEYWORDS = new Set(['amp', 'bas', 'cab', 'dj', 'pa', 'eq', 'sub']);

function categorizeByKeywords(title: string): string {
  const decoded = decodeHtmlEntities(title);
  const titleLower = decoded.toLowerCase();
  
  // Check instrument keywords first (higher priority for things like "G&L bass")
  for (const keyword of CATEGORY_KEYWORDS['instrument']) {
    const kw = keyword.toLowerCase();
    if (SHORT_KEYWORDS.has(kw)) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(titleLower)) return 'instrument';
    } else if (titleLower.includes(kw)) {
      return 'instrument';
    }
  }
  
  // Then check other categories
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'instrument') continue;
    for (const keyword of keywords) {
      const kw = keyword.toLowerCase();
      if (SHORT_KEYWORDS.has(kw)) {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(titleLower)) return category;
      } else if (titleLower.includes(kw)) {
        return category;
      }
    }
  }
  return 'other';
}

// AI categorization using Lovable AI
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
      return result.category;
    }
    return null;
  } catch (error) {
    console.error(`AI categorization error for "${title}":`, error);
    return null;
  }
}

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeMusikborsen(firecrawlApiKey: string): Promise<MusikborsenProduct[]> {
  console.log('Starting Musikbörsen scrape...');
  
  const products: MusikborsenProduct[] = [];
  const baseUrl = 'https://musikborsen.se/begagnat/';
  
  // First, get the list of all product URLs using map
  console.log('Mapping Musikbörsen URLs...');
  const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: baseUrl,
      limit: 1000,
      includeSubdomains: false,
    }),
  });

  if (!mapResponse.ok) {
    const error = await mapResponse.text();
    console.error('Map failed:', error);
    throw new Error(`Map failed: ${error}`);
  }

  const mapData = await mapResponse.json();
  console.log(`Found ${mapData.links?.length || 0} URLs`);

  // Filter to only product URLs (they contain /begagnat/ and a product slug)
  const productUrls = (mapData.links || []).filter((url: string) => {
    return url.includes('/begagnat/') && 
           !url.endsWith('/begagnat/') && 
           !url.includes('page=') &&
           url.split('/').length > 4;
  });

  console.log(`Filtered to ${productUrls.length} product URLs`);

  // Scrape the main listing page to get product data
  console.log('Scraping listing page...');
  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: baseUrl,
      formats: ['html', 'markdown'],
      waitFor: 2000,
    }),
  });

  if (!scrapeResponse.ok) {
    const error = await scrapeResponse.text();
    console.error('Scrape failed:', error);
    throw new Error(`Scrape failed: ${error}`);
  }

  const scrapeData = await scrapeResponse.json();
  const html = scrapeData.data?.html || scrapeData.html || '';
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';

  console.log(`Got HTML (${html.length} chars) and markdown (${markdown.length} chars)`);

  // Parse products from HTML using regex
  // WordPress structure: li.secondhand-product-excerpt with nested elements
  const productMatches = html.matchAll(
    /<li[^>]*class="[^"]*secondhand-product-excerpt[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  );

  for (const match of productMatches) {
    const productHtml = match[1];
    
    // Extract URL
    const urlMatch = productHtml.match(/href="([^"]+)"/);
    const adUrl = urlMatch ? urlMatch[1] : '';
    
    // Extract title
    const titleMatch = productHtml.match(/<h3[^>]*class="[^"]*heading[^"]*"[^>]*>(.*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    // Extract price
    const priceMatch = productHtml.match(/<p[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/p>/i);
    const priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const { text: priceTextClean, amount: priceAmount } = parsePrice(priceText);
    
    // Extract location/store
    const storeMatch = productHtml.match(/<p[^>]*class="[^"]*store[^"]*"[^>]*>(.*?)<\/p>/i);
    const location = storeMatch ? storeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    // Extract image
    const imgMatch = productHtml.match(/(?:data-src|src)="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : '';
    
    // Categorize by title keywords
    const category = categorizeByKeywords(title);

    if (title && adUrl) {
      products.push({
        title,
        ad_url: adUrl,
        price_text: priceTextClean || null,
        price_amount: priceAmount,
        location,
        image_url: imageUrl,
        category,
      });
    }
  }

  console.log(`Parsed ${products.length} products from HTML`);

  // If HTML parsing didn't work well, try markdown parsing as fallback
  if (products.length < 10 && markdown) {
    console.log('Trying markdown parsing as fallback...');
    
    // Parse markdown format - products are typically in a structured list
    const lines = markdown.split('\n');
    let currentProduct: Partial<MusikborsenProduct> = {};
    
    for (const line of lines) {
      // Look for product links
      const linkMatch = line.match(/\[([^\]]+)\]\((https:\/\/musikborsen\.se\/begagnat\/[^)]+)\)/);
      if (linkMatch) {
        if (currentProduct.title && currentProduct.ad_url) {
          products.push(currentProduct as MusikborsenProduct);
        }
        currentProduct = {
          title: linkMatch[1],
          ad_url: linkMatch[2],
          category: categorizeByKeywords(linkMatch[1]),
          price_text: null,
          price_amount: null,
          location: '',
          image_url: '',
        };
      }
      
      // Look for price
      const priceMatch = line.match(/(\d[\d\s]*)\s*kr/i);
      if (priceMatch && currentProduct.title) {
        const { text, amount } = parsePrice(priceMatch[0]);
        currentProduct.price_text = text;
        currentProduct.price_amount = amount;
      }
    }
    
    // Add last product
    if (currentProduct.title && currentProduct.ad_url) {
      products.push(currentProduct as MusikborsenProduct);
    }
  }

  // Deduplicate by URL
  const uniqueProducts = Array.from(
    new Map(products.map(p => [p.ad_url, p])).values()
  );

  console.log(`Returning ${uniqueProducts.length} unique products`);
  return uniqueProducts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!firecrawlApiKey) {
      throw new Error('FIRECRAWL_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const sourceId = body.source_id;

    // Get source details if source_id provided
    let sourceName = 'Musikbörsen';
    if (sourceId) {
      const { data: source } = await supabase
        .from('scraping_sources')
        .select('name')
        .eq('id', sourceId)
        .single();
      
      if (source) {
        sourceName = source.name;
      }
    }

    // Get category mappings for this source
    const { data: mappings } = await supabase
      .from('category_mappings')
      .select('external_category, internal_category')
      .eq('source_id', sourceId);

    const categoryMap = new Map(
      (mappings || []).map(m => [m.external_category.toLowerCase(), m.internal_category])
    );

    // Scrape products
    const products = await scrapeMusikborsen(firecrawlApiKey);

    // Skip inline AI categorization during scrape - use keyword-based for speed
    // AI categorization will run as a separate mini-batch after upsert
    console.log('Using keyword-based categorization during scrape (AI will run as mini-batch after)');

    // Prepare ads for upsert
    const now = new Date().toISOString();
    const adsToUpsert = products.map(product => ({
      ad_url: product.ad_url,
      ad_path: new URL(product.ad_url).pathname,
      title: product.title,
      price_text: product.price_text,
      price_amount: product.price_amount,
      location: product.location,
      image_url: product.image_url,
      category: categoryMap.get(product.category.toLowerCase()) || product.category,
      date: now.split('T')[0],
      is_active: true,
      last_seen_at: now,
      source_id: sourceId,
      source_name: sourceName,
    }));

    console.log(`Upserting ${adsToUpsert.length} ads...`);

    // Upsert ads
    const { error: upsertError } = await supabase
      .from('ad_listings_cache')
      .upsert(adsToUpsert, {
        onConflict: 'ad_url',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
      throw upsertError;
    }

    // Mark ads from this source as inactive if not in current scrape
    const currentUrls = products.map(p => p.ad_url);
    if (sourceId && currentUrls.length > 0) {
      const { error: deactivateError } = await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('source_id', sourceId)
        .eq('is_active', true)
        .not('ad_url', 'in', `(${currentUrls.map(u => `"${u}"`).join(',')})`);

      if (deactivateError) {
        console.error('Deactivate error:', deactivateError);
      }
    }

    // Run mini-batch AI categorization on "other" ads from this source
    // This ensures continuous backlog reduction without timeouts
    const MINI_BATCH_SIZE = 30;
    const MINI_BATCH_DELAY_MS = 200;
    let aiUpdated = 0;

    console.log(`Running mini-batch AI categorization on up to ${MINI_BATCH_SIZE} "other" ads...`);

    const { data: otherAds } = await supabase
      .from('ad_listings_cache')
      .select('id, title, image_url')
      .eq('source_id', sourceId)
      .eq('category', 'other')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(MINI_BATCH_SIZE);

    if (otherAds && otherAds.length > 0) {
      for (const ad of otherAds) {
        const aiCategory = await categorizeWithAI(supabaseUrl, ad.title, ad.image_url);
        if (aiCategory && aiCategory !== 'other') {
          const { error: updateErr } = await supabase
            .from('ad_listings_cache')
            .update({ category: aiCategory })
            .eq('id', ad.id);

          if (!updateErr) {
            aiUpdated++;
            console.log(`Mini-batch AI: "${ad.title.substring(0, 30)}..." -> ${aiCategory}`);
          }
        }
        await delay(MINI_BATCH_DELAY_MS);
      }
    }

    console.log(`Mini-batch AI updated ${aiUpdated} of ${otherAds?.length || 0} "other" ads`);

    const result = {
      success: true,
      ads_found: products.length,
      ads_new: adsToUpsert.length,
      ai_updated: aiUpdated,
      source_name: sourceName,
    };

    console.log('Scrape complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape Musikbörsen error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
