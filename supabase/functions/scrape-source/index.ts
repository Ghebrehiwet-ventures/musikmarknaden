import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedProduct {
  title: string;
  ad_url: string;
  price_text: string | null;
  price_amount: number | null;
  location: string;
  image_url: string;
  category: string;
  source_category?: string;
}

// Jam.se subcategories with their internal category mappings
const JAM_SUBCATEGORIES: Array<{ url: string; category: string; name: string }> = [
  { 
    url: 'https://www.jam.se/sv/produkter/begagnat/begagnat/?count=100', 
    category: 'synth-modular',
    name: 'Syntar, beg/vintage'
  },
  { 
    url: 'https://www.jam.se/sv/produkter/begagnat/beggatvintage/?count=100', 
    category: 'studio',
    name: 'Rackeffekter'
  },
  { 
    url: 'https://www.jam.se/sv/produkter/studio-och-inspelning/mickar/beggatvintage/?count=100', 
    category: 'studio',
    name: 'Mikrofoner, beg/vintage'
  },
  { 
    url: 'https://www.jam.se/sv/produkter/begagnat/begagnat-1/?count=100', 
    category: 'pedals-effects',
    name: 'Effektpedaler, begagnat/vintage'
  },
  { 
    url: 'https://www.jam.se/sv/produkter/begagnat/ovrigt-begvintage/?count=100', 
    category: 'other',
    name: 'Övrigt beg/vintage'
  },
];

function parsePrice(priceText: string): { text: string; amount: number | null } {
  const cleanText = priceText.replace(/\s+/g, ' ').trim();
  const match = cleanText.match(/(\d[\d\s]*)/);
  if (match) {
    const amount = parseInt(match[1].replace(/\s/g, ''), 10);
    return { text: cleanText, amount: isNaN(amount) ? null : amount };
  }
  return { text: cleanText, amount: null };
}

// Keyword-based categorization
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'instrument': [
    'gitarr', 'guitar', 'fender', 'gibson', 'ibanez', 'epiphone', 'schecter', 'stratocaster', 'telecaster', 'les paul',
    'prs', 'paul reed smith', 'g&l', 'music man', 'suhr', 'charvel', 'jackson', 'esp', 'ltd', 'squier',
    'gretsch', 'rickenbacker', 'taylor', 'martin', 'takamine', 'yamaha fg', 'yamaha c', 'cordoba', 'godin',
    'hagström', 'hagstrom', 'larrivee', 'collings', 'santa cruz', 'guild', 'ovation', 'breedlove',
    'bas', 'bass', 'precision', 'jazz bass', 'hofner', 'stingray', 'warwick', 'sandberg', 'spector', 'lakland',
    'trumm', 'drum', 'virvel', 'snare', 'cymbal', 'hi-hat', 'pearl', 'sonor', 'tama', 'dw', 'zildjian', 'sabian',
    'mapex', 'ludwig', 'paiste', 'meinl', 'istanbul', 'slagverk', 'percussion',
    'piano', 'flygel', 'rhodes', 'wurlitzer', 'clavinet', 'keyboard', 'tangent',
    'saxofon', 'trumpet', 'violin', 'cello', 'flöjt', 'klarinett', 'trombon',
    'ukulele', 'mandolin', 'banjo', 'dragspel', 'accordion', 'fiol', 'viola', 'kontrabas'
  ],
  'amplifiers': [
    'förstärkare', 'amp', 'combo', 'marshall', 'vox', 'mesa', 'boogie', 'mesa boogie',
    'peavey', 'engl', 'orange', 'blackstar', 'laney', 'ampeg', 'head', 'topteil',
    'cab', 'cabinet', 'speaker', 'högtalare', 'rörtop', 'tube amp', 'rörförstärkare',
    'fender amp', 'fender twin', 'fender deluxe', 'blues junior', 'hot rod',
    'soldano', 'bogner', 'friedman', 'diezel', 'hughes & kettner', 'randall',
    'markbass', 'hartke', 'gallien krueger', 'aguilar', 'eden',
    'kemper', 'line 6', 'helix', 'fractal', 'axe-fx', 'neural dsp', 'quad cortex'
  ],
  'pedals-effects': [
    'pedal', 'effekt', 'effect', 'drive', 'overdrive', 'distortion', 'fuzz', 'effektpedal',
    'delay', 'reverb', 'echo', 'chorus', 'flanger', 'phaser', 'wah', 'tremolo',
    'boss', 'mxr', 'electro-harmonix', 'ehx', 'strymon', 'eventide', 'tc electronic',
    'walrus', 'jhs', 'keeley', 'tube screamer', 'big muff', 'looper', 'multieffekt',
    'fulltone', 'earthquaker', 'chase bliss', 'meris', 'source audio',
    'dunlop', 'cry baby', 'klon', 'tuner pedal', 'noise gate', 'compressor pedal', 'booster'
  ],
  'synth-modular': [
    'synth', 'synthesizer', 'moog', 'korg', 'roland', 'yamaha dx', 'prophet', 'juno', 'jupiter',
    'eurorack', 'modular', 'sequencer', 'arturia', 'nord', 'access virus', 'dave smith', 'sequential',
    'minilogue', 'monologue', 'microkorg', 'minimoog', 'op-1', 'teenage engineering',
    'sampler', 'mpc', 'maschine', 'elektron', 'octatrack', 'digitakt', 'digitone',
    'analogsynt', 'polysynth', 'monosynth', 'oberheim', 'waldorf', 'hydrasynth',
    'nord stage', 'nord electro', 'nord lead'
  ],
  'studio': [
    'mikrofon', 'microphone', 'neumann', 'shure', 'sennheiser', 'akg', 'rode', 'audio-technica',
    'interface', 'ljudkort', 'audio interface', 'preamp', 'kompressor', 'compressor',
    'eq', 'equalizer', 'mixer', 'mackie', 'mixerbord',
    'monitor', 'studiomonitor', 'focusrite', 'universal audio', 'uad', 'api', 'neve', 'ssl',
    'scarlett', 'apollo', 'genelec', 'adam audio', 'yamaha hs', 'krk', 'jbl', 'dynaudio',
    'sm57', 'sm58', 'u87', 'c414', 'at2020', 'nt1', 'condensator', 'kondensator',
    'audient', 'motu', 'rme', 'apogee', 'steinberg', 'presonus', 'antelope',
    'outboard', 'channel strip', 'la-2a', '1176', 'dbx', 'distressor', 'patchbay', 'di-box'
  ],
  'dj-live': [
    'dj', 'turntable', 'skivspelare', 'cdj', 'controller', 'pioneer', 'technics', 'rane', 'serato', 'traktor',
    'pa', 'pa-system', 'line array', 'subwoofer', 'sub', 'aktiv högtalare', 'powered speaker',
    'ljus', 'lighting', 'dmx', 'moving head', 'laser', 'strobe', 'fog', 'haze',
    'denon dj', 'numark', 'allen & heath', 'xone', 'djm', 'ddj', 'rekordbox',
    'in-ear', 'iem', 'monitor system', 'stagebox', 'snake', 'splitter',
    'turbosound', 'rcf', 'qsc', 'electro-voice', 'jbl prx', 'jbl eon', 'yamaha dxr'
  ],
  'accessories-parts': [
    'case', 'väska', 'bag', 'gigbag', 'flightcase', 'hardcase', 'softcase',
    'stativ', 'stand', 'kabel', 'cable', 'sträng', 'string', 'plektrum', 'pick',
    'strap', 'rem', 'gitarrem', 'mikrofonstativ', 'pedalboard', 'pickups', 'pickup',
    'sadel', 'bridge', 'tuner', 'stämapparat', 'capo', 'slide',
    'dämpare', 'mute', 'cymbalställ', 'hi-hat stand', 'snare stand',
    'noter', 'notställ', 'metronom', 'strängvinda',
    'adapter', 'power supply', 'strömförsörjning', 'isolated power',
    'humbucker', 'single coil', 'p90', 'emg', 'seymour duncan', 'dimarzio'
  ]
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

const SHORT_KEYWORDS = new Set(['amp', 'bas', 'cab', 'dj', 'pa', 'eq', 'sub']);

function categorizeByKeywords(title: string): string {
  const decoded = decodeHtmlEntities(title);
  const titleLower = decoded.toLowerCase();
  
  for (const keyword of CATEGORY_KEYWORDS['instrument']) {
    const kw = keyword.toLowerCase();
    if (SHORT_KEYWORDS.has(kw)) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(titleLower)) return 'instrument';
    } else if (titleLower.includes(kw)) {
      return 'instrument';
    }
  }
  
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

// ============ SITE-SPECIFIC PARSERS ============

// Parse Musikbörsen HTML
function parseMusikborsen(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  const productMatches = html.matchAll(
    /<li[^>]*class="[^"]*secondhand-product-excerpt[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  );

  for (const match of productMatches) {
    const productHtml = match[1];
    
    const urlMatch = productHtml.match(/href="([^"]+)"/);
    const adUrl = urlMatch ? urlMatch[1] : '';
    
    const titleMatch = productHtml.match(/<h3[^>]*class="[^"]*heading[^"]*"[^>]*>(.*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    const priceMatch = productHtml.match(/<p[^>]*class="[^"]*price[^"]*"[^>]*>(.*?)<\/p>/i);
    const priceText = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const { text: priceTextClean, amount: priceAmount } = parsePrice(priceText);
    
    const storeMatch = productHtml.match(/<p[^>]*class="[^"]*store[^"]*"[^>]*>(.*?)<\/p>/i);
    const location = storeMatch ? storeMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    
    const imgMatch = productHtml.match(/(?:data-src|src)="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : '';
    
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
  
  return products;
}

// Parse Blocket from markdown (Firecrawl output)
// Markdown format:
// ![](https://images.blocketcdn.se/.../200/...)
// 
// 1 150 kr
// 
// ## [Produkttitel](https://www.blocket.se/annons/...)
// 
// Plats 9 min
function parseBlocketMarkdown(markdown: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Pattern to match: image, price line, title link, location/time
  // The structure from Blocket markdown:
  // ![](IMAGE_URL)
  // 
  // PRICE_TEXT
  // 
  // ## [TITLE](AD_URL)
  // 
  // LOCATION TIME
  const adPattern = /!\[\]\((https:\/\/images\.blocketcdn\.se[^)]+)\)\s*\n\s*\n\s*([^\n]+)\s*\n\s*\n\s*## \[([^\]]+)\]\(([^)]+)\)\s*\n\s*\n\s*([^\n]+)/g;
  
  let match;
  while ((match = adPattern.exec(markdown)) !== null) {
    const [, imageUrl, priceText, title, adUrl, locationTime] = match;
    
    // Parse price - can be "1 150 kr", "Bortskänkes", "Säljes", etc.
    const { text, amount } = parsePrice(priceText);
    
    // Extract location (remove time suffix like "9 min", "3 tim", "2 dagar")
    const location = locationTime
      .replace(/\d+\s*(min|tim|dagar?|sekunder?|månad(er)?|veckor?)\s*$/i, '')
      .trim();
    
    if (title && adUrl) {
      products.push({
        title: decodeHtmlEntities(title.trim()),
        ad_url: adUrl.startsWith('http') ? adUrl : `${baseUrl}${adUrl}`,
        price_text: text || null,
        price_amount: amount,
        location,
        image_url: imageUrl,
        category: categorizeByKeywords(title),
      });
    }
  }
  
  console.log(`Blocket markdown parser found ${products.length} products`);
  return products;
}

// Legacy HTML parser for Blocket (fallback)
function parseBlocket(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // HTML fallback for Blocket
  const adMatches = html.matchAll(/<article[^>]*class="[^"]*Item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi);
  for (const match of adMatches) {
    const adHtml = match[1];
    
    const urlMatch = adHtml.match(/href="([^"]+)"/);
    const titleMatch = adHtml.match(/<h2[^>]*>(.*?)<\/h2>/i) || adHtml.match(/title="([^"]+)"/);
    const priceMatch = adHtml.match(/(\d[\d\s]*)\s*kr/i);
    const imgMatch = adHtml.match(/src="([^"]+)"/);
    
    const title = titleMatch ? (titleMatch[1] || '').replace(/<[^>]+>/g, '').trim() : '';
    const adUrl = urlMatch ? urlMatch[1] : '';
    
    if (title && adUrl) {
      const { text, amount } = priceMatch ? parsePrice(priceMatch[0]) : { text: null, amount: null };
      products.push({
        title,
        ad_url: adUrl.startsWith('http') ? adUrl : `${baseUrl}${adUrl}`,
        price_text: text,
        price_amount: amount,
        location: '',
        image_url: imgMatch ? imgMatch[1] : '',
        category: categorizeByKeywords(title),
      });
    }
  }
  
  return products;
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
    lowUrl.includes('i.ytimg.com')
  );
}

// Parse DLX Music HTML
function parseDLXMusic(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // DLX uses <li class="product-list__item"> with data-item-id
  const productMatches = html.matchAll(
    /<li[^>]*class="[^"]*product-list__item[^"]*"[^>]*data-item-id="(\d+)"[^>]*>([\s\S]*?)<\/li>/gi
  );

  for (const match of productMatches) {
    const productHtml = match[2];
    
    // URL: <a href="https://www.dlxmusic.se/produkter/..." itemprop="url">
    const urlMatch = productHtml.match(/href="(https:\/\/www\.dlxmusic\.se\/produkter\/[^"]+)"/);
    
    // Titel: <h3 itemprop="name" class="product__name">Produktnamn</h3>
    const titleMatch = productHtml.match(/<h3[^>]*class="[^"]*product__name[^"]*"[^>]*>([^<]+)<\/h3>/i);
    
    // Pris: <div itemprop="price" content="995.00" class="price">
    const priceMatch = productHtml.match(/itemprop="price"\s+content="([\d.]+)"/);
    
    // Produktbild: <img src="..." class="product__image">
    const imgMatch = productHtml.match(/<img[^>]*class="[^"]*product__image[^"]*"[^>]*src="([^"]+)"/i) ||
                     productHtml.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*product__image[^"]*"/i);
    
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';
    const adUrl = urlMatch ? urlMatch[1] : '';
    const priceAmount = priceMatch ? parseFloat(priceMatch[1]) : null;
    
    // Filter out placeholder/badge images
    let imageUrl = imgMatch ? imgMatch[1] : '';
    if (isDlxPlaceholderImage(imageUrl)) {
      console.log(`DLX: Filtered badge image for "${title}": ${imageUrl}`);
      imageUrl = '';
    }
    
    if (title && adUrl) {
      products.push({
        title,
        ad_url: adUrl,
        price_text: priceAmount ? `${Math.round(priceAmount)} kr` : null,
        price_amount: priceAmount,
        location: 'Stockholm',
        image_url: imageUrl,
        category: categorizeByKeywords(title),
      });
    }
  }
  
  return products;
}

// Parse WooCommerce sites (Jam, Slagverket, Uppsala MV)
function parseWooCommerce(html: string, baseUrl: string, siteName: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // WooCommerce product patterns
  const productMatches = html.matchAll(
    /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  );

  for (const match of productMatches) {
    const productHtml = match[1];
    
    const urlMatch = productHtml.match(/href="([^"]+)"/);
    const titleMatch = productHtml.match(/<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>(.*?)<\/h2>/i) ||
                       productHtml.match(/<h2[^>]*>(.*?)<\/h2>/i) ||
                       productHtml.match(/title="([^"]+)"/);
    const priceMatch = productHtml.match(/<span[^>]*class="[^"]*amount[^"]*"[^>]*>(.*?)<\/span>/i) ||
                       productHtml.match(/(\d[\d\s,.]*)\s*(?:kr|SEK|:-)/i);
    const imgMatch = productHtml.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    
    const title = titleMatch ? (titleMatch[1] || '').replace(/<[^>]+>/g, '').trim() : '';
    let adUrl = urlMatch ? urlMatch[1] : '';
    
    if (title && adUrl) {
      if (!adUrl.startsWith('http')) {
        adUrl = baseUrl.replace(/\/$/, '') + (adUrl.startsWith('/') ? adUrl : '/' + adUrl);
      }
      
      let priceText = priceMatch ? priceMatch[1] || priceMatch[0] : '';
      priceText = priceText.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const { text, amount } = parsePrice(priceText);
      
      products.push({
        title,
        ad_url: adUrl,
        price_text: text || null,
        price_amount: amount,
        location: siteName,
        image_url: imgMatch ? imgMatch[1] : '',
        category: categorizeByKeywords(title),
      });
    }
  }
  
  return products;
}

// Parse Gear4Music HTML
function parseGear4Music(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Gear4Music uses <a class="g4m-grid-item product-card"> with data-g4m-inv attribute
  // Structure: <a href="URL" class="g4m-grid-item product-card">
  //   <h3 class="product-card-title">Title</h3>
  //   <div class="product-card-image-wrapper"><picture>...<img class="product-card-image" src="..."></picture></div>
  //   <div class="product-card-price">1 234 kr</div>
  // </a>
  
  const productMatches = html.matchAll(
    /<a[^>]*href="([^"]+)"[^>]*class="[^"]*product-card[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  );

  for (const match of productMatches) {
    const adUrl = match[1];
    const productHtml = match[2];
    
    // Title: <h3 class="product-card-title">Product Name</h3>
    const titleMatch = productHtml.match(/<h3[^>]*class="[^"]*product-card-title[^"]*"[^>]*>([^<]+)<\/h3>/i);
    
    // Price: <div class="product-card-price">1 234 kr</div>
    const priceMatch = productHtml.match(/<div[^>]*class="[^"]*product-card-price[^"]*"[^>]*>([\d\s]+)\s*kr<\/div>/i);
    
    // Image is inside <picture><source srcset="..."><img src="..." class="product-card-image"></picture>
    // Try to get the 215px version from srcset first (better quality)
    let imageUrl = '';
    
    // Look for srcset with 215w version (higher quality)
    const srcsetMatch = productHtml.match(/srcset="[^"]*?(https:\/\/r2\.gear4music\.com\/media\/[^"\s]+\/215\/preview\.jpg)/i);
    if (srcsetMatch) {
      imageUrl = srcsetMatch[1];
    }
    
    // Fallback to img src
    if (!imageUrl) {
      const imgMatch = productHtml.match(/<img[^>]*src="(https:\/\/r2\.gear4music\.com[^"]+)"/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }
    
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';
    
    if (title && adUrl) {
      const priceText = priceMatch ? priceMatch[1].trim() + ' kr' : null;
      const priceAmount = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : null;
      
      products.push({
        title,
        ad_url: adUrl.startsWith('http') ? adUrl : baseUrl.replace(/\/$/, '') + adUrl,
        price_text: priceText,
        price_amount: priceAmount,
        location: 'Gear4Music',
        image_url: imageUrl,
        category: categorizeByKeywords(title),
      });
    }
  }
  
  console.log(`Gear4Music parser found ${products.length} products`);
  return products;
}

// Parse Sefina Pantbank HTML
function parseSefina(html: string, baseUrl: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Sefina product cards
  const productMatches = html.matchAll(
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
  );

  for (const match of productMatches) {
    const productHtml = match[1];
    
    const urlMatch = productHtml.match(/href="([^"]+)"/);
    const titleMatch = productHtml.match(/<h[23][^>]*>(.*?)<\/h[23]>/i) ||
                       productHtml.match(/class="[^"]*title[^"]*"[^>]*>(.*?)</i);
    const priceMatch = productHtml.match(/(\d[\d\s,.]*)\s*(?:kr|SEK|:-)/i);
    const imgMatch = productHtml.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
    
    const title = titleMatch ? (titleMatch[1] || '').replace(/<[^>]+>/g, '').trim() : '';
    let adUrl = urlMatch ? urlMatch[1] : '';
    
    if (title && adUrl) {
      if (!adUrl.startsWith('http')) {
        adUrl = baseUrl.replace(/\/$/, '') + (adUrl.startsWith('/') ? adUrl : '/' + adUrl);
      }
      
      const { text, amount } = priceMatch ? parsePrice(priceMatch[0]) : { text: null, amount: null };
      products.push({
        title,
        ad_url: adUrl,
        price_text: text,
        price_amount: amount,
        location: 'Sefina Pantbank',
        image_url: imgMatch ? imgMatch[1] : '',
        category: categorizeByKeywords(title),
      });
    }
  }
  
  return products;
}

// Parse Abicart/TWS sites (Jam.se)
// Returns products with optional source_category for tracking
// Updated structure (2025): 
//   <div class="tws-list--list-item col-xs-12 ...">
//     <div class="grid-item">
//       <a href="..."><img src="https://cdn.abicart.com/..."></a>
//     </div>
//     <div class="product-list-item-info">
//       <p class="tws-util-heading--heading h5"><a href="URL">TITLE</a></p>
//       <div class="media-body">
//         <span class="tws-api--price-current">PRICE SEK</span>
//       </div>
//     </div>
//   </div>
function parseAbicart(html: string, baseUrl: string, siteName: string, sourceCategory?: string, forcedCategory?: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const seenUrls = new Set<string>();
  
  // Split by list-item class to get each product block
  const productBlocks = html.split(/(?=<div[^>]*class="[^"]*tws-list--list-item[^"]*")/gi);
  
  console.log(`Abicart: Found ${productBlocks.length - 1} potential product blocks`);
  
  for (const block of productBlocks) {
    if (!block.includes('tws-list--list-item')) continue;
    
    // Title and URL from heading link: <p class="tws-util-heading--heading h5"><a href="URL">TITLE</a></p>
    const headingMatch = block.match(/<p[^>]*class="[^"]*tws-util-heading--heading[^"]*"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    
    if (!headingMatch) {
      // Fallback: try to find any product link with .html extension
      const fallbackMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]+\/produkter\/[^"]+\.html)"[^>]*>([^<]+)<\/a>/i);
      if (!fallbackMatch) continue;
    }
    
    const adUrl = headingMatch ? headingMatch[1] : '';
    let title = headingMatch ? decodeHtmlEntities(headingMatch[2].trim()) : '';
    
    // Skip if no URL or already seen
    if (!adUrl || seenUrls.has(adUrl)) continue;
    seenUrls.add(adUrl);
    
    // Skip non-product links (payment logos, etc)
    if (title.toLowerCase().includes('brand logo') || 
        title.toLowerCase().includes('klarna') ||
        title.toLowerCase().includes('swish')) {
      continue;
    }
    
    // Clean title: remove ", beg" suffix that Jam.se adds to used products
    title = title.replace(/,\s*beg\.?$/i, '').trim();
    
    // Price: <span class="tws-api--price-current">1&nbsp;750&nbsp;SEK</span>
    const priceMatch = block.match(/<span[^>]*class="[^"]*tws-api--price-current[^"]*"[^>]*>([^<]+)<\/span>/i);
    
    // Image: Jam.se uses a custom "source" attribute on div.tws-react-img
    // Some products use /shop/images/... others use /shop/ws13/...
    // <div class="tws-img tws-react-img" source="https://cdn.abicart.com/shop/...">
    const imgMatch = block.match(/source="(https:\/\/cdn\.abicart\.com\/shop\/[^"]+)"/i) ||
                     block.match(/<img[^>]*src="(https:\/\/cdn\.abicart\.com\/shop\/[^"]+)"/i);
    
    if (title && adUrl) {
      // Clean price from &nbsp; entities
      const priceText = priceMatch ? decodeHtmlEntities(priceMatch[1].trim()) : null;
      const { text, amount } = priceText ? parsePrice(priceText) : { text: null, amount: null };
      
      products.push({
        title,
        ad_url: adUrl,
        price_text: text,
        price_amount: amount,
        location: siteName,
        image_url: imgMatch ? imgMatch[1] : '',
        category: forcedCategory || categorizeByKeywords(title),
        source_category: sourceCategory,
      });
    }
  }
  
  console.log(`Abicart parser found ${products.length} products for ${siteName}${sourceCategory ? ` (${sourceCategory})` : ''}`);
  return products;
}

// Generic markdown/HTML parser fallback
function parseGeneric(html: string, markdown: string, baseUrl: string, siteName: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  const seenUrls = new Set<string>();
  
  // Try to find product links in markdown
  const linkMatches = markdown.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of linkMatches) {
    const title = match[1].trim();
    let adUrl = match[2];
    
    // Skip navigation/menu links
    if (title.length < 5 || title.toLowerCase().includes('menu') || 
        title.toLowerCase().includes('cart') || title.toLowerCase().includes('login')) {
      continue;
    }
    
    if (!adUrl.startsWith('http')) {
      adUrl = baseUrl.replace(/\/$/, '') + (adUrl.startsWith('/') ? adUrl : '/' + adUrl);
    }
    
    if (seenUrls.has(adUrl)) continue;
    seenUrls.add(adUrl);
    
    // Try to find price near title in markdown
    const titleIndex = markdown.indexOf(title);
    const nearbyText = markdown.substring(titleIndex, titleIndex + 200);
    const priceMatch = nearbyText.match(/(\d[\d\s,.]*)\s*(?:kr|SEK|:-)/i);
    const { text, amount } = priceMatch ? parsePrice(priceMatch[0]) : { text: null, amount: null };
    
    products.push({
      title,
      ad_url: adUrl,
      price_text: text,
      price_amount: amount,
      location: siteName,
      image_url: '',
      category: categorizeByKeywords(title),
    });
  }
  
  // Also try HTML patterns
  const htmlProductPatterns = [
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<li[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  ];
  
  for (const pattern of htmlProductPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const productHtml = match[1];
      
      const urlMatch = productHtml.match(/href="([^"]+)"/);
      const titleMatch = productHtml.match(/<h[234][^>]*>(.*?)<\/h[234]>/i);
      const priceMatch = productHtml.match(/(\d[\d\s,.]*)\s*(?:kr|SEK|:-)/i);
      const imgMatch = productHtml.match(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
      
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      let adUrl = urlMatch ? urlMatch[1] : '';
      
      if (title && adUrl && title.length > 5) {
        if (!adUrl.startsWith('http')) {
          adUrl = baseUrl.replace(/\/$/, '') + (adUrl.startsWith('/') ? adUrl : '/' + adUrl);
        }
        
        if (seenUrls.has(adUrl)) continue;
        seenUrls.add(adUrl);
        
        const { text, amount } = priceMatch ? parsePrice(priceMatch[0]) : { text: null, amount: null };
        products.push({
          title,
          ad_url: adUrl,
          price_text: text,
          price_amount: amount,
          location: siteName,
          image_url: imgMatch ? imgMatch[1] : '',
          category: categorizeByKeywords(title),
        });
      }
    }
  }
  
  return products;
}

// Scrape a single page
async function scrapeSinglePage(
  firecrawlApiKey: string,
  pageUrl: string,
  baseUrl: string,
  sourceName: string,
  domain: string
): Promise<{ products: ScrapedProduct[]; html: string; markdown: string }> {
  const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pageUrl,
      formats: ['html', 'markdown'],
      waitFor: 3000,
    }),
  });

  if (!scrapeResponse.ok) {
    const error = await scrapeResponse.text();
    console.error(`Scrape failed for ${sourceName}:`, error);
    throw new Error(`Scrape failed: ${error}`);
  }

  const scrapeData = await scrapeResponse.json();
  const html = scrapeData.data?.html || scrapeData.html || '';
  const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
  
  let products: ScrapedProduct[] = [];
  
  if (domain.includes('musikborsen')) {
    products = parseMusikborsen(html, baseUrl);
  } else if (domain.includes('blocket')) {
    // Blocket: Use markdown parser (primary) with HTML fallback
    products = parseBlocketMarkdown(markdown, baseUrl);
    if (products.length === 0) {
      console.log('Blocket markdown parser found nothing, trying HTML fallback...');
      products = parseBlocket(html, baseUrl);
    }
  } else if (domain.includes('dlxmusic')) {
    products = parseDLXMusic(html, baseUrl);
  } else if (domain.includes('gear4music')) {
    products = parseGear4Music(html, baseUrl);
  } else if (domain.includes('sefina')) {
    products = parseSefina(html, baseUrl);
  } else if (domain.includes('jam.se')) {
    products = parseAbicart(html, baseUrl, sourceName);
  } else if (domain.includes('slagverket') || domain.includes('uppsalamusikverkstad')) {
    products = parseWooCommerce(html, baseUrl, sourceName);
  } else {
    console.log(`Using generic parser for ${sourceName}`);
    products = parseGeneric(html, markdown, baseUrl, sourceName);
  }
  
  return { products, html, markdown };
}

// Main scrape function that handles all sources with pagination support
// If previewLimit is set, stop after getting enough products (for preview mode)
async function scrapeSource(
  firecrawlApiKey: string, 
  scrapeUrl: string, 
  baseUrl: string, 
  sourceName: string,
  previewLimit?: number
): Promise<ScrapedProduct[]> {
  console.log(`Starting scrape for ${sourceName} from ${scrapeUrl}...`);
  if (previewLimit) {
    console.log(`PREVIEW MODE: Will stop after ${previewLimit} products`);
  }
  
  const domain = new URL(scrapeUrl).hostname.toLowerCase();
  const allProducts: ScrapedProduct[] = [];
  
  // DLX Music needs pagination
  if (domain.includes('dlxmusic')) {
    const maxPages = previewLimit ? 1 : 10; // Only 1 page in preview mode
    let page = 1;
    let pageUrl = scrapeUrl;
    
    while (page <= maxPages) {
      console.log(`Fetching DLX page ${page}: ${pageUrl}`);
      
      const { products, html } = await scrapeSinglePage(
        firecrawlApiKey, pageUrl, baseUrl, sourceName, domain
      );
      
      console.log(`Got ${products.length} products from page ${page}`);
      allProducts.push(...products);
      
      // In preview mode, stop if we have enough
      if (previewLimit && allProducts.length >= previewLimit) {
        console.log(`Preview: Got enough products (${allProducts.length}), stopping`);
        break;
      }
      
      // Check if there's a next page - look for page=N+1 in pagination links
      const nextPage = page + 1;
      const hasNextPage = html.includes(`page=${nextPage}`) || 
                          html.includes(`?page=${nextPage}`) ||
                          html.includes(`&amp;page=${nextPage}`);
      
      if (hasNextPage && products.length > 0) {
        const url = new URL(scrapeUrl);
        url.searchParams.set('page', String(nextPage));
        pageUrl = url.toString();
        page++;
      } else {
        console.log(`No more pages found after page ${page}`);
        break;
      }
    }
    
    console.log(`Total DLX products across ${page} pages: ${allProducts.length}`);
  } else if (domain.includes('gear4music')) {
    // Gear4Music needs pagination with ?page=N (not ?p=N!)
    const maxPages = previewLimit ? 1 : 20; // ~40 products per page, 500 total = ~13 pages, use 20 for safety
    let page = 1;
    let pageUrl = scrapeUrl;
    
    while (page <= maxPages) {
      console.log(`Gear4Music: Fetching page ${page}/${maxPages}: ${pageUrl}`);
      
      const { products, html } = await scrapeSinglePage(
        firecrawlApiKey, pageUrl, baseUrl, sourceName, domain
      );
      
      console.log(`Gear4Music: Page ${page} returned ${products.length} products, total so far: ${allProducts.length + products.length}`);
      allProducts.push(...products);
      
      // In preview mode, stop if we have enough
      if (previewLimit && allProducts.length >= previewLimit) {
        console.log(`Preview: Got enough products (${allProducts.length}), stopping`);
        break;
      }
      
      // Stop if we got no products (empty page)
      if (products.length === 0) {
        console.log(`Gear4Music: No products on page ${page}, stopping pagination`);
        break;
      }
      
      // Check if there's a next page - Gear4Music uses ?page=N
      const nextPage = page + 1;
      const hasNextPage = html.includes(`page=${nextPage}`) || 
                          html.includes(`?page=${nextPage}`) ||
                          products.length >= 35; // If we got a near-full page, likely more
      
      if (hasNextPage) {
        const url = new URL(scrapeUrl);
        url.searchParams.set('page', String(nextPage));
        pageUrl = url.toString();
        page++;
      } else {
        console.log(`Gear4Music: No more pages found after page ${page}`);
        break;
      }
    }
    
    console.log(`Gear4Music: Total products across ${page} pages: ${allProducts.length}`);
  } else if (domain.includes('blocket')) {
    // Blocket pagination: ?page=N, ~50 ads per page
    // Each page takes ~5 seconds, Edge Functions timeout at ~2 min
    // Use 15 pages max (~750 ads) to stay well under timeout
    const maxPages = previewLimit ? 1 : 15;
    const totalLimit = previewLimit || 1000;
    let page = 1;
    let pageUrl = scrapeUrl;
    
    while (allProducts.length < totalLimit && page <= maxPages) {
      console.log(`Blocket: Fetching page ${page}/${maxPages}: ${pageUrl}`);
      
      const { products, html, markdown } = await scrapeSinglePage(
        firecrawlApiKey, pageUrl, baseUrl, sourceName, domain
      );
      
      // Use markdown parser for Blocket
      let pageProducts = parseBlocketMarkdown(markdown, baseUrl);
      if (pageProducts.length === 0) {
        console.log('Blocket markdown parser found nothing, trying HTML fallback...');
        pageProducts = parseBlocket(html, baseUrl);
      }
      
      console.log(`Blocket: Page ${page} returned ${pageProducts.length} products, total so far: ${allProducts.length + pageProducts.length}`);
      
      // Stop if no products found (end of listings)
      if (pageProducts.length === 0) {
        console.log(`Blocket: No products on page ${page}, stopping pagination`);
        break;
      }
      
      allProducts.push(...pageProducts.slice(0, totalLimit - allProducts.length));
      
      // In preview mode, stop if we have enough
      if (previewLimit && allProducts.length >= previewLimit) {
        console.log(`Preview: Got enough products (${allProducts.length}), stopping`);
        break;
      }
      
      // Next page
      const nextPage = page + 1;
      const url = new URL(scrapeUrl);
      url.searchParams.set('page', String(nextPage));
      pageUrl = url.toString();
      page++;
    }
    
    console.log(`Blocket: Total products across ${page} pages: ${allProducts.length}`);
  } else if (domain.includes('jam.se')) {
    // Jam.se: Scrape all subcategories with pagination
    console.log(`Jam.se: Scraping ${JAM_SUBCATEGORIES.length} subcategories with pagination...`);
    
    for (const subcat of JAM_SUBCATEGORIES) {
      let page = 1;
      const maxPages = 50; // Safety limit
      let hasMorePages = true;
      
      while (hasMorePages && page <= maxPages) {
        // Jam.se uses ?page=N for pagination - URL already has ?count=100, so use &
        const pageUrl = page === 1 ? subcat.url : `${subcat.url}&page=${page}`;
        console.log(`Jam.se: Fetching "${subcat.name}" page ${page} from ${pageUrl}`);
        
        try {
          let html = '';

          // Direct fetch for Jam.se
          try {
            const directRes = await fetch(pageUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
              },
            });

            if (directRes.ok) {
              html = await directRes.text();
              console.log(`Jam.se: Direct fetch OK for "${subcat.name}" page ${page} (${html.length} chars)`);
            } else {
              console.log(`Jam.se: Direct fetch failed (HTTP ${directRes.status}), trying Firecrawl...`);
            }
          } catch (e) {
            console.log(`Jam.se: Direct fetch error, trying Firecrawl...`, e);
          }

          // Fallback to Firecrawl
          if (!html || html.length < 1000) {
            const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: pageUrl,
                formats: ['html'],
                onlyMainContent: false,
                waitFor: 3000,
              }),
            });

            if (scrapeResponse.ok) {
              const scrapeData = await scrapeResponse.json();
              html = scrapeData.data?.html || scrapeData.html || '';
            }
          }

          if (!html) {
            console.log(`Jam.se: No HTML for "${subcat.name}" page ${page}, stopping pagination`);
            break;
          }

          // Parse products from this page
          const pageProducts = parseAbicart(html, baseUrl, sourceName, subcat.name, subcat.category);
          console.log(`Jam.se: Got ${pageProducts.length} products from "${subcat.name}" page ${page}`);
          
          if (pageProducts.length === 0) {
            // No products on this page = end of pagination
            hasMorePages = false;
          } else {
            allProducts.push(...pageProducts);
            
            // Check for pagination indicator (e.g., "1/19" or next page link)
            // Look for pattern like "page=N" or pagination links
            const hasNextPageLink = html.includes(`page=${page + 1}`) || 
                                    html.includes(`?page=${page + 1}`) ||
                                    html.includes(`sida ${page + 1}`) ||
                                    (html.match(/(\d+)\s*\/\s*(\d+)/) && (() => {
                                      const match = html.match(/(\d+)\s*\/\s*(\d+)/);
                                      if (match) {
                                        const current = parseInt(match[1]);
                                        const total = parseInt(match[2]);
                                        return current < total;
                                      }
                                      return false;
                                    })());
            
            if (!hasNextPageLink) {
              console.log(`Jam.se: No next page indicator for "${subcat.name}", stopping at page ${page}`);
              hasMorePages = false;
            }
          }

          // In preview mode, stop early
          if (previewLimit && allProducts.length >= previewLimit) {
            console.log(`Jam.se Preview: Got enough products (${allProducts.length}), stopping`);
            hasMorePages = false;
            break;
          }

          page++;
        } catch (error) {
          console.error(`Jam.se: Error scraping ${subcat.name} page ${page}:`, error);
          hasMorePages = false;
        }
      }
      
      // Early exit from subcategory loop if preview limit reached
      if (previewLimit && allProducts.length >= previewLimit) {
        break;
      }
    }
    
    console.log(`Jam.se: Total products across all subcategories: ${allProducts.length}`);
  } else {
    // Single page scrape for other sources
    const { products, html, markdown } = await scrapeSinglePage(
      firecrawlApiKey, scrapeUrl, baseUrl, sourceName, domain
    );
    allProducts.push(...products);
    
    // If we got very few products (and not in preview mode), try generic parser as well
    if (!previewLimit && allProducts.length < 5) {
      console.log(`Only found ${allProducts.length} products with specific parser, trying generic...`);
      const genericProducts = parseGeneric(html, markdown, baseUrl, sourceName);
      
      const existingUrls = new Set(allProducts.map(p => p.ad_url));
      for (const p of genericProducts) {
        if (!existingUrls.has(p.ad_url)) {
          allProducts.push(p);
        }
      }
    }
  }
  
  // Deduplicate by URL
  const uniqueProducts = Array.from(
    new Map(allProducts.map(p => [p.ad_url, p])).values()
  );
  
  console.log(`Found ${uniqueProducts.length} unique products for ${sourceName}`);
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
    const previewMode = body.preview === true;
    const previewLimit = 5;

    if (!sourceId) {
      throw new Error('source_id is required');
    }

    // Get source details from database
    const { data: source, error: sourceError } = await supabase
      .from('scraping_sources')
      .select('id, name, scrape_url, base_url')
      .eq('id', sourceId)
      .single();

    if (sourceError || !source) {
      throw new Error(`Source not found: ${sourceId}`);
    }

    if (!source.scrape_url) {
      throw new Error(`No scrape_url configured for source: ${source.name}`);
    }

    console.log(`${previewMode ? 'PREVIEW' : 'Scraping'} source: ${source.name} (${source.id})`);
    console.log(`URL: ${source.scrape_url}`);
    console.log(`Base URL: ${source.base_url}`);

    // Get category mappings for this source
    const { data: mappings } = await supabase
      .from('category_mappings')
      .select('external_category, internal_category')
      .eq('source_id', sourceId);

    const categoryMap = new Map(
      (mappings || []).map(m => [m.external_category.toLowerCase(), m.internal_category])
    );

    // Scrape products using the configured URL
    let products = await scrapeSource(
      firecrawlApiKey, 
      source.scrape_url, 
      source.base_url || new URL(source.scrape_url).origin,
      source.name,
      previewMode ? previewLimit : undefined
    );

    // Apply category mappings
    products = products.map(p => ({
      ...p,
      category: categoryMap.get(p.category.toLowerCase()) || p.category,
    }));

    // PREVIEW MODE: Return products without saving
    if (previewMode) {
      const previewProducts = products.slice(0, previewLimit);
      console.log(`Preview complete for ${source.name}: returning ${previewProducts.length} products`);
      
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          source_name: source.name,
          products: previewProducts,
          total_found: products.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FULL SYNC: Prepare ads for upsert
    const now = new Date().toISOString();
    const adsToUpsert = products.map(product => ({
      ad_url: product.ad_url,
      ad_path: new URL(product.ad_url).pathname,
      title: product.title,
      price_text: product.price_text,
      price_amount: product.price_amount,
      location: product.location,
      image_url: product.image_url,
      category: product.category,
      source_category: product.source_category || null,
      date: now.split('T')[0],
      is_active: true,
      last_seen_at: now,
      source_id: sourceId,
      source_name: source.name,
    }));

    console.log(`Upserting ${adsToUpsert.length} ads for ${source.name}...`);

    // Upsert in batches
    const batchSize = 100;
    let upsertedCount = 0;
    let newCount = 0;

    for (let i = 0; i < adsToUpsert.length; i += batchSize) {
      const batch = adsToUpsert.slice(i, i + batchSize);
      
      // Check which URLs already exist
      const urls = batch.map(a => a.ad_url);
      const { data: existing } = await supabase
        .from('ad_listings_cache')
        .select('ad_url')
        .in('ad_url', urls);
      
      const existingUrls = new Set((existing || []).map(e => e.ad_url));
      const newInBatch = batch.filter(a => !existingUrls.has(a.ad_url)).length;
      newCount += newInBatch;
      
      const { error: upsertError } = await supabase
        .from('ad_listings_cache')
        .upsert(batch, { 
          onConflict: 'ad_url',
          ignoreDuplicates: false 
        });

      if (upsertError) {
        console.error(`Upsert error for batch ${i}:`, upsertError);
      } else {
        upsertedCount += batch.length;
      }
    }

    // Mark ads not seen in this scrape as inactive
    const scrapedUrls = products.map(p => p.ad_url);
    if (scrapedUrls.length > 0) {
      const { error: deactivateError } = await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('source_id', sourceId)
        .eq('is_active', true)
        .not('ad_url', 'in', `(${scrapedUrls.map(u => `"${u}"`).join(',')})`);

      if (deactivateError) {
        console.error('Error deactivating old ads:', deactivateError);
      }
    }

    console.log(`Scrape complete for ${source.name}: ${upsertedCount} ads upserted, ${newCount} new`);

    return new Response(
      JSON.stringify({
        success: true,
        source_name: source.name,
        ads_found: products.length,
        ads_new: newCount,
        ads_updated: upsertedCount - newCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Scrape source error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
