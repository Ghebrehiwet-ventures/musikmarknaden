ALTER TABLE public.sync_logs
ADD COLUMN total_ads_fetched INTEGER,
ADD COLUMN valid_ads INTEGER,
ADD COLUMN invalid_ads INTEGER,
ADD COLUMN invalid_ratio NUMERIC,
ADD COLUMN image_ratio NUMERIC,
ADD COLUMN abort_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_sync_logs_status_started_at ON public.sync_logs(status, started_at DESC);
