import { createClient } from "npm:@supabase/supabase-js@2";

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

interface ScrapeQualityConfig {
  min_ads?: number;
  max_invalid_ratio?: number;
  min_image_ratio?: number;
  require_images?: boolean;
  allow_generic_fallback?: boolean;
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
  allow_generic_fallback: false,
};

// Jam.se URL path -> category mappings
// The product URL contains the actual category, e.g.:
// /begagnat/begagnat/ = Syntar (synth-modular)
// /begagnat/begagnat-1/ = Effektpedaler (pedals-effects)
// /effektpedaler/ = Effektpedaler (pedals-effects)
const JAM_URL_CATEGORY_MAP: Record<string, string> = {
  // Begagnat subcategories (URL path segment)
  'begagnat-1': 'pedals-effects',        // Effektpedaler, begagnat/vintage
  'forstarkare-begvintage': 'amplifiers', // Förstärkare, beg/vintage
  'pianon-keyboards-begvintage': 'instrument', // Pianon/Keyboards
  'tillbehor-begvintage': 'accessories-parts', // Tillbehör
  'ovrigt-begvintage': 'other',          // Övrigt
  'beggatvintage': 'studio',             // Rackeffekter
  'begagnat': 'synth-modular',           // Syntar (this is the default "/begagnat/begagnat/")
  
  // New (non-begagnat) categories
  'effektpedaler': 'pedals-effects',
  'synthanalogvintage': 'synth-modular',
  'synth': 'synth-modular',
  'digitalpianon': 'instrument',
  'usb-och-midi-keyboards': 'instrument',
  'studio-och-inspelning': 'studio',
  'mickar': 'studio',
  'live-dj-och-ljus': 'dj-live',
  'mjukvara': 'software-computers',
  'kablar-adaptrar': 'accessories-parts',
  'tillbehar': 'accessories-parts',
  'stativ': 'accessories-parts',
  'musikinstrument': 'instrument',
  'elgitarr': 'instrument',
  'gitarr': 'instrument',
};

// Extract category from Jam.se product URL
function getJamCategoryFromUrl(productUrl: string): string | null {
  try {
    const url = new URL(productUrl);
    const pathParts = url.pathname.split('/').filter(p => p && p !== 'sv' && p !== 'produkter');
    
    // Check each path segment for a category match, starting from most specific
    // e.g., /begagnat/begagnat-1/product.html -> check "begagnat-1" first (more specific)
    for (let i = pathParts.length - 2; i >= 0; i--) {
      const segment = pathParts[i].toLowerCase();
      if (JAM_URL_CATEGORY_MAP[segment]) {
        return JAM_URL_CATEGORY_MAP[segment];
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Jam.se subcategory URLs to scrape (we still need these for discovery)
const JAM_SUBCATEGORIES: Array<{ url: string; name: string }> = [
  { url: 'https://www.jam.se/sv/produkter/begagnat/begagnat/?count=100', name: 'Syntar, beg/vintage' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/beggatvintage/?count=100', name: 'Rackeffekter' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/begagnat-1/?count=100', name: 'Effektpedaler, begagnat/vintage' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/forstarkare-begvintage/?count=100', name: 'Förstärkare, beg/vintage' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/pianon-keyboards-begvintage/?count=100', name: 'Pianon/Keyboards, beg/vintage' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/tillbehor-begvintage/?count=100', name: 'Tillbehör, beg/vintage' },
  { url: 'https://www.jam.se/sv/produkter/begagnat/ovrigt-begvintage/?count=100', name: 'Övrigt beg/vintage' },
];

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

function isLikelyUiTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes('logga in') ||
    t.includes('kundvagn') ||
    t.includes('kassa') ||
    t.includes('konto') ||
    t.includes('meny') ||
    t.includes('sok') ||
    t.includes('cookies') ||
    t.includes('integritet') ||
    t.includes('villkor') ||
    t.includes('kontakta oss') ||
    t.includes('om oss')
  );
}

function toAbsoluteUrl(adUrl: string, baseUrl: string): string {
  try {
    if (!adUrl) return '';
    if (adUrl.startsWith('http://') || adUrl.startsWith('https://')) return adUrl;
    const base = new URL(baseUrl);
    return new URL(adUrl, base).toString();
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

function normalizeProduct(product: ScrapedProduct, baseUrl: string): ScrapedProduct | null {
  const title = normalizeText(product.title);
  const adUrl = toAbsoluteUrl(product.ad_url, baseUrl);
  const priceText = normalizeText(product.price_text || '');
  const imageUrl = normalizeText(product.image_url || '');
  const location = normalizeText(product.location || '');

  if (!title || title.length < 3 || isLikelyUiTitle(title)) return null;
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
  products: ScrapedProduct[],
  baseUrl: string,
  sourceName: string,
  config: Required<ScrapeQualityConfig>
): { products: ScrapedProduct[]; report: QualityReport; abort_reason: string | null } {
  const normalized: ScrapedProduct[] = [];
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

// Keyword-based categorization - expanded with product names that don't include brand
// PHASE 2 FIX: Split generic "instrument" into specific subcategories for better UX
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // NEW: Guitars & Bass (was part of "instrument", now specific)
  'guitars-bass': [
    // Electric guitars
    'gitarr', 'guitar', 'elgitarr', 'stratocaster', 'telecaster', 'les paul', 'sg', 'firebird',
    'fender', 'gibson', 'ibanez', 'epiphone', 'schecter', 'prs', 'paul reed smith', 'g&l',
    'music man', 'suhr', 'charvel', 'jackson', 'esp', 'ltd', 'squier', 'gretsch', 'rickenbacker',
    'hagström', 'hagstrom', 'godin', 'reverend', 'dean', 'bc rich', 'washburn', 'kramer',
    'aria pro', 'cort', 'evh', 'sterling',
    // Guitar model patterns
    'rg ', 'az ', 'sa ', 'sr ', 'btb', 'jem', 'gio ', 's520', 's570', 's670', 'rga', 'rgd', 'rgt',
    'jazzmaster', 'jaguar', 'mustang', 'duo-sonic', 'bronco', 'musicmaster',
    'sg ', 'sg-', 'flying v', 'explorer', 'firebird', 'es-', 'es1', 'es3',
    // Acoustic guitars
    'akustisk gitarr', 'acoustic', 'taylor', 'martin', 'takamine', 'yamaha fg', 'yamaha c',
    'cordoba', 'larrivee', 'collings', 'santa cruz', 'guild', 'ovation', 'breedlove', 'seagull',
    // Bass
    'bas', 'bass', 'elbas', 'precision', 'jazz bass', 'pbass', 'jbass', 'hofner', 'stingray',
    'warwick', 'sandberg', 'spector', 'lakland', 'dingwall', 'sadowsky', 'fodera', 'mayones',
    'marleaux', 'zon', 'esh', 'elrick', 'sire', 'rickenbacker 4', 'musicman bass', 'sterling bass'
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
    'el-piano', 'rhodes', 'wurlitzer', 'clavinet', 'keyboard', 'tangentinstrument', 'klaver', 'clavinova',
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
    'mandolin', 'banjo', 'dragspel', 'accordion', 'concertina', 'harp', 'harpa',
    'sitar', 'bouzouki', 'dulcimer', 'zither', 'autoharp', 'hurdy gurdy', 'vevlira',
    'stradivarius', 'stentor', 'yamaha silent', 'electric violin', 'ns design'
  ],
  'amplifiers': [
    'förstärkare', 'amp', 'combo', 'marshall', 'vox', 'mesa', 'boogie', 'mesa boogie',
    'peavey', 'engl', 'orange', 'blackstar', 'laney', 'ampeg', 'head', 'topteil',
    'cab', 'cabinet', 'speaker', 'högtalare', 'rörtop', 'tube amp', 'rörförstärkare',
    'fender amp', 'fender twin', 'fender deluxe', 'blues junior', 'hot rod',
    'soldano', 'bogner', 'friedman', 'diezel', 'hughes & kettner', 'randall',
    'markbass', 'hartke', 'gallien krueger', 'aguilar', 'eden',
    'kemper', 'line 6', 'helix', 'fractal', 'axe-fx', 'neural dsp', 'quad cortex',
    'victory', 'matchless', 'two rock', 'tone king', 'supro', 'egnater', 'bugera',
    'katana', 'mustang amp', 'champion', 'frontman', 'rumble', 'pathfinder'
  ],
  'pedals-effects': [
    'pedal', 'effekt', 'effect', 'drive', 'overdrive', 'distortion', 'fuzz', 'effektpedal',
    'delay', 'reverb', 'echo', 'chorus', 'flanger', 'phaser', 'wah', 'tremolo',
    'boss', 'mxr', 'electro-harmonix', 'ehx', 'strymon', 'eventide', 'tc electronic',
    'walrus', 'jhs', 'keeley', 'tube screamer', 'big muff', 'looper', 'multieffekt',
    'fulltone', 'earthquaker', 'chase bliss', 'meris', 'source audio',
    'dunlop', 'cry baby', 'klon', 'tuner pedal', 'noise gate', 'compressor pedal', 'booster',
    'timeline', 'bigsky', 'mobius', 'iridium', 'deco', 'el capistan', 'flint',
    'hx stomp', 'hx effects', 'pod go', 'gt-', 'me-', 'ms-', 'zoom ms',
    'rat', 'ds-1', 'bd-2', 'od-', 'dd-', 'rv-', 'ce-', 'bf-', 'ph-'
  ],
  'synth-modular': [
    // Brands
    'synth', 'synthesizer', 'moog', 'korg', 'roland', 'yamaha dx', 'prophet', 'juno', 'jupiter',
    'eurorack', 'modular', 'sequencer', 'arturia', 'nord', 'access virus', 'dave smith', 'sequential',
    'oberheim', 'waldorf', 'novation', 'behringer synth', 'asm', 'modal', 'dreadbox',
    // Popular synth product names (without brand in title)
    'minilogue', 'monologue', 'microkorg', 'minimoog', 'op-1', 'teenage engineering',
    'prologue', 'wavestate', 'modwave', 'opsix', 'volca', 'monologue', 'ms-20',
    'gaia', 'fa-06', 'fa-07', 'fa-08', 'fantom', 'jd-xi', 'jd-xa', 'system-8', 'jupiter-x', 'juno-x',
    'sh-4d', 'mc-101', 'mc-707', 'tr-8', 'tr-8s', 'tb-03', 'se-02', 'boutique',
    'sub 37', 'subsequent', 'grandmother', 'matriarch', 'one', 'voyager',
    'peak', 'summit', 'rev2', 'ob-6', 'prophet-5', 'prophet-6', 'take 5',
    'hydrasynth', 'argon8', 'cobalt8', 'sledge', 'blofeld', 'quantum', 'iridium synth',
    'sampler', 'mpc', 'maschine', 'elektron', 'octatrack', 'digitakt', 'digitone', 'syntakt',
    'analogsynt', 'polysynth', 'monosynth',
    'nord stage', 'nord electro', 'nord lead', 'nord wave', 'nord piano',
    'minifooger', 'mother-32', 'dfam', 'subharmonicon', 'werkstatt',
    'microfreak', 'minibrute', 'matrixbrute', 'polybrute', 'keylab', 'keystep'
  ],
  'studio': [
    // Mics & brands
    'mikrofon', 'microphone', 'neumann', 'shure', 'sennheiser', 'akg', 'rode', 'audio-technica',
    'sm57', 'sm58', 'sm7b', 'u87', 'c414', 'at2020', 'nt1', 'nt2', 'condensator', 'kondensator',
    'beta 52', 'beta 58', 'ksm', 'tlm', 'mk4', 'procaster', 'podmic', 'broadcaster',
    // Interfaces & brands
    'interface', 'ljudkort', 'audio interface', 'preamp', 'kompressor', 'compressor',
    'focusrite', 'universal audio', 'uad', 'api', 'neve', 'ssl',
    'audient', 'motu', 'rme', 'apogee', 'steinberg', 'presonus', 'antelope',
    // Popular interface product names
    'scarlett', 'clarett', 'saffire', 'apollo', 'twin', 'arrow', 'volt',
    'vocaster', 'id14', 'id22', 'id44', 'evo', 'audiobox', 'quantum', 
    'babyface', 'fireface', 'ultralite', 'duet', 'ensemble', 'element',
    'ur22', 'ur44', 'ur816', 'axr4',
    // Monitors
    'studiomonitor', 'genelec', 'adam audio', 'yamaha hs', 'krk', 'jbl lsr', 'dynaudio',
    'rokit', 'eris', 'a7x', 'a8x', 't5v', 't7v', 'hs5', 'hs7', 'hs8',
    // Outboard/Rack
    'eq', 'equalizer', 'mixer', 'mackie', 'mixerbord', 'monitor',
    'outboard', 'channel strip', 'la-2a', '1176', 'dbx', 'distressor', 'patchbay', 'di-box',
    'warm audio', 'golden age', 'heritage audio', 'empirical labs', 'rupert neve',
    // Other studio gear
    'midi', 'm-audio', 'arturia interface', 'native instruments',
    'headphone amp', 'monitor controller', 'talkback', 'studio desk'
  ],
  'dj-live': [
    'dj', 'turntable', 'skivspelare', 'cdj', 'controller', 'pioneer', 'technics', 'rane', 'serato', 'traktor',
    'pa', 'pa-system', 'line array', 'subwoofer', 'sub', 'aktiv högtalare', 'powered speaker',
    'ljus', 'lighting', 'dmx', 'moving head', 'laser', 'strobe', 'fog', 'haze',
    'denon dj', 'numark', 'allen & heath', 'xone', 'djm', 'ddj', 'rekordbox',
    'in-ear', 'iem', 'monitor system', 'stagebox', 'snake', 'splitter',
    'turbosound', 'rcf', 'qsc', 'electro-voice', 'jbl prx', 'jbl eon', 'yamaha dxr',
    // DJ product names
    'sl-1200', 'rp-7000', 'prime', 'sc5000', 'sc6000', 'x1800',
    'ddj-1000', 'ddj-400', 'ddj-flx', 'xdj-rx', 'xdj-xz',
    // PA product names
    'thump', 'srm', 'zlx', 'ekx', 'k12', 'k10', 'cf ', 'evox'
  ],
  'accessories-parts': [
    'case', 'väska', 'bag', 'gigbag', 'flightcase', 'hardcase', 'softcase',
    'stativ', 'stand', 'kabel', 'cable', 'sträng', 'string', 'plektrum', 'pick',
    'strap', 'rem', 'gitarrem', 'mikrofonstativ', 'pedalboard', 'pickups', 'pickup',
    'sadel', 'bridge', 'tuner', 'stämapparat', 'capo', 'slide',
    'dämpare', 'mute', 'cymbalställ', 'hi-hat stand', 'snare stand',
    'noter', 'notställ', 'metronom', 'strängvinda',
    'adapter', 'power supply', 'strömförsörjning', 'isolated power',
    'humbucker', 'single coil', 'p90', 'emg', 'seymour duncan', 'dimarzio',
    'mono case', 'gator case', 'skb case', 'hiscox', 'rockcase',
    'planet waves', "d'addario", 'ernie ball', 'elixir', 'dunlop strap'
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

// Check if an image URL is a WooCommerce placeholder/icon (flags, logos, etc.)
function isWooCommercePlaceholderImage(url: string): boolean {
  if (!url) return true;
  const lowUrl = url.toLowerCase();
  
  // Flag images (country flags for shipping/origin)
  if (lowUrl.includes('sveriges-flagga') || 
      lowUrl.includes('flag_of_') ||
      lowUrl.includes('/se.png') ||
      lowUrl.includes('/dk.png') ||
      lowUrl.includes('/no.png') ||
      lowUrl.includes('/fi.png') ||
      lowUrl.includes('flag-')) return true;
  
  // Common placeholders and icons
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
      lowUrl.includes('shipping')) return true;
  
  return false;
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
    
    // Find all images and pick the first non-placeholder one
    const imgMatches = productHtml.matchAll(/(?:data-src|src)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi);
    let imageUrl = '';
    for (const imgMatch of imgMatches) {
      const url = imgMatch[1];
      if (!isWooCommercePlaceholderImage(url)) {
        // Prefer wp-content/uploads images (actual product photos)
        if (url.includes('wp-content/uploads')) {
          imageUrl = url;
          break;
        }
        // Use first valid image if we haven't found one yet
        if (!imageUrl) {
          imageUrl = url;
        }
      }
    }
    
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
        image_url: imageUrl,
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
function parseAbicart(html: string, baseUrl: string, siteName: string, sourceCategory?: string): ScrapedProduct[] {
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
      
      // For Jam.se: Extract category from product URL (more accurate than subcategory we're scraping)
      // Falls back to keyword categorization if URL doesn't match known patterns
      const urlCategory = getJamCategoryFromUrl(adUrl);
      const category = urlCategory || categorizeByKeywords(title);
      
      // Normalize Jam.se image URL for listing thumbnails (store a decent size, not 128px)
      let imageUrl = imgMatch ? imgMatch[1] : '';
      if (imageUrl) {
        imageUrl = decodeHtmlEntities(imageUrl);

        // Strip size folders from Abicart paths: /art13/hXXXX/128/file -> /art13/hXXXX/file
        imageUrl = imageUrl.replace(/(\/art\d+\/h\d+)\/(?:128|256|512)\//i, '$1/');

        // If Jam provides max-width/max-height, request a larger variant for the listing grid
        // (Keep it lighter than detail view)
        if (/max-width=\d+/i.test(imageUrl)) {
          imageUrl = imageUrl
            .replace(/max-width=\d+/gi, 'max-width=720')
            .replace(/max-height=\d+/gi, 'max-height=720')
            .replace(/quality=\d+/gi, 'quality=80');
        }
      }
      
      products.push({
        title,
        ad_url: adUrl,
        price_text: text,
        price_amount: amount,
        location: siteName,
        image_url: imageUrl,
        category,
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
  previewLimit?: number,
  qualityConfig?: ScrapeQualityConfig
): Promise<{ products: ScrapedProduct[]; report: QualityReport; abort_reason: string | null }> {
  console.log(`Starting scrape for ${sourceName} from ${scrapeUrl}...`);
  if (previewLimit) {
    console.log(`PREVIEW MODE: Will stop after ${previewLimit} products`);
  }

  const config = { ...DEFAULT_QUALITY_CONFIG, ...(qualityConfig || {}) };
  const domain = new URL(scrapeUrl).hostname.toLowerCase();
  const allProducts: ScrapedProduct[] = [];
  const knownDomains = [
    'musikborsen',
    'blocket',
    'dlxmusic',
    'gear4music',
    'sefina',
    'jam.se',
    'slagverket',
    'uppsalamusikverkstad',
  ];

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
    // Limit to 5 pages per subcategory to avoid memory issues (most categories have <100 used items)
    console.log(`Jam.se: Scraping ${JAM_SUBCATEGORIES.length} subcategories with pagination...`);
    
    for (const subcat of JAM_SUBCATEGORIES) {
      let page = 1;
      const maxPages = previewLimit ? 1 : 5; // 5 pages max per subcategory = ~500 products max per cat
      let hasMorePages = true;
      const seenUrlsInSubcat = new Set<string>();
      let consecutiveDuplicates = 0;
      
      while (hasMorePages && page <= maxPages) {
        // Jam.se uses ?page=N for pagination - URL already has ?count=100, so use &
        const pageUrl = page === 1 ? subcat.url : `${subcat.url}&page=${page}`;
        console.log(`Jam.se: Fetching "${subcat.name}" page ${page}/${maxPages} from ${pageUrl}`);
        
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
              console.log(`Jam.se: Direct fetch failed (HTTP ${directRes.status}), skipping page`);
              hasMorePages = false;
              break;
            }
          } catch (e) {
            console.log(`Jam.se: Direct fetch error for "${subcat.name}" page ${page}:`, e);
            hasMorePages = false;
            break;
          }

          if (!html || html.length < 1000) {
            console.log(`Jam.se: Empty or too small HTML for "${subcat.name}" page ${page}, stopping`);
            break;
          }

          // Parse products from this page
          const pageProducts = parseAbicart(html, baseUrl, sourceName, subcat.name);
          console.log(`Jam.se: Got ${pageProducts.length} products from "${subcat.name}" page ${page}`);
          
          if (pageProducts.length === 0) {
            // No products on this page = end of pagination
            console.log(`Jam.se: No products found on page ${page}, stopping "${subcat.name}"`);
            hasMorePages = false;
          } else {
            // Check for duplicates - if all products are already seen, we're looping
            let newCount = 0;
            for (const p of pageProducts) {
              if (!seenUrlsInSubcat.has(p.ad_url)) {
                seenUrlsInSubcat.add(p.ad_url);
                allProducts.push(p);
                newCount++;
              }
            }
            
            console.log(`Jam.se: ${newCount} new products from "${subcat.name}" page ${page}`);
            
            if (newCount === 0) {
              consecutiveDuplicates++;
              if (consecutiveDuplicates >= 2) {
                console.log(`Jam.se: 2 pages with no new products, stopping "${subcat.name}"`);
                hasMorePages = false;
              }
            } else {
              consecutiveDuplicates = 0;
            }
            
            // Check for next page only if we got new products and haven't hit limit
            if (hasMorePages && page < maxPages) {
              // Simple check: if we got a full page of products, likely more exist
              // Jam.se uses count=100, so if we got <50 products, probably last page
              if (pageProducts.length < 50) {
                console.log(`Jam.se: Only ${pageProducts.length} products (likely last page), stopping "${subcat.name}"`);
                hasMorePages = false;
              }
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
      
      console.log(`Jam.se: Finished "${subcat.name}" with ${seenUrlsInSubcat.size} products`);
      
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
    const isKnown = knownDomains.some(d => domain.includes(d));
    if (!previewLimit && allProducts.length < 5 && (config.allow_generic_fallback || !isKnown)) {
      console.log(`Only found ${allProducts.length} products with specific parser, trying generic...`);
      const genericProducts = parseGeneric(html, markdown, baseUrl, sourceName);
      
      const existingUrls = new Set(allProducts.map(p => p.ad_url));
      for (const p of genericProducts) {
        if (!existingUrls.has(p.ad_url)) {
          allProducts.push(p);
        }
      }
    } else if (!previewLimit && allProducts.length < 5 && isKnown) {
      console.error(`Known source returned too few products (${allProducts.length}). Failing to avoid bad data.`);
      throw new Error(`Scrape failed: too few products for ${sourceName}`);
    }
  }
  
  // Deduplicate by URL - keep FIRST occurrence (preserves category from specific subcategory)
  const seenUrls = new Set<string>();
  const uniqueProducts = allProducts.filter(p => {
    if (seenUrls.has(p.ad_url)) return false;
    seenUrls.add(p.ad_url);
    return true;
  });
  
  console.log(`Found ${uniqueProducts.length} unique products for ${sourceName}`);
  return normalizeAndValidateProducts(uniqueProducts, baseUrl, sourceName, config);
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
    const qualityConfig = (source.config || {}) as ScrapeQualityConfig;
    const { products, report, abort_reason } = await scrapeSource(
      firecrawlApiKey, 
      source.scrape_url, 
      source.base_url || new URL(source.scrape_url).origin,
      source.name,
      previewMode ? previewLimit : undefined,
      qualityConfig
    );

    // Apply category mappings: use source_category first (what admin configures), then category
    const productsMapped = products.map(p => {
      const bySource = (p.source_category || '').trim().toLowerCase();
      const byCategory = (p.category || '').trim().toLowerCase();
      const mapped =
        (bySource && categoryMap.get(bySource)) ||
        (byCategory && categoryMap.get(byCategory)) ||
        p.category;
      return { ...p, category: mapped };
    });

    if (!previewMode && abort_reason) {
      return new Response(
        JSON.stringify({
          success: false,
          abort_reason,
          total_ads_fetched: report.total,
          valid_ads: report.valid,
          invalid_ads: report.invalid,
          invalid_ratio: report.invalid_ratio,
          image_ratio: report.image_ratio,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AI categorization for products that remain in "other" category
    // Only run in full sync mode (not preview) to save API calls
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!previewMode && lovableApiKey) {
      const otherProducts = productsMapped.filter(p => p.category === 'other');
      if (otherProducts.length > 0) {
        console.log(`AI categorization: ${otherProducts.length} products in 'other' category`);
        
        const AI_CATEGORIES = [
          { id: 'guitars-bass', label: 'Gitarrer & Basar', examples: 'Gitarrer, elgitarr, akustisk gitarr, bas, elbas' },
          { id: 'drums-percussion', label: 'Trummor & Slagverk', examples: 'Trummor, trumset, cymbaler, percussion' },
          { id: 'keys-pianos', label: 'Keyboards & Pianon', examples: 'Piano, keyboard, elpiano, klaviatur' },
          { id: 'wind-brass', label: 'Blåsinstrument', examples: 'Saxofon, trumpet, klarinett, flöjt, dragspel' },
          { id: 'strings-other', label: 'Stränginstrument', examples: 'Fiol, cello, ukulele, mandolin' },
          { id: 'amplifiers', label: 'Förstärkare', examples: 'Gitarr/basförstärkare, Kemper, Helix' },
          { id: 'pedals-effects', label: 'Pedaler & Effekter', examples: 'Overdrive, delay, reverb, looper' },
          { id: 'studio', label: 'Studio', examples: 'Mikrofoner, ljudkort/interface, monitorer, preamps' },
          { id: 'dj-live', label: 'DJ & Live', examples: 'DJ-controller, PA-system, ljusutrustning' },
          { id: 'synth-modular', label: 'Synth & Modulärt', examples: 'Synthesizers, Eurorack, samplers' },
          { id: 'software-computers', label: 'Mjukvara & Datorer', examples: 'DAW, plugins, datorer' },
          { id: 'accessories-parts', label: 'Tillbehör & Delar', examples: 'Kablar, case, strängar, pickups' },
          { id: 'services', label: 'Tjänster', examples: 'Lektioner, reparation, uthyrning' },
          { id: 'other', label: 'Övrigt', examples: 'Noter, memorabilia' },
        ];
        
        // Batch categorize in groups of 10 to reduce API calls
        const batchSize = 10;
        for (let i = 0; i < otherProducts.length; i += batchSize) {
          const batch = otherProducts.slice(i, i + batchSize);
          const titlesToCategorize = batch.map((p, idx) => `${idx + 1}. ${p.title}`).join('\n');
          
          try {
            const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lovableApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'google/gemini-2.5-flash-lite',
                messages: [
                  {
                    role: 'system',
                    content: `Du kategoriserar musikprylar. Svara ENDAST med ett JSON-objekt med format {"results": [{"index": 1, "category": "category_id"}, ...]}.

KATEGORIER:
${AI_CATEGORIES.map(c => `- ${c.id}: ${c.label} (${c.examples})`).join('\n')}

REGLER:
- Focusrite Vocaster = studio (audio interface)
- Roland GAIA = synth-modular
- Ibanez AZ/RG/S = guitars-bass (gitarr)
- Audio interface = studio
- Synthesizer = synth-modular
- Gitarr/bas/elgitarr/elbas = guitars-bass
- Trummor/cymbaler/slagverk = drums-percussion
- Piano/keyboard/elpiano = keys-pianos
- Saxofon/trumpet/klarinett/dragspel = wind-brass
- Fiol/cello/ukulele = strings-other`
                  },
                  {
                    role: 'user',
                    content: `Kategorisera dessa produkter:\n${titlesToCategorize}`
                  }
                ],
                temperature: 0.1,
              }),
            });
            
            if (response.ok) {
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content || '';
              
              // Parse JSON from response
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.results && Array.isArray(parsed.results)) {
                    for (const result of parsed.results) {
                      const idx = result.index - 1;
                      const category = result.category;
                      if (idx >= 0 && idx < batch.length && AI_CATEGORIES.some(c => c.id === category)) {
                        const product = batch[idx];
                        // Find and update in main products array
                        const mainIdx = productsMapped.findIndex(p => p.ad_url === product.ad_url);
                        if (mainIdx >= 0 && category !== 'other') {
                          console.log(`AI: "${product.title}" -> ${category}`);
                          productsMapped[mainIdx].category = category;
                        }
                      }
                    }
                  }
                } catch (parseErr) {
                  console.error('AI response parse error:', parseErr);
                }
              }
            } else {
              console.error('AI categorization failed:', response.status);
            }
          } catch (aiErr) {
            console.error('AI categorization error:', aiErr);
          }
          
          // Small delay between batches to avoid rate limiting
          if (i + batchSize < otherProducts.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        const remainingOther = productsMapped.filter(p => p.category === 'other').length;
        console.log(`AI categorization complete: ${otherProducts.length - remainingOther} products recategorized, ${remainingOther} remain in 'other'`);
      }
    }

    // PREVIEW MODE: Return products without saving
    if (previewMode) {
      const previewProducts = productsMapped.slice(0, previewLimit);
      console.log(`Preview complete for ${source.name}: returning ${previewProducts.length} products`);
      
      return new Response(
        JSON.stringify({
          success: true,
          preview: true,
          source_name: source.name,
          products: previewProducts,
          total_found: productsMapped.length,
          total_ads_fetched: report.total,
          valid_ads: report.valid,
          invalid_ads: report.invalid,
          invalid_ratio: report.invalid_ratio,
          image_ratio: report.image_ratio,
          abort_reason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FULL SYNC: Prepare ads for upsert
    const now = new Date().toISOString();
    const adsToUpsert = productsMapped.map(product => ({
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

    // Mark ads not seen in this scrape as inactive using last_seen_at (safer than NOT IN lists)
    const { error: deactivateError } = await supabase
      .from('ad_listings_cache')
      .update({ is_active: false })
      .eq('source_id', sourceId)
      .eq('is_active', true)
      .lt('last_seen_at', now);

    if (deactivateError) {
      console.error('Error deactivating old ads:', deactivateError);
    }

    console.log(`Scrape complete for ${source.name}: ${upsertedCount} ads upserted, ${newCount} new`);

    return new Response(
      JSON.stringify({
        success: true,
        source_name: source.name,
        ads_found: productsMapped.length,
        ads_new: newCount,
        ads_updated: upsertedCount - newCount,
        total_ads_fetched: report.total,
        valid_ads: report.valid,
        invalid_ads: report.invalid,
        invalid_ratio: report.invalid_ratio,
        image_ratio: report.image_ratio,
        abort_reason,
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
