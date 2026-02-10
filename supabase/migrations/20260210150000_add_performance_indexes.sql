-- ============================================================================
-- PERFORMANCE OPTIMIZATION: Database Indexes
-- ============================================================================
-- Purpose: Speed up queries for SEO and user searches
-- Expected impact: 10-100x faster queries
-- ============================================================================

-- Index for category filtering (most common query)
CREATE INDEX IF NOT EXISTS idx_ad_listings_category_active 
ON ad_listings_cache(category, is_active) 
WHERE is_active = true;

-- Index for price range queries
CREATE INDEX IF NOT EXISTS idx_ad_listings_price_active 
ON ad_listings_cache(price_amount, is_active) 
WHERE is_active = true AND price_amount IS NOT NULL;

-- Index for source filtering
CREATE INDEX IF NOT EXISTS idx_ad_listings_source_active 
ON ad_listings_cache(source_name, is_active) 
WHERE is_active = true;

-- Index for sorting by last_seen_at (freshness)
CREATE INDEX IF NOT EXISTS idx_ad_listings_last_seen 
ON ad_listings_cache(last_seen_at DESC) 
WHERE is_active = true;

-- Composite index for category + price queries (common filter combination)
CREATE INDEX IF NOT EXISTS idx_ad_listings_category_price 
ON ad_listings_cache(category, price_amount, is_active) 
WHERE is_active = true AND price_amount IS NOT NULL;

-- Full-text search index on title (for search feature)
CREATE INDEX IF NOT EXISTS idx_ad_listings_title_search 
ON ad_listings_cache USING gin(to_tsvector('swedish', title));

-- Index for sitemap generation (ad_path lookup)
CREATE INDEX IF NOT EXISTS idx_ad_listings_ad_path 
ON ad_listings_cache(ad_path) 
WHERE is_active = true;

-- Index for admin sync logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_source_time 
ON sync_logs(source_id, started_at DESC);

-- ============================================================================
-- ANALYZE tables to update statistics (helps query planner)
-- ============================================================================
ANALYZE ad_listings_cache;
ANALYZE sync_logs;
ANALYZE scraping_sources;

-- ============================================================================
-- Verify indexes were created
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('ad_listings_cache', 'sync_logs')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
