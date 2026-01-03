-- Update ads that have source_name but missing source_id
UPDATE ad_listings_cache alc
SET source_id = ss.id
FROM scraping_sources ss
WHERE alc.source_id IS NULL
  AND alc.source_name IS NOT NULL
  AND LOWER(alc.source_name) = LOWER(ss.name);

-- Fix inconsistent source_name capitalization to match scraping_sources.name
UPDATE ad_listings_cache alc
SET source_name = ss.name
FROM scraping_sources ss
WHERE alc.source_id = ss.id
  AND alc.source_name IS DISTINCT FROM ss.name;