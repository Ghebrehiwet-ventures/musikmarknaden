import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch ad details using the firecrawl-ad-details function
async function fetchAdDetails(supabaseUrl: string, adUrl: string): Promise<{ description?: string } | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/firecrawl-ad-details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({ ad_url: adUrl }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch details for ${adUrl}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ad details for ${adUrl}:`, error);
    return null;
  }
}

// Process a batch of ads in parallel
async function processBatch(
  supabaseUrl: string,
  ads: Array<{ id: string; ad_url: string; title: string }>
): Promise<{ succeeded: number; failed: number }> {
  const results = await Promise.all(
    ads.map(async (ad) => {
      try {
        const details = await fetchAdDetails(supabaseUrl, ad.ad_url);
        
        if (details && details.description && details.description.length > 20) {
          console.log(`✓ ${ad.title.substring(0, 40)}... (${details.description.length} chars)`);
          return { success: true };
        } else {
          console.log(`✗ ${ad.title.substring(0, 40)}... (no/short description)`);
          return { success: false };
        }
      } catch (err) {
        console.error(`✗ Error: ${ad.ad_url}`, err);
        return { success: false };
      }
    })
  );

  return {
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    // Parse optional parameters
    let limit = 50;
    let batchSize = 10;
    
    try {
      const body = await req.json();
      if (body.limit) limit = Math.min(body.limit, 100); // Cap at 100
      if (body.batchSize) batchSize = Math.min(body.batchSize, 20); // Cap at 20
    } catch {
      // No body or invalid JSON - use defaults
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ads where description IS NULL, prioritizing newest first
    const { data: adsWithoutDesc, error } = await supabase
      .from('ad_listings_cache')
      .select('id, ad_url, title')
      .eq('is_active', true)
      .or('description.is.null,description.eq.')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch ads without descriptions:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!adsWithoutDesc || adsWithoutDesc.length === 0) {
      console.log('No ads missing descriptions - backfill complete!');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No ads missing descriptions',
          processed: 0, 
          succeeded: 0, 
          failed: 0,
          duration: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting parallel backfill: ${adsWithoutDesc.length} ads in batches of ${batchSize}`);
    
    let totalSucceeded = 0;
    let totalFailed = 0;

    // Process in parallel batches
    for (let i = 0; i < adsWithoutDesc.length; i += batchSize) {
      const batch = adsWithoutDesc.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(adsWithoutDesc.length / batchSize);
      
      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ads)...`);
      
      const result = await processBatch(supabaseUrl, batch);
      totalSucceeded += result.succeeded;
      totalFailed += result.failed;
      
      console.log(`Batch ${batchNum} complete: ${result.succeeded} succeeded, ${result.failed} failed`);
      
      // Small delay between batches to avoid overwhelming the API
      if (i + batchSize < adsWithoutDesc.length) {
        await delay(500);
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Get remaining count for progress tracking
    const { count: remainingCount } = await supabase
      .from('ad_listings_cache')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or('description.is.null,description.eq.');

    console.log(`Backfill complete in ${duration}s: ${totalSucceeded} succeeded, ${totalFailed} failed, ${remainingCount || 0} remaining`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: adsWithoutDesc.length,
        succeeded: totalSucceeded,
        failed: totalFailed,
        remaining: remainingCount || 0,
        duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Backfill error:', err);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
