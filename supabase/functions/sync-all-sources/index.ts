/**
 * Sync all active scraping sources. Intended to be called by pg_cron 3x daily.
 * Optional: set CRON_SECRET in Supabase secrets and pass in header x-cron-secret or body.secret.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret) {
      const headerSecret = req.headers.get('x-cron-secret');
      const body = await req.json().catch(() => ({}));
      const bodySecret = (body && typeof body === 'object' && body.secret) ? body.secret : null;
      if (headerSecret !== cronSecret && bodySecret !== cronSecret) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: sources, error: listError } = await adminClient
      .from('scraping_sources')
      .select('id, name, source_type, scrape_url')
      .eq('is_active', true)
      .order('name');

    if (listError) throw listError;
    if (!sources?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active sources', results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { source_id: string; name: string; success: boolean; error?: string }[] = [];
    const startTime = Date.now();

    for (const source of sources) {
      const sourceId = source.id;
      const sourceName = source.name || source.id;

      const isMusikborsen =
        (source.name || '').toLowerCase().includes('musikbörsen') ||
        (source.name || '').toLowerCase().includes('musikborsen') ||
        (source.scrape_url || '').toLowerCase().includes('musikborsen.se');

      if (source.source_type === 'parsebot' || source.source_type === 'firecrawl_crawl') {
        results.push({ source_id: sourceId, name: sourceName, success: false, error: 'Source type not supported' });
        continue;
      }

      const { data: syncLog, error: logError } = await adminClient
        .from('sync_logs')
        .insert({ source_id: sourceId, status: 'running' })
        .select('id')
        .single();

      if (logError) {
        results.push({ source_id: sourceId, name: sourceName, success: false, error: logError.message });
        continue;
      }

      try {
        const fnName = isMusikborsen ? 'scrape-musikborsen' : 'scrape-source';
        const { data: syncResult, error: invokeError } = await adminClient.functions.invoke(fnName, {
          body: { source_id: sourceId },
        });

        if (invokeError) {
          await adminClient
            .from('sync_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_message: invokeError.message,
            })
            .eq('id', syncLog.id);
          await adminClient
            .from('scraping_sources')
            .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'failed' })
            .eq('id', sourceId);
          results.push({ source_id: sourceId, name: sourceName, success: false, error: invokeError.message });
          continue;
        }

        const success = syncResult?.success === true;
        const metrics = {
          ads_found: syncResult?.ads_found ?? 0,
          ads_new: syncResult?.ads_new ?? 0,
          ads_updated: syncResult?.ads_updated ?? 0,
          total_ads_fetched: syncResult?.total_ads_fetched ?? null,
          valid_ads: syncResult?.valid_ads ?? null,
          invalid_ads: syncResult?.invalid_ads ?? null,
          invalid_ratio: syncResult?.invalid_ratio ?? null,
          image_ratio: syncResult?.image_ratio ?? null,
          abort_reason: syncResult?.abort_reason ?? null,
        };

        await adminClient
          .from('sync_logs')
          .update({
            status: success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            ads_found: metrics.ads_found,
            ads_new: metrics.ads_new,
            ads_updated: metrics.ads_updated,
            error_message: success ? null : (syncResult?.abort_reason || syncResult?.error || 'Sync failed'),
            ...metrics,
          })
          .eq('id', syncLog.id);

        await adminClient
          .from('scraping_sources')
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_status: success ? 'success' : 'failed',
            last_sync_count: success ? metrics.ads_found : undefined,
          })
          .eq('id', sourceId);

        results.push({ source_id: sourceId, name: sourceName, success });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await adminClient
          .from('sync_logs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: msg,
          })
          .eq('id', syncLog.id);
        await adminClient
          .from('scraping_sources')
          .update({ last_sync_at: new Date().toISOString(), last_sync_status: 'failed' })
          .eq('id', sourceId);
        results.push({ source_id: sourceId, name: sourceName, success: false, error: msg });
      }

      // Small delay between sources to reduce rate-limit risk
      await new Promise((r) => setTimeout(r, 2000));
    }

    const durationMs = Date.now() - startTime;
    const ok = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: failed === 0,
        duration_seconds: Math.round(durationMs / 1000),
        sources_ok: ok,
        sources_failed: failed,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('sync-all-sources error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
