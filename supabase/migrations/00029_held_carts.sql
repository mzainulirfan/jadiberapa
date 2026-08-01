-- Fase 6 (tahap 4): Pesanan Ditahan (held carts).
-- Kasir yang melayani beberapa pembeli bergantian bisa "menahan" keranjang aktif
-- (dengan label, mis. nama pembeli) lalu melanjutkannya kapan pun. Data tersimpan
-- per toko + per user, jadi terisolasi antar toko dan antar kasir.

create table if not exists held_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Pesanan',
  items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table held_carts enable row level security;

-- Hanya pemilik pesanan di toko aktif yang bisa melihat/mengubahnya.
drop policy if exists held_carts_store on held_carts;
create policy held_carts_store on held_carts
  for all to authenticated
  using (store_id = current_store_id() and user_id = auth.uid())
  with check (store_id = current_store_id() and user_id = auth.uid());

create index if not exists held_carts_store_idx on held_carts (store_id);
