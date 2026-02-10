import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use anon key for public access (sitemap should be publicly accessible)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get all active ads
    const { data: ads, error } = await supabase
      .from('ad_listings_cache')
      .select('ad_path, last_seen_at, category, source_name')
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(50000); // Google limit

    if (error) throw error;

    // Get all categories
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

    // Build sitemap XML
    const baseUrl = 'https://musikmarknaden.se'; // Update with your actual domain
    
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
      sitemap += `    <loc>${baseUrl}/category/${category}</loc>\n`;
      sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <changefreq>daily</changefreq>\n';
      sitemap += '    <priority>0.9</priority>\n';
      sitemap += '  </url>\n';
    }
    
    // All active ads
    for (const ad of ads || []) {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/ad/${ad.ad_path}</loc>\n`;
      const lastmod = ad.last_seen_at ? 
        new Date(ad.last_seen_at).toISOString().split('T')[0] : 
        new Date().toISOString().split('T')[0];
      sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += '    <priority>0.7</priority>\n';
      sitemap += '  </url>\n';
    }
    
    sitemap += '</urlset>';

    console.log(`Generated sitemap with ${(ads?.length || 0) + categories.length + 1} URLs`);

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });

  } catch (error) {
    console.error('Sitemap generation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
