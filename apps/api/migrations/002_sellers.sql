create table if not exists sellers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  shop_name text not null,
  extract_fields text[] not null default array[
    'customer_name',
    'delivery_city',
    'delivery_district',
    'delivery_address',
    'delivery_date',
    'payment_method',
    'item_qty',
    'item_price',
    'item_size',
    'item_colour'
  ],
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  seller_id uuid not null references sellers (id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers (id) on delete cascade,
  name text not null,
  aliases text[] not null default '{}',
  price numeric(12, 2) not null,
  image_bytes bytea,
  image_type text,
  created_at timestamptz not null default now()
);
