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

// Add delay to avoid rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50; // Process max 50 ads per batch
    const onlyCategory = body.category; // Optional: only recategorize specific category

    console.log(`Starting batch categorization (limit: ${limit})`);

    // Fetch ads to recategorize
    let query = supabase
      .from('ad_listings_cache')
      .select('id, title, image_url, category')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (onlyCategory) {
      query = query.eq('category', onlyCategory);
    }

    const { data: ads, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!ads || ads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No ads to categorize', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${ads.length} ads to categorize`);

    const results = {
      processed: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      changes: [] as Array<{ title: string; from: string; to: string; confidence: string }>,
    };

    for (const ad of ads) {
      results.processed++;
      
      const result = await categorizeAd(supabaseUrl, ad.title, ad.image_url);
      
      if (!result) {
        results.failed++;
        continue;
      }

      // Only update if category changed and confidence is not low
      if (result.category !== ad.category && result.confidence !== 'low') {
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

      // Rate limiting: wait 500ms between requests
      await delay(500);
    }

    console.log('Batch categorization complete:', results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
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
