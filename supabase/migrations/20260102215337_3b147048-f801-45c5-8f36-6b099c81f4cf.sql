-- Lägg till source_category-kolumn för att lagra originalkatego från källan
ALTER TABLE ad_listings_cache 
ADD COLUMN source_category TEXT;

-- Index för snabbare lookup på source_category
CREATE INDEX idx_ad_listings_source_category 
ON ad_listings_cache(source_category);

-- Index för snabbare mappnings-lookup
CREATE INDEX idx_category_mappings_lookup 
ON category_mappings(source_id, external_category);