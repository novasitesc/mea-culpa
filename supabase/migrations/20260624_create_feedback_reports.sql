create table if not exists feedback_reports (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('bug', 'suggestion', 'comment')),
  title text not null,
  description text not null,
  page_url text,
  user_agent text,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved')),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists feedback_reports_type_idx on feedback_reports (type);
create index if not exists feedback_reports_status_idx on feedback_reports (status);
create index if not exists feedback_reports_created_at_idx on feedback_reports (created_at desc);

-- RLS: solo service role puede leer; cualquier visitante puede insertar
alter table feedback_reports enable row level security;

create policy "Allow anonymous inserts" on feedback_reports
  for insert
  with check (true);

create policy "Service role reads all" on feedback_reports
  for select
  using (auth.role() = 'service_role');
