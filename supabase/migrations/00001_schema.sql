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

-- Transactions
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  total integer not null default 0,
  payment_method text default 'cash',
  customer_id uuid references customers(id) on delete set null,
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
  created_at timestamptz default now()
);

-- Settings
create table if not exists settings (
  key text primary key,
  value text not null
);

-- Insert default settings
insert into settings (key, value) values
  ('store_name', 'Toko Saya'),
  ('store_address', ''),
  ('store_phone', '')
on conflict (key) do nothing;

-- Enable RLS
alter table products enable row level security;
alter table categories enable row level security;
alter table customers enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table settings enable row level security;

-- RLS policies (single user — select, insert, update, delete for authenticated users)
drop policy if exists "authenticated_all" on products;
drop policy if exists "authenticated_all" on categories;
drop policy if exists "authenticated_all" on customers;
drop policy if exists "authenticated_all" on transactions;
drop policy if exists "authenticated_all" on transaction_items;
drop policy if exists "authenticated_all" on settings;

create policy "authenticated_all" on products for all to authenticated using (true) with check (true);
create policy "authenticated_all" on categories for all to authenticated using (true) with check (true);
create policy "authenticated_all" on customers for all to authenticated using (true) with check (true);
create policy "authenticated_all" on transactions for all to authenticated using (true) with check (true);
create policy "authenticated_all" on transaction_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on settings for all to authenticated using (true) with check (true);

-- Helper: decrement stock atomically
create or replace function decrement_stock(pid uuid, qty int)
returns void as $$
begin
  update products set stock = greatest(0, stock - qty), updated_at = now() where id = pid;
end;
$$ language plpgsql security definer;
