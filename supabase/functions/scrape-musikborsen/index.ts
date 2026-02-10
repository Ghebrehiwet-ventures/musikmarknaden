import { createClient } from "npm:@supabase/supabase-js@2";

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

function parsePrice(priceText: string): { text: string; amount: number | null } {
  const cleanText = priceText.replace(/\s+/g, ' ').trim();
  const match = cleanText.match(/(\d[\d\.\s]*)/);
  if (match) {
    // Remove both dots (thousand separator) and spaces before parsing
    const amount = parseInt(match[1].replace(/[\.\s]/g, ''), 10);
    return { text: cleanText, amount: isNaN(amount) ? null : amount };
  }
  return { text: cleanText, amount: null };
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function toAbsoluteUrl(adUrl: string, baseUrl: string): string {
  try {
    if (!adUrl) return '';
    if (adUrl.startsWith('http://') || adUrl.startsWith('https://')) return adUrl;
    return new URL(adUrl, baseUrl).toString();
  } catch {
    return '';
  }
}

function isValidAdUrl(adUrl: string, baseUrl: string): boolean {
  try {
    if (!adUrl) return false;
    const url = new URL(adUrl);
    const base = new URL(baseUrl);
    return url.hostname === base.hostname;
  } catch {
    return false;
  }
}

function normalizeProduct(product: MusikborsenProduct, baseUrl: string): MusikborsenProduct | null {
  const title = normalizeText(product.title);
  const adUrl = toAbsoluteUrl(product.ad_url, baseUrl);
  const priceText = normalizeText(product.price_text || '');
  const imageUrl = normalizeText(product.image_url || '');
  const location = normalizeText(product.location || '');

  if (!title || title.length < 3) return null;
  if (!isValidAdUrl(adUrl, baseUrl)) return null;

  return {
    ...product,
    title,
    ad_url: adUrl,
    price_text: priceText || null,
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

function normalizeAndValidateProducts(
  products: MusikborsenProduct[],
  baseUrl: string,
  sourceName: string,
  qualityConfig?: ScrapeQualityConfig
): { products: MusikborsenProduct[]; report: QualityReport; abort_reason: string | null } {
  const config = { ...DEFAULT_QUALITY_CONFIG, ...(qualityConfig || {}) };
  const normalized: MusikborsenProduct[] = [];
  for (const product of products) {
    const cleaned = normalizeProduct(product, baseUrl);
    if (cleaned) normalized.push(cleaned);
  }

  const report: QualityReport = {
    total: products.length,
    valid: normalized.length,
    invalid: Math.max(0, products.length - normalized.length),
    invalid_ratio: products.length ? (products.length - normalized.length) / products.length : 1,
    image_ratio: normalized.length
      ? normalized.filter(p => p.image_url && p.image_url.length > 0).length / normalized.length
      : 0,
  };

  console.log(
    `Quality report for ${sourceName}: total=${report.total}, valid=${report.valid}, invalid=${report.invalid}, invalid_ratio=${report.invalid_ratio.toFixed(2)}, image_ratio=${report.image_ratio.toFixed(2)}`
  );

  const abortReason = getAbortReason(sourceName, report, config);
  return { products: normalized, report, abort_reason: abortReason };
}

// Keyword-based categorization matching internal categories
// PHASE 2 FIX: Split generic "instrument" into specific subcategories for better UX
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // NEW: Guitars & Bass (was part of "instrument", now specific)
  'guitars-bass': [
    // Electric guitars
    'gitarr', 'guitar', 'elgitarr', 'stratocaster', 'telecaster', 'les paul', 'sg', 'firebird',
    'fender', 'gibson', 'ibanez', 'epiphone', 'schecter', 'prs', 'paul reed smith', 'g&l',
    'music man', 'suhr', 'charvel', 'jackson', 'esp', 'ltd', 'squier', 'gretsch', 'rickenbacker',
    'hagström', 'hagstrom', 'godin', 'reverend', 'dean', 'bc rich', 'washburn', 'kramer',
    // Acoustic guitars
    'akustisk gitarr', 'acoustic', 'taylor', 'martin', 'takamine', 'yamaha fg', 'yamaha c',
    'cordoba', 'larrivee', 'collings', 'santa cruz', 'guild', 'ovation', 'breedlove', 'seagull',
    // Bass
    'bas', 'bass', 'elbas', 'precision', 'jazz bass', 'pbass', 'jbass', 'hofner', 'stingray',
    'warwick', 'sandberg', 'spector', 'lakland', 'dingwall', 'sadowsky', 'fodera', 'mayones',
    'marleaux', 'zon', 'esh', 'elrick', 'rickenbacker 4', 'musicman bass', 'sterling bass'
  ],
  // NEW: Drums & Percussion (was part of "instrument", now specific)
  'drums-percussion': [
    'trumm', 'drum', 'trumset', 'drumset', 'virvel', 'snare', 'cymbal', 'hi-hat', 'hihat',
    'pearl', 'sonor', 'tama', 'dw', 'drum workshop', 'zildjian', 'sabian', 'paiste', 'meinl',
    'mapex', 'gretsch drums', 'ludwig', 'yamaha drums', 'istanbul', 'bosphorus', 'ufip',
    'kick', 'bastrumma', 'bass drum', 'tom', 'floor tom', 'rack tom', 'ride', 'crash', 'splash',
    'china', 'slagverk', 'percussion', 'congas', 'bongos', 'cajon', 'djembe', 'shaker',
    'tambourine', 'cowbell', 'claves', 'guiro', 'maracas', 'agogo', 'cabasa'
  ],
  // NEW: Keys & Pianos (was part of "instrument", now specific - excludes synths)
  'keys-pianos': [
    'piano', 'pianino', 'flygel', 'grand piano', 'upright piano', 'digitalpiano', 'stagepiano',
    'el-piano', 'rhodes', 'wurlitzer', 'clavinet', 'keyboard', 'tangentinstrument', 'klaver',
    // Stage pianos (NOT synths - real piano sounds)
    'yamaha p', 'yamaha cp', 'roland fp', 'roland rd', 'kawai mp', 'casio px', 'casio privia',
    'korg sv', 'nord piano', 'yamaha clavinova', 'kawai ca', 'roland hp',
    // MIDI controllers (not synths - just keyboards)
    'midi keyboard', 'midiklaviatur', 'klaviatur', 'controller keyboard', 'novation launchkey',
    'arturia keylab', 'native instruments', 'akai mpk', 'alesis v', 'roland a-', 'korg microkey'
  ],
  // NEW: Wind & Brass (was part of "instrument", now specific)
  'wind-brass': [
    'saxofon', 'trumpet', 'trombon', 'klarinett', 'flöjt', 'oboe', 'fagott', 'valthorn',
    'tuba', 'euphonium', 'cornet', 'flugelhorn', 'piccolo', 'altflöjt', 'basklarinett',
    'sopransax', 'altsax', 'tenorsax', 'barytonsax', 'munspel', 'harmonica', 'melodica',
    'selmer', 'yamaha ytr', 'yamaha yts', 'bach', 'conn', 'king', 'buescher', 'keilwerth',
    'yanagisawa', 'cannonball', 'jupiter', 'pearl flute', 'muramatsu', 'burkart'
  ],
  // NEW: Strings & Other Instruments (was part of "instrument", now specific)
  'strings-other': [
    'violin', 'fiol', 'viola', 'cello', 'kontrabas', 'double bass', 'ukulele', 'uke',
    'mandolin', 'banjo', 'dragspel', 'accordion', 'dragspel', 'concertina', 'harp', 'harpa',
    'sitar', 'bouzouki', 'dulcimer', 'zither', 'autoharp', 'hurdy gurdy', 'vevlira',
    'stradivarius', 'stentor', 'yamaha silent', 'electric violin', 'ns design'
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
    // Single pedals
    'pedal', 'effekt', 'effect', 'drive', 'overdrive', 'distortion', 'fuzz', 'effektpedal', 'gitarrpedal',
    'delay', 'reverb', 'echo', 'chorus', 'flanger', 'phaser', 'wah', 'tremolo', 'vibrato',
    'boss', 'mxr', 'electro-harmonix', 'ehx', 'strymon', 'eventide', 'tc electronic',
    'walrus', 'jhs', 'keeley', 'ibanez ts', 'tube screamer', 'big muff', 'looper', 'multieffekt',
    'fulltone', 'analogman', 'earthquaker', 'eqd', 'chase bliss', 'meris', 'source audio',
    'way huge', 'dunlop', 'cry baby', 'klon', 'klone', 'timmy', 'blues breaker', 'rat', 'ds-1', 'bd-2',
    'tuner pedal', 'noise gate', 'compressor pedal', 'booster', 'boost pedal', 'preamp pedal',
    // Multi-effects & modelers (PHASE 3 FIX: was ending up in "other")
    'pod', 'line 6', 'line6', 'zoom', 'zoom ms', 'zoom g', 'helix', 'hx stomp', 'hx effects',
    'gt-1000', 'gt-100', 'gt-1', 'me-80', 'neural dsp', 'quad cortex', 'kemper', 'axe-fx', 'fractal',
    'mooer', 'nux', 'hotone', 'valeton', 'joyo', 'digitech', 'lexicon', 'yamaha magicstomp'
  ],
  'synth-modular': [
    // Synthesizers
    'synth', 'synthesizer', 'moog', 'korg', 'roland', 'yamaha dx', 'prophet', 'juno', 'jupiter',
    'eurorack', 'modular', 'sequencer', 'arturia', 'nord lead', 'nord wave', 'access virus',
    'dave smith', 'dsi', 'sequential', 'minilogue', 'monologue', 'microkorg', 'minmoog', 'minimoog',
    'op-1', 'op-z', 'teenage engineering', 'analogsynt', 'analog synth', 'polysynth', 'monosynth',
    'oberheim', 'arp', 'buchla', 'make noise', 'behringer synth', 'deepmind', 'model d', 'prologue',
    'rev2', 'peak', 'summit', 'hydrasynth', 'waldorf', 'blofeld', 'microfreak', 'grandmother',
    'matriarch', 'subsequent', 'sub 37', 'monomachine', 'rytm', 'analog four',
    // Vintage synths
    'rs-505', 'sh-101', 'jx-3p', 'jp-8000', 'jd-800', 'v-synth', 'd-50', 'dx7', 'sy77', 'cs-80',
    'tb-303', 'tr-808', 'tr-909', 'ms-20', 'arp 2600', 'minimoog model d',
    // Samplers & Grooveboxes (PHASE 3 FIX: was ending up in "other")
    'sampler', 'mpc', 'maschine', 'elektron', 'octatrack', 'digitakt', 'digitone', 'model:samples',
    'akai mpc', 'sp-404', 'sp-303', 'sp-1200', 'emu', 'emu sp', 'polyend', 'polyend tracker',
    // Drum machines (PHASE 3 FIX: was ending up in "other")
    'drum machine', 'trummaskin', 'groovebox', 'roland tr', 'alesis sr', 'alesis drum',
    'boss dr', 'korg volca', 'volca beats', 'volca drum', 'behringer rd', 'arturia drumbrute',
    'elektron analog rytm', 'roland mc', 'novation circuit', 'circuit rhythm'
  ],
  'studio': [
    // Microphones
    'mikrofon', 'microphone', 'mic', 'neumann', 'shure', 'sennheiser', 'akg', 'rode', 'audio-technica',
    'sm57', 'sm58', 'sm7b', 'u87', 'c414', 'at2020', 'nt1', 'tlm', 'condensator', 'kondensator',
    'dynamic mic', 'condenser', 'ribbon mic', 'røde', 'lewitt', 'se electronics',
    // Audio interfaces (PHASE 3 FIX: was ending up in "other")
    'interface', 'ljudkort', 'audio interface', 'focusrite', 'scarlett', 'clarett', 'universal audio',
    'uad', 'apollo', 'audient', 'motu', 'rme', 'apogee', 'steinberg ur', 'behringer umc',
    'presonus', 'antelope', 'ssl 2', 'native instruments komplete audio', 'm-audio', 'mackie onyx',
    'goxlr', 'tc-helicon', 'behringer u-phoria', 'arturia audiofuse', 'esi', 'roland rubix',
    // Preamps & Outboard
    'preamp', 'förförstärkare', 'kompressor', 'compressor', 'eq', 'equalizer',
    'channel strip', 'la-2a', '1176', 'dbx', 'distressor', 'avalon', 'manley', 'tube-tech',
    'api', 'neve', 'ssl', 'warm audio', 'black lion', 'grace design', 'millennia',
    // Monitors & Mixers
    'monitor', 'studiomonitor', 'genelec', 'adam audio', 'yamaha hs', 'krk', 'jbl', 'dynaudio',
    'focal', 'neumann kh', 'presonus eris', 'kali audio', 'iloud', 'eve audio',
    'mixer', 'mixerbord', 'mackie', 'mischpult', 'mixing desk', 'behringer x32', 'allen & heath',
    'soundcraft', 'yamaha mg', 'tascam', 'zoom livetrak',
    // Other studio gear
    'patchbay', 'di-box', 'di box', 'reamp', 'reamper', 'talkback', 'headphone amp',
    'monitor controller', 'big knob', 'dangerous music', 'spl', 'grace', 'benchmark'
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
  
  // PHASE 2 FIX: Priority order from most specific to least specific
  // Synths/pedals/studio checked FIRST (specific brands), instruments LAST (generic)
  
  const categoryPriority = [
    'synth-modular',      // 1. Synths first (Moog, Korg override generic "keyboard")
    'pedals-effects',     // 2. Pedals & multi-effects
    'studio',             // 3. Mics, interfaces, monitors
    'amplifiers',         // 4. Amps & cabs
    'dj-live',            // 5. DJ gear & PA systems
    'guitars-bass',       // 6. Guitars & bass (NEW - specific instrument type)
    'drums-percussion',   // 7. Drums & percussion (NEW - specific instrument type)
    'keys-pianos',        // 8. Keyboards & pianos (NEW - not synths, real pianos)
    'wind-brass',         // 9. Wind & brass instruments (NEW - specific)
    'strings-other',      // 10. Strings & other acoustic (NEW - specific)
    'accessories-parts',  // 11. Accessories last (catch-all for cables, cases, etc)
  ];
  
  for (const category of categoryPriority) {
    const keywords = CATEGORY_KEYWORDS[category];
    if (!keywords) continue;
    
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

// Fetch ad details using firecrawl-ad-details function (deterministic detail parser)
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

// Delay helper for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeMusikborsen(
  firecrawlApiKey: string,
  qualityConfig?: ScrapeQualityConfig
): Promise<{ products: MusikborsenProduct[]; report: QualityReport; abort_reason: string | null }> {
  console.log('Starting Musikbörsen scrape...');
  
  const products: MusikborsenProduct[] = [];
  const baseUrl = 'https://musikborsen.se/begagnat/';
  
  // NOTE: The listing page is sufficient for deterministic parsing.

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
  return normalizeAndValidateProducts(uniqueProducts, baseUrl, 'Musikborsen', qualityConfig);
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
    let sourceId = body.source_id || null;

    // Get source details - if no source_id provided, look up by name
    let sourceName = 'Musikbörsen';
    let sourceConfig: ScrapeQualityConfig | null = null;
    if (!sourceId) {
      const { data: source } = await supabase
        .from('scraping_sources')
        .select('id, name, config')
        .ilike('name', '%musikbörsen%')
        .maybeSingle();
      
      if (source) {
        sourceId = source.id;
        sourceName = source.name;
        sourceConfig = (source.config || {}) as ScrapeQualityConfig;
        console.log(`Found source: ${sourceName} (${sourceId})`);
      } else {
        // Try without special character
        const { data: source2 } = await supabase
          .from('scraping_sources')
          .select('id, name, config')
          .ilike('name', '%musikborsen%')
          .maybeSingle();
        
        if (source2) {
          sourceId = source2.id;
          sourceName = source2.name;
          sourceConfig = (source2.config || {}) as ScrapeQualityConfig;
          console.log(`Found source: ${sourceName} (${sourceId})`);
        } else {
          console.warn('No Musikbörsen source found in scraping_sources table');
        }
      }
    } else {
      const { data: source } = await supabase
        .from('scraping_sources')
        .select('name, config')
        .eq('id', sourceId)
        .maybeSingle();
      
      if (source) {
        sourceName = source.name;
        sourceConfig = (source.config || {}) as ScrapeQualityConfig;
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
    const { products, report, abort_reason } = await scrapeMusikborsen(
      firecrawlApiKey,
      sourceConfig || undefined
    );

    if (abort_reason) {
      return new Response(
        JSON.stringify({
          success: false,
          abort_reason,
          total_ads_fetched: report.total,
          valid_ads: report.valid,
          invalid_ads: report.invalid,
          invalid_ratio: report.invalid_ratio,
          image_ratio: report.image_ratio,
          source_name: sourceName,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Determine which ads are new (for detail preloading + accurate metrics)
    let existingUrlSet = new Set<string>();
    if (sourceId) {
      const { data: existingAds } = await supabase
        .from('ad_listings_cache')
        .select('ad_url')
        .eq('source_id', sourceId)
        .eq('is_active', true);
      existingUrlSet = new Set<string>((existingAds || []).map((a: any) => a.ad_url));
    }

    const newAdUrls = adsToUpsert
      .map(a => a.ad_url)
      .filter(url => !existingUrlSet.has(url));

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
    if (sourceId) {
      const { error: deactivateError } = await supabase
        .from('ad_listings_cache')
        .update({ is_active: false })
        .eq('source_id', sourceId)
        .eq('is_active', true)
        .lt('last_seen_at', now);

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

    // Preload details for a small batch of new ads (deterministic detail parser)
    const preloadLimit = (sourceConfig as any)?.preload_details_limit ?? 5;
    let detailsPreloaded = 0;
    let detailsFailed = 0;

    if (preloadLimit > 0 && newAdUrls.length > 0) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const toPreload = newAdUrls.slice(0, preloadLimit);
      console.log(`Preloading details for ${toPreload.length} new ads...`);

      for (const adUrl of toPreload) {
        const details = await fetchAdDetails(supabaseUrl, adUrl);
        if (details && details.title) {
          detailsPreloaded++;
        } else {
          detailsFailed++;
        }
        await delay(300);
      }

      console.log(`Detail preload complete: ${detailsPreloaded} ok, ${detailsFailed} failed`);
    }

    const result = {
      success: true,
      ads_found: products.length,
      ads_new: newAdUrls.length,
      ai_updated: aiUpdated,
      source_name: sourceName,
      total_ads_fetched: report.total,
      valid_ads: report.valid,
      invalid_ads: report.invalid,
      invalid_ratio: report.invalid_ratio,
      image_ratio: report.image_ratio,
      abort_reason,
      details_preloaded: detailsPreloaded,
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
