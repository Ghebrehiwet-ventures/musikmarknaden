-- Create table for caching ad listings
CREATE TABLE public.ad_listings_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_url TEXT UNIQUE NOT NULL,
  ad_path TEXT,
  title TEXT NOT NULL,
  category TEXT,
  location TEXT,
  date TEXT,
  price_text TEXT,
  price_amount INTEGER,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for faster queries
CREATE INDEX idx_ad_listings_active ON public.ad_listings_cache(is_active);
CREATE INDEX idx_ad_listings_category ON public.ad_listings_cache(category);
CREATE INDEX idx_ad_listings_last_seen ON public.ad_listings_cache(last_seen_at);

-- Enable RLS (public read access for listings)
ALTER TABLE public.ad_listings_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Anyone can view active listings"
ON public.ad_listings_cache
FOR SELECT
USING (is_active = true);

-- Enable pg_net and pg_cron extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule nightly sync at 03:00 UTC
SELECT cron.schedule(
  'sync-all-ads-nightly',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vjifxhyypuporrbqgibt.supabase.co/functions/v1/sync-ads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqaWZ4aHl5cHVwb3JyYnFnaWJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4NzU3NDcsImV4cCI6MjA4MTQ1MTc0N30.qjrPwCxh4KpAxyC7AvCd9c_uGy-Y2uG1cTn6xEnckeU'
    ),
    body := '{}'::jsonb
  );
  $$
);