-- Add description column to ad_listings_cache
ALTER TABLE public.ad_listings_cache 
ADD COLUMN description text;