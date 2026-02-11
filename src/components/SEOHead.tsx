import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  schema?: string;
  noindex?: boolean;
}

/**
 * SEO Head Component
 * Manages all meta tags, OpenGraph, Twitter Cards, and Schema.org markup
 * 
 * Usage:
 * <SEOHead 
 *   title="Fender Stratocaster - 8,500 kr | Musikmarknaden"
 *   description="Begagnad Fender Stratocaster till salu..."
 *   canonical="https://www.musikmarknaden.com/ad/123"
 *   schema={productSchemaJSON}
 * />
 */
export function SEOHead({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  ogUrl,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  twitterTitle,
  twitterDescription,
  twitterImage,
  schema,
  noindex = false,
}: SEOHeadProps) {
  const baseUrl = 'https://www.musikmarknaden.com';
  
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Robots */}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* OpenGraph (Facebook, LinkedIn, Slack, etc) */}
      <meta property="og:title" content={ogTitle || title} />
      <meta property="og:description" content={ogDescription || description} />
      <meta property="og:type" content={ogType} />
      {(ogUrl || canonical) && <meta property="og:url" content={ogUrl || canonical} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta property="og:site_name" content="Musikmarknaden" />
      <meta property="og:locale" content="sv_SE" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle || ogTitle || title} />
      <meta name="twitter:description" content={twitterDescription || ogDescription || description} />
      {(twitterImage || ogImage) && <meta name="twitter:image" content={twitterImage || ogImage} />}
      
      {/* Additional SEO Tags */}
      <meta name="language" content="Swedish" />
      <meta name="geo.region" content="SE" />
      <meta name="geo.placename" content="Sweden" />
      
      {/* Schema.org JSON-LD */}
      {schema && (
        <script type="application/ld+json">
          {schema}
        </script>
      )}
    </Helmet>
  );
}

/**
 * Default SEO Head for pages without specific SEO data
 */
export function DefaultSEOHead() {
  return (
    <SEOHead
      title="Musikmarknaden - Hitta Begagnad Musikutrustning i Sverige"
      description="Sveriges största aggregator för begagnad musikutrustning. Jämför priser från Blocket, Musikbörsen, Gearloop och fler. Uppdateras dagligen."
      canonical="https://www.musikmarknaden.com"
      ogImage="https://www.musikmarknaden.com/og-home.png"
    />
  );
}
