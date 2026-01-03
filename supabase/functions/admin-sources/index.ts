import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth header from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role using service role client
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const body = req.method !== 'GET' ? await req.json() : null;

    let result;

    switch (action) {
      case 'list':
        // List all sources with sync stats
        const { data: sources, error: listError } = await adminClient
          .from('scraping_sources')
          .select('*')
          .order('created_at', { ascending: false });

        if (listError) throw listError;
        
        // Get actual ad count per source from ad_listings_cache
        const { data: adCounts, error: countError } = await adminClient
          .from('ad_listings_cache')
          .select('source_id')
          .eq('is_active', true);
        
        // Count ads per source_id
        const countBySource: Record<string, number> = {};
        if (adCounts) {
          for (const ad of adCounts) {
            if (ad.source_id) {
              countBySource[ad.source_id] = (countBySource[ad.source_id] || 0) + 1;
            }
          }
        }
        
        // Merge actual counts into sources
        const sourcesWithCounts = sources?.map(source => ({
          ...source,
          ad_count: countBySource[source.id] || 0
        })) || [];
        
        result = { sources: sourcesWithCounts };
        break;

      case 'create':
        // Create a new source
        const { data: newSource, error: createError } = await adminClient
          .from('scraping_sources')
          .insert({
            name: body.name,
            base_url: body.base_url,
            scrape_url: body.scrape_url,
            source_type: body.source_type,
            is_active: body.is_active ?? true,
            config: body.config ?? {},
          })
          .select()
          .single();

        if (createError) throw createError;
        result = { source: newSource };
        break;

      case 'update':
        // Update a source
        const { data: updatedSource, error: updateError } = await adminClient
          .from('scraping_sources')
          .update({
            name: body.name,
            base_url: body.base_url,
            scrape_url: body.scrape_url,
            source_type: body.source_type,
            is_active: body.is_active,
            config: body.config,
          })
          .eq('id', body.id)
          .select()
          .single();

        if (updateError) throw updateError;
        result = { source: updatedSource };
        break;

      case 'delete':
        // Delete a source
        const { error: deleteError } = await adminClient
          .from('scraping_sources')
          .delete()
          .eq('id', body.id);

        if (deleteError) throw deleteError;
        result = { success: true };
        break;

      case 'toggle':
        // Toggle source active status
        const { data: toggledSource, error: toggleError } = await adminClient
          .from('scraping_sources')
          .update({ is_active: body.is_active })
          .eq('id', body.id)
          .select()
          .single();

        if (toggleError) throw toggleError;
        result = { source: toggledSource };
        break;

      case 'sync':
        // Trigger sync for a specific source
        const sourceId = body.source_id;
        
        // Create sync log entry
        const { data: syncLog, error: logError } = await adminClient
          .from('sync_logs')
          .insert({
            source_id: sourceId,
            status: 'running',
          })
          .select()
          .single();

        if (logError) throw logError;

        // Get source details
        const { data: sourceData, error: sourceError } = await adminClient
          .from('scraping_sources')
          .select('*')
          .eq('id', sourceId)
          .single();

        if (sourceError) throw sourceError;

        // Trigger the appropriate sync function based on source_type
        try {
          let syncResult;
          
          if (sourceData.source_type === 'firecrawl_list') {
            // Call scrape-musikborsen function
            const { data: scrapeData, error: scrapeError } = await adminClient.functions.invoke('scrape-musikborsen', {
              body: { source_id: sourceId }
            });
            
            if (scrapeError) throw scrapeError;
            syncResult = scrapeData;
          } else if (sourceData.source_type === 'parsebot') {
            // Call existing sync-ads function with source filter
            const { data: syncData, error: syncError } = await adminClient.functions.invoke('sync-ads', {
              body: { source_id: sourceId }
            });
            
            if (syncError) throw syncError;
            syncResult = syncData;
          }

          // Update sync log
          await adminClient
            .from('sync_logs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              ads_found: syncResult?.ads_found ?? 0,
              ads_new: syncResult?.ads_new ?? 0,
              ads_updated: syncResult?.ads_updated ?? 0,
            })
            .eq('id', syncLog.id);

          // Update source last sync info
          await adminClient
            .from('scraping_sources')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'success',
              last_sync_count: syncResult?.ads_found ?? 0,
            })
            .eq('id', sourceId);

          result = { success: true, sync_log_id: syncLog.id, ...syncResult };
        } catch (syncError) {
          // Update sync log with error
          await adminClient
            .from('sync_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: syncError instanceof Error ? syncError.message : String(syncError),
            })
            .eq('id', syncLog.id);

          // Update source last sync info
          await adminClient
            .from('scraping_sources')
            .update({
              last_sync_at: new Date().toISOString(),
              last_sync_status: 'failed',
            })
            .eq('id', sourceId);

          throw syncError;
        }
        break;

      case 'logs':
        // Get sync logs
        const { data: logs, error: logsError } = await adminClient
          .from('sync_logs')
          .select('*, scraping_sources(name)')
          .order('started_at', { ascending: false })
          .limit(100);

        if (logsError) throw logsError;
        result = { logs };
        break;

      case 'mappings':
        // Get category mappings for a source
        const { data: mappings, error: mappingsError } = await adminClient
          .from('category_mappings')
          .select('*')
          .eq('source_id', url.searchParams.get('source_id'))
          .order('external_category');

        if (mappingsError) throw mappingsError;
        result = { mappings };
        break;

      case 'save-mappings':
        // Save category mappings for a source
        const sourceIdForMappings = body.source_id;
        const mappingsToSave = body.mappings;

        // Delete existing mappings
        await adminClient
          .from('category_mappings')
          .delete()
          .eq('source_id', sourceIdForMappings);

        // Insert new mappings
        if (mappingsToSave && mappingsToSave.length > 0) {
          const { error: insertMappingsError } = await adminClient
            .from('category_mappings')
            .insert(
              mappingsToSave.map((m: any) => ({
                source_id: sourceIdForMappings,
                external_category: m.external_category,
                internal_category: m.internal_category,
              }))
            );

          if (insertMappingsError) throw insertMappingsError;
        }

        result = { success: true };
        break;

      case 'stats':
        // Get stats overview
        const { data: statsData } = await adminClient
          .from('ad_listings_cache')
          .select('source_name, is_active')
          .eq('is_active', true);

        const sourceCounts = (statsData || []).reduce((acc: Record<string, number>, row) => {
          const name = row.source_name || 'Unknown';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {});

        const { count: totalAds } = await adminClient
          .from('ad_listings_cache')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        result = {
          total_ads: totalAds || 0,
          by_source: sourceCounts,
        };
        break;

      case 'source-categories':
        // Get unique source_category values for a specific source
        const sourceIdForCategories = url.searchParams.get('source_id');
        if (!sourceIdForCategories) {
          return new Response(
            JSON.stringify({ error: 'source_id required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get all unique source_category values with counts
        const { data: categoryData, error: categoryError } = await adminClient
          .from('ad_listings_cache')
          .select('source_category')
          .eq('source_id', sourceIdForCategories)
          .eq('is_active', true)
          .not('source_category', 'is', null);

        if (categoryError) throw categoryError;

        // Count occurrences
        const categoryCounts = (categoryData || []).reduce((acc: Record<string, number>, row) => {
          const cat = row.source_category;
          if (cat) {
            acc[cat] = (acc[cat] || 0) + 1;
          }
          return acc;
        }, {});

        // Get existing mappings for this source
        const { data: existingMappings } = await adminClient
          .from('category_mappings')
          .select('external_category, internal_category')
          .eq('source_id', sourceIdForCategories);

        const mappedCategories = new Set((existingMappings || []).map(m => m.external_category.toLowerCase()));

        // Format response with mapped status
        const sourceCategories = Object.entries(categoryCounts)
          .map(([category, count]) => ({
            source_category: category,
            count,
            is_mapped: mappedCategories.has(category.toLowerCase()),
          }))
          .sort((a, b) => {
            // Unmapped first, then by count
            if (a.is_mapped !== b.is_mapped) return a.is_mapped ? 1 : -1;
            return b.count - a.count;
          });

        result = { categories: sourceCategories };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin sources error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
