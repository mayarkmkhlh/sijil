create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_json jsonb not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
