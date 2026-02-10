/**
 * Sitemap Generator Route
 * Serves sitemap.xml at /sitemap.xml
 * 
 * Note: In production, you'd want this as a server-side route
 * or generated statically at build time
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Sitemap() {
  const { data: ads } = useQuery({
    queryKey: ['sitemap-ads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_listings_cache')
        .select('ad_path, last_seen_at, category')
        .eq('is_active', true)
        .limit(50000);
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!ads) return;

    const baseUrl = window.location.origin;
    const categories = [
      'guitars-bass',
      'drums-percussion',
      'keys-pianos',
      'synth-modular',
      'pedals-effects',
      'amplifiers',
      'studio',
      'dj-live',
      'wind-brass',
      'strings-other',
      'accessories-parts'
    ];

    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    // Homepage
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}/</loc>\n`;
    sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    sitemap += '    <changefreq>daily</changefreq>\n';
    sitemap += '    <priority>1.0</priority>\n';
    sitemap += '  </url>\n';
    
    // Category pages
    for (const category of categories) {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/?category=${category}</loc>\n`;
      sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <changefreq>daily</changefreq>\n';
      sitemap += '    <priority>0.9</priority>\n';
      sitemap += '  </url>\n';
    }
    
    // All ads
    for (const ad of ads) {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/ad/${encodeURIComponent(ad.ad_path || '')}</loc>\n`;
      const lastmod = ad.last_seen_at 
        ? new Date(ad.last_seen_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '    <priority>0.7</priority>\n';
      sitemap += '  </url>\n';
    }
    
    sitemap += '</urlset>';

    // Create blob and download
    const blob = new Blob([sitemap], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also log for copy-paste
    console.log('Sitemap generated with', ads.length + categories.length + 1, 'URLs');
    console.log('Copy this to public/sitemap.xml:');
    console.log(sitemap);

  }, [ads]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Sitemap Generator</h1>
        {!ads ? (
          <p className="text-muted-foreground">Genererar sitemap...</p>
        ) : (
          <div>
            <p className="text-green-600 mb-4">✅ Sitemap genererad!</p>
            <p className="text-sm text-muted-foreground">
              {ads.length} annonser + 11 kategorier + homepage
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Filen har laddats ned. Lägg den i public/sitemap.xml
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
