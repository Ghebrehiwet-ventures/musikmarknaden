/**
 * SEO Utilities for Musikmarknaden
 * Handles meta tags, Schema.org markup, and OpenGraph tags
 */

interface AdListing {
  title: string;
  price_text: string | null;
  price_amount: number | null;
  category: string;
  source_name: string | null;
  location: string;
  image_url: string;
  ad_url: string;
  ad_path: string;
  last_seen_at?: string;
  date?: string;
}

interface SEOMetaTags {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
}

/**
 * Generate SEO-optimized meta tags for an ad listing
 */
export function generateAdMetaTags(ad: AdListing, baseUrl: string = 'https://www.musikmarknaden.com'): SEOMetaTags {
  // Clean title (remove extra spaces, limit length)
  const cleanTitle = ad.title.trim().slice(0, 60);
  
  // Price string for description
  const priceStr = ad.price_amount 
    ? `${ad.price_amount.toLocaleString('sv-SE')} kr`
    : ad.price_text || 'Pris saknas';
  
  // Category display name
  const categoryName = getCategoryDisplayName(ad.category);
  
  // Meta title (important for SEO)
  const title = `${cleanTitle} - ${priceStr} | Musikmarknaden`;
  
  // Source name with fallback
  const sourceName = ad.source_name || 'Musikmarknaden';
  
  // Meta description
  const description = `${cleanTitle} till salu för ${priceStr}. ${categoryName} från ${sourceName}. ${ad.location ? `Plats: ${ad.location}.` : ''} Hitta begagnad musikutrustning på Musikmarknaden.`;
  
  // Canonical URL
  const canonical = `${baseUrl}/ad/${ad.ad_path}`;
  
  // OpenGraph tags (for Facebook, LinkedIn, Slack, etc)
  const ogTitle = cleanTitle;
  const ogDescription = `${priceStr} - ${categoryName} från ${sourceName}`;
  const ogImage = ad.image_url || `${baseUrl}/og-default.jpg`;
  
  return {
    title,
    description: description.slice(0, 160), // Google shows ~155-160 chars
    canonical,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl: canonical,
    ogType: 'product',
    twitterCard: 'summary_large_image',
    twitterTitle: ogTitle,
    twitterDescription: ogDescription,
    twitterImage: ogImage,
  };
}

/**
 * Generate Schema.org Product markup (for rich snippets)
 */
export function generateProductSchema(ad: AdListing, baseUrl: string = 'https://www.musikmarknaden.com') {
  const sourceName = ad.source_name || 'Musikmarknaden';
  const lastSeen = ad.last_seen_at || ad.date || new Date().toISOString();
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: ad.title,
    description: `${ad.title} från ${sourceName}`,
    image: ad.image_url || `${baseUrl}/default-product.jpg`,
    brand: {
      '@type': 'Brand',
      name: extractBrandFromTitle(ad.title),
    },
    category: getCategoryDisplayName(ad.category),
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/ad/${ad.ad_path}`,
      priceCurrency: 'SEK',
      price: ad.price_amount || 0,
      priceValidUntil: getExpirationDate(lastSeen),
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: sourceName,
      },
      itemCondition: 'https://schema.org/UsedCondition',
    },
  };
  
  return JSON.stringify(schema);
}

/**
 * Generate meta tags for category pages
 */
export function generateCategoryMetaTags(category: string, baseUrl: string = 'https://www.musikmarknaden.com'): SEOMetaTags {
  const displayName = getCategoryDisplayName(category);
  const title = `Begagnad ${displayName} - Köp & Sälj | Musikmarknaden`;
  const description = `Hitta begagnad ${displayName} till salu i Sverige. Jämför priser från alla marknadsplatser. ${displayName} från Blocket, Musikbörsen, Gearloop och fler. Uppdateras dagligen.`;
  const canonical = `${baseUrl}/category/${category}`;
  
  return {
    title,
    description,
    canonical,
    ogTitle: title,
    ogDescription: description,
    ogImage: `${baseUrl}/og-category-${category}.jpg`,
    ogUrl: canonical,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: `${baseUrl}/og-category-${category}.jpg`,
  };
}

/**
 * Generate meta tags for homepage
 */
export function generateHomeMetaTags(baseUrl: string = 'https://www.musikmarknaden.com'): SEOMetaTags {
  const title = 'Musikmarknaden - Hitta Begagnad Musikutrustning i Sverige';
  const description = 'Sveriges största aggregator för begagnad musikutrustning. Jämför priser från Blocket, Musikbörsen, Gearloop och fler. Hitta gitarrer, trummor, synthesizers, studio-utrustning och mer. Uppdateras 3 gånger dagligen.';
  
  return {
    title,
    description,
    canonical: baseUrl,
    ogTitle: title,
    ogDescription: description,
    ogImage: `${baseUrl}/og-home.jpg`,
    ogUrl: baseUrl,
    ogType: 'website',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: `${baseUrl}/og-home.jpg`,
  };
}

/**
 * Helper: Get display name for category
 */
function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    'guitars-bass': 'Gitarrer & Basar',
    'drums-percussion': 'Trummor & Slagverk',
    'keys-pianos': 'Keyboards & Pianon',
    'synth-modular': 'Synthesizers & Modulärt',
    'pedals-effects': 'Pedaler & Effekter',
    'amplifiers': 'Förstärkare',
    'studio': 'Studio-utrustning',
    'dj-live': 'DJ & Live-utrustning',
    'wind-brass': 'Blåsinstrument',
    'strings-other': 'Stränginstrument',
    'accessories-parts': 'Tillbehör & Delar',
    'other': 'Övrigt',
  };
  return names[category] || category;
}

/**
 * Helper: Extract brand name from title (basic heuristic)
 */
function extractBrandFromTitle(title: string): string {
  const commonBrands = [
    'Fender', 'Gibson', 'Ibanez', 'Yamaha', 'Roland', 'Korg', 'Moog',
    'Marshall', 'Vox', 'Orange', 'Boss', 'MXR', 'Strymon', 'Shure',
    'Neumann', 'Focusrite', 'Tama', 'Pearl', 'Zildjian', 'Sabian',
  ];
  
  const titleLower = title.toLowerCase();
  for (const brand of commonBrands) {
    if (titleLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // Fallback: first word of title (often brand name)
  return title.split(' ')[0];
}

/**
 * Helper: Get expiration date for price (7 days from last seen)
 */
function getExpirationDate(lastSeenAt: string): string {
  const date = new Date(lastSeenAt);
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

/**
 * Generate breadcrumb Schema.org markup
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{ name: string; url: string }>,
  baseUrl: string = 'https://www.musikmarknaden.com'
) {
  const itemListElement = breadcrumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: `${baseUrl}${crumb.url}`,
  }));
  
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  });
}
