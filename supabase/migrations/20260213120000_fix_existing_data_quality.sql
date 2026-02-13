-- Fix existing data quality issues for Blocket, Gear4Music, etc.
-- This migration cleans up data that was scraped before the scraper fixes.

-- 1. Fix Blocket locations: strip time suffixes like "1 dag", "3 tim", "9 min"
UPDATE ad_listings_cache
SET location = trim(regexp_replace(location, '\d+\s*(min|tim(mar?)?|dagar?|sekunder?|månad(er)?|veckor?)\s*(sedan)?\s*$', '', 'i'))
WHERE source_name ILIKE '%blocket%'
  AND location ~ '\d+\s*(min|tim|dagar?|sekunder?|dag)';

-- Also clean up trailing separators after the strip
UPDATE ad_listings_cache
SET location = trim(regexp_replace(location, '[·•\-]\s*$', ''))
WHERE source_name ILIKE '%blocket%'
  AND location ~ '[·•\-]\s*$';

-- 2. Fix Gear4Music locations: clear "Gear4Music" as location (it's not a real place)
UPDATE ad_listings_cache
SET location = ''
WHERE source_name ILIKE '%gear4music%'
  AND location = 'Gear4Music';

-- 3. Fix Gear4Music titles: strip "– Secondhand" / "- Secondhand" suffix
UPDATE ad_listings_cache
SET title = trim(regexp_replace(title, '\s*[–\-]\s*Secondhand\s*$', '', 'i'))
WHERE source_name ILIKE '%gear4music%'
  AND title ~* '\s*[–\-]\s*Secondhand\s*$';
