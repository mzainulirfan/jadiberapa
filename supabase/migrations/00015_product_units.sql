-- Fase D: Satuan turunan (bulk/eceran) per produk.
-- Kasir bisa memilih satuan saat menambah ke keranjang; stok tetap dihitung
-- dalam satuan dasar (products.unit), dikonversi lewat `factor`.

create table if not exists product_units (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  factor integer not null default 1 check (factor >= 1),
  price_sell integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);

alter table product_units enable row level security;

drop policy if exists store_all_product_units on product_units;
create policy store_all_product_units on product_units
  for all to authenticated
  using (store_id = current_store_id())
  with check (store_id = current_store_id());

create index if not exists idx_product_units_store on product_units (store_id);
create index if not exists product_units_product_idx on product_units (product_id);

-- Snapshot satuan & faktor pada detail penjualan (untuk struk/riwayat).
alter table transaction_items add column if not exists unit_name text;
alter table transaction_items add column if not exists factor integer not null default 1;
