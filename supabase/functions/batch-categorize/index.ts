import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategorizeResponse {
  category: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
}

async function categorizeAd(
  supabaseUrl: string,
  title: string,
  imageUrl?: string
): Promise<CategorizeResponse | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/categorize-ad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        image_url: imageUrl,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to categorize "${title}": ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error categorizing "${title}":`, error);
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const TIME_BUDGET_MS = 110000; // 110 seconds (leave 10s buffer for cleanup)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 250); // Max 250 per batch
    const onlyCategory = body.category; // Optional: only recategorize specific category
    const sourceId = body.source_id; // Optional: filter by source
    const cursor = body.cursor; // Optional: pagination cursor (created_at timestamp)

    console.log(`Starting batch categorization (limit: ${limit}, category: ${onlyCategory || 'all'}, source: ${sourceId || 'all'}, cursor: ${cursor || 'none'})`);

    // Build query
    let query = supabase
      .from('ad_listings_cache')
      .select('id, title, image_url, category, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true }) // Ascending for deterministic cursor
      .limit(limit);

    // Filter by category
    if (onlyCategory) {
      query = query.eq('category', onlyCategory);
    }

    // Filter by source
    if (sourceId) {
      query = query.eq('source_id', sourceId);
    }

    // Apply cursor for pagination
    if (cursor) {
      query = query.gt('created_at', cursor);
    }

    const { data: ads, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!ads || ads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No ads to categorize', 
          processed: 0,
          next_cursor: null,
          completed: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${ads.length} ads to categorize`);

    const results = {
      processed: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      skipped_low_confidence: 0,
      skipped_still_other: 0,
      changes: [] as Array<{ title: string; from: string; to: string; confidence: string }>,
    };

    let lastProcessedCreatedAt: string | null = null;
    let stoppedEarly = false;

    for (const ad of ads) {
      // Check time budget
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        console.log('Time budget reached, stopping early');
        stoppedEarly = true;
        break;
      }

      results.processed++;
      lastProcessedCreatedAt = ad.created_at;
      
      const result = await categorizeAd(supabaseUrl, ad.title, ad.image_url);
      
      if (!result) {
        results.failed++;
        continue;
      }

      // Skip if confidence is low
      if (result.confidence === 'low') {
        results.skipped_low_confidence++;
        results.unchanged++;
        continue;
      }

      // Skip if AI also says "other" (no improvement)
      if (result.category === 'other') {
        results.skipped_still_other++;
        results.unchanged++;
        continue;
      }

      // Only update if category actually changed
      if (result.category !== ad.category) {
        const { error: updateError } = await supabase
          .from('ad_listings_cache')
          .update({ category: result.category })
          .eq('id', ad.id);

        if (updateError) {
          console.error(`Failed to update ad ${ad.id}:`, updateError);
          results.failed++;
        } else {
          results.updated++;
          results.changes.push({
            title: ad.title.substring(0, 50),
            from: ad.category,
            to: result.category,
            confidence: result.confidence,
          });
          console.log(`Updated "${ad.title.substring(0, 30)}...": ${ad.category} -> ${result.category}`);
        }
      } else {
        results.unchanged++;
      }

      // Rate limiting: 200ms between requests (adaptive)
      await delay(200);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`Batch categorization complete in ${elapsedMs}ms:`, results);

    // Determine if there are more ads to process
    const completed = !stoppedEarly && ads.length < limit;

    return new Response(
      JSON.stringify({ 
        success: true, 
        ...results,
        elapsed_ms: elapsedMs,
        next_cursor: completed ? null : lastProcessedCreatedAt,
        completed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Batch categorize error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
