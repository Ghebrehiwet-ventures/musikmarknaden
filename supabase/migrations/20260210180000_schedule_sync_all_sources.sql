-- Schedule sync-all-sources 3x daily (06:00, 12:00, 18:00 UTC)
-- This syncs ALL active sources (Blocket, Musikbörsen, Gearloop, etc.) – not just Gearloop.
-- Requires: sync-all-sources Edge Function deployed.

-- Remove old single-source nightly if you want to rely only on sync-all-sources
-- SELECT cron.unschedule('sync-all-ads-nightly');

-- Morning 06:00 UTC (07:00 CET)
SELECT cron.schedule(
  'sync-all-sources-morning',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ldspzlvcfhvcclmpwoha.supabase.co/functions/v1/sync-all-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3B6bHZjZmh2Y2NsbXB3b2hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTU1MywiZXhwIjoyMDgzNTY3NTUzfQ.t0Muzod3rDi8i4QEhCem095eJOIGFeaSJoEn_W8k9BM'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Noon 12:00 UTC (13:00 CET)
SELECT cron.schedule(
  'sync-all-sources-noon',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ldspzlvcfhvcclmpwoha.supabase.co/functions/v1/sync-all-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3B6bHZjZmh2Y2NsbXB3b2hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTU1MywiZXhwIjoyMDgzNTY3NTUzfQ.t0Muzod3rDi8i4QEhCem095eJOIGFeaSJoEn_W8k9BM'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Evening 18:00 UTC (19:00 CET)
SELECT cron.schedule(
  'sync-all-sources-evening',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ldspzlvcfhvcclmpwoha.supabase.co/functions/v1/sync-all-sources',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxkc3B6bHZjZmh2Y2NsbXB3b2hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Nzk5MTU1MywiZXhwIjoyMDgzNTY3NTUzfQ.t0Muzod3rDi8i4QEhCem095eJOIGFeaSJoEn_W8k9BM'
    ),
    body := '{}'::jsonb
  );
  $$
);
