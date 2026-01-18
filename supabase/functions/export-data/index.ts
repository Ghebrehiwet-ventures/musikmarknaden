import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const tables = [
      "scraping_sources",
      "category_mappings", 
      "ad_listings_cache",
      "ad_details_cache",
      "sync_logs",
      "user_roles",
    ];

    const exportData: Record<string, unknown[]> = {};
    const stats: Record<string, number> = {};

    for (const table of tables) {
      const allRows: unknown[] = [];
      let offset = 0;
      const limit = 1000;
      
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
        
        if (data.length < limit) break;
      }

      exportData[table] = allRows;
      stats[table] = allRows.length;
      console.log(`Exported ${table}: ${allRows.length} rows`);
    }

    const result = {
      exported_at: new Date().toISOString(),
      project_id: "vjifxhyypuporrbqgibt",
      stats,
      data: exportData,
    };

    return new Response(JSON.stringify(result, null, 2), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Content-Disposition": "attachment; filename=musikmarknaden-export.json"
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
