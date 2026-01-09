-- Add specifications column to store structured spec data
ALTER TABLE public.ad_details_cache 
ADD COLUMN specifications jsonb DEFAULT '[]'::jsonb;