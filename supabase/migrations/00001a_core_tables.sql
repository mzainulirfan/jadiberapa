-- Fase skema inti (bagian 1/4): ekstensi, tabel bisnis, dan seed pengaturan.
-- Dipecah dari 00001_core.sql.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Categories
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  price_buy integer not null default 0,
  price_sell integer not null default 0,
  stock integer not null default 0,
  sku text,
  barcode text,
  image_url text,
  unit text not null default 'pcs',
  min_stock integer not null default 5,
  is_low_stock boolean generated always as (stock <= min_stock) stored,
  is_favorite boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

-- Product variants
create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sku text,
  price_buy integer not null default 0,
  price_sell integer not null default 0,
  created_at timestamptz not null default now()
);

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  total integer not null default 0,
  payment_method text default 'cash',
  customer_id uuid references customers(id) on delete set null,
  discount integer not null default 0,
  fee integer not null default 0,
  paid_amount integer not null default 0,
  status text not null default 'lunas' check (status in ('lunas', 'utang')),
  number text,
  share_token uuid not null default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  cashier_name text,
  created_at timestamptz default now()
);

-- Transaction items
create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  qty integer not null default 1,
  price_sell integer not null,
  subtotal integer not null,
  discount integer not null default 0,
  price_buy integer not null default 0,
  variant_id uuid references product_variants(id) on delete set null,
  variant_name text,
  created_at timestamptz default now()
);

-- Settings
create table if not exists settings (
  key text primary key,
  value text not null
);

insert into settings (key, value) values
  ('store_name', 'Toko Saya'),
  ('store_address', ''),
  ('store_phone', '')
on conflict (key) do nothing;

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

-- Stock movements
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjust')),
  qty integer not null,
  note text,
  created_at timestamptz not null default now()
);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  amount integer not null check (amount > 0),
  category text not null default 'lainnya',
  note text,
  created_at timestamptz not null default now()
);

-- Discount rules
create table if not exists discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('product', 'category', 'global')),
  value_type text not null check (value_type in ('percent', 'amount')),
  value integer not null check (value > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists discount_products (
  discount_id uuid not null references discounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (discount_id, product_id)
);

-- Cash sessions
create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opening integer not null default 0,
  closing integer,
  expected integer,
  diff integer,
  note text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Carts
create table if not exists carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  customer jsonb,
  updated_at timestamptz default now()
);
