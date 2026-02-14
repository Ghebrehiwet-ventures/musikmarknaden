-- Contact form submissions (no public email needed on site)
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Allow service role (Edge Function) to insert; no public read
alter table public.contact_submissions enable row level security;

create policy "Service role can insert contact submissions"
  on public.contact_submissions for insert
  to service_role
  with check (true);

create policy "Service role can read contact submissions"
  on public.contact_submissions for select
  to service_role
  using (true);

-- Optional: authenticated admin could be allowed to select (if you add admin role later)
-- For now only service_role (Edge Function / dashboard) can read.
