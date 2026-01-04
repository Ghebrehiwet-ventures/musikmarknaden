import { supabase } from '@/integrations/supabase/client';

export interface ScrapingSource {
  id: string;
  name: string;
  base_url: string;
  scrape_url: string;
  source_type: 'parsebot' | 'firecrawl_list' | 'firecrawl_crawl';
  is_active: boolean;
  config: Record<string, unknown>;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_count: number;
  ad_count: number; // Actual count from database
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  source_id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  ads_found: number;
  ads_new: number;
  ads_updated: number;
  ads_removed: number;
  error_message: string | null;
  scraping_sources?: { name: string };
}

export interface CategoryMapping {
  id: string;
  source_id: string;
  external_category: string;
  internal_category: string;
}

export interface StatsOverview {
  total_ads: number;
  by_source: Record<string, number>;
}

export interface SourceCategoryInfo {
  source_category: string;
  count: number;
  is_mapped: boolean;
}

async function adminFetch<T>(action: string, body?: Record<string, unknown>, params?: Record<string, string>): Promise<T> {
  const queryParams = new URLSearchParams({ action, ...params });
  
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-sources?${queryParams}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body ?? {}),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const adminApi = {
  async getSources(): Promise<ScrapingSource[]> {
    const result = await adminFetch<{ sources: ScrapingSource[] }>('list');
    return result.sources;
  },

  async createSource(source: Partial<ScrapingSource>): Promise<ScrapingSource> {
    const result = await adminFetch<{ source: ScrapingSource }>('create', source);
    return result.source;
  },

  async updateSource(source: Partial<ScrapingSource> & { id: string }): Promise<ScrapingSource> {
    const result = await adminFetch<{ source: ScrapingSource }>('update', source);
    return result.source;
  },

  async deleteSource(id: string): Promise<void> {
    await adminFetch('delete', { id });
  },

  async toggleSource(id: string, is_active: boolean): Promise<ScrapingSource> {
    const result = await adminFetch<{ source: ScrapingSource }>('toggle', { id, is_active });
    return result.source;
  },

  async triggerSync(source_id: string): Promise<{ success: boolean; ads_found?: number; ads_new?: number }> {
    return adminFetch('sync', { source_id });
  },

  async previewSource(source_id: string): Promise<{ 
    success: boolean; 
    source_name: string;
    products: Array<{
      title: string;
      ad_url: string;
      price_text: string | null;
      price_amount: number | null;
      location: string;
      image_url: string;
      category: string;
    }>;
    total_found: number;
  }> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-source`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ source_id, preview: true }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    return response.json();
  },

  async runBatchCategorize(options: { 
    category?: string; 
    source_id?: string; 
    limit?: number;
    cursor?: string;
  }): Promise<{ 
    success: boolean; 
    processed: number; 
    updated: number; 
    unchanged: number;
    failed: number;
    skipped_low_confidence?: number;
    skipped_still_other?: number;
    elapsed_ms?: number;
    next_cursor: string | null;
    completed: boolean;
    changes?: Array<{ title: string; from: string; to: string; confidence: string }>;
  }> {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/batch-categorize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(options),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    return response.json();
  },

  async getSyncLogs(): Promise<SyncLog[]> {
    const result = await adminFetch<{ logs: SyncLog[] }>('logs');
    return result.logs;
  },

  async getCategoryMappings(source_id: string): Promise<CategoryMapping[]> {
    const result = await adminFetch<{ mappings: CategoryMapping[] }>('mappings', undefined, { source_id });
    return result.mappings;
  },

  async saveCategoryMappings(source_id: string, mappings: Array<{ external_category: string; internal_category: string }>): Promise<void> {
    await adminFetch('save-mappings', { source_id, mappings });
  },

  async getStats(): Promise<StatsOverview> {
    return adminFetch('stats');
  },

  async getSourceCategories(source_id: string): Promise<SourceCategoryInfo[]> {
    const result = await adminFetch<{ categories: SourceCategoryInfo[] }>('source-categories', undefined, { source_id });
    return result.categories;
  },
};
