-- Create ad details cache table
CREATE TABLE public.ad_details_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  price_text TEXT,
  price_amount INTEGER,
  location TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  contact_info JSONB DEFAULT '{}'::jsonb,
  seller JSONB,
  condition TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_details_cache ENABLE ROW LEVEL SECURITY;

-- Public read access (no auth required)
CREATE POLICY "Anyone can read ad cache" 
ON public.ad_details_cache 
FOR SELECT 
USING (true);

-- Service role can insert/update (edge function uses service role)
CREATE POLICY "Service role can insert ad cache"
ON public.ad_details_cache
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service role can update ad cache"
ON public.ad_details_cache
FOR UPDATE
USING (true);

-- Index for faster lookups
CREATE INDEX idx_ad_details_cache_url ON public.ad_details_cache(ad_url);
CREATE INDEX idx_ad_details_cache_updated ON public.ad_details_cache(updated_at);