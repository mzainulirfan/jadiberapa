-- Fase 4b: Kelola diskon (per produk, kategori diskon, global)
-- Aturan diskon disimpan di `discounts`; produk terdampak di `discount_products`.
-- Saat transaksi, diskon dihitung otomatis dari aturan yang aktif dengan prioritas
-- produk > kategori > global (di level sama, ambil yang terbesar). Besar diskon
-- disimpan sebagai per-unit (persen dari harga jual atau nominal rupiah).

-- 1. Aturan diskon.
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

-- 2. Produk terdampak untuk type 'product' dan 'category'.
create table if not exists discount_products (
  discount_id uuid not null references discounts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  primary key (discount_id, product_id)
);

alter table discounts enable row level security;
alter table discount_products enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'discounts' and policyname = 'discounts_all') then
    create policy "discounts_all" on discounts
      for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'discount_products' and policyname = 'discount_products_all') then
    create policy "discount_products_all" on discount_products
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists discount_products_product_idx on discount_products (product_id);
create index if not exists discounts_active_idx on discounts (active);
