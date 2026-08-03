-- 17: isolasi keranjang per toko.
-- carts hanya punya user_id (PK) tanpa store_id, sehingga keranjang dari toko A
-- bisa terlihat di toko B. Tambahkan store_id dan indeks untuk filter sisi client.

alter table carts add column if not exists store_id uuid references stores (id) on delete cascade;

create index if not exists carts_store_idx on carts (store_id);

-- Backfill untuk baris yang sudah ada dipetakan ke toko aktif lewat current_store_id.
update carts
set store_id = (select current_store_id())
where store_id is null;

-- Tidak memaksa not null agar siklus (insert → RPC store) lama tetap berfungsi,
-- client sekarang selalu menyetel store_id eksplisit di upsert.