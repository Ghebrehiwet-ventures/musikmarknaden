import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-export-secret",
};

const ALL_TABLES = [
  "scraping_sources",
  "category_mappings",
  "ad_listings_cache",
  "ad_details_cache",
  "sync_logs",
  "user_roles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security check - require secret header
    const exportSecret = Deno.env.get("EXPORT_SECRET");
    const providedSecret = req.headers.get("x-export-secret");

    if (!exportSecret || providedSecret !== exportSecret) {
      console.error("Unauthorized export attempt");
      return new Response(
        JSON.stringify({ error: "Unauthorized - invalid or missing x-export-secret header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check for single table export
    const url = new URL(req.url);
    const singleTable = url.searchParams.get("table");

    const tablesToExport = singleTable ? [singleTable] : ALL_TABLES;

    // Validate table name if single table requested
    if (singleTable && !ALL_TABLES.includes(singleTable)) {
      return new Response(
        JSON.stringify({ 
          error: `Invalid table: ${singleTable}`,
          available_tables: ALL_TABLES 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exportData: Record<string, unknown[]> = {};
    const stats: Record<string, number> = {};

    for (const table of tablesToExport) {
      const allRows: unknown[] = [];
      let offset = 0;
      const limit = 1000;

      console.log(`Starting export of ${table}...`);

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(offset, offset + limit - 1);

        if (error) {
          console.error(`Error fetching ${table}:`, error);
          throw new Error(`Failed to fetch ${table}: ${error.message}`);
        }

        if (!data || data.length === 0) break;

        allRows.push(...data);
        offset += limit;
        console.log(`${table}: fetched ${allRows.length} rows so far...`);

        if (data.length < limit) break;
      }

      exportData[table] = allRows;
      stats[table] = allRows.length;
      console.log(`Completed ${table}: ${allRows.length} total rows`);
    }

    const result = {
      exported_at: new Date().toISOString(),
      project_id: "vjifxhyypuporrbqgibt",
      export_type: singleTable ? "single_table" : "full",
      stats,
      data: exportData,
    };

    const filename = singleTable 
      ? `musikmarknaden-${singleTable}-export.json`
      : "musikmarknaden-full-export.json";

    return new Response(JSON.stringify(result, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
