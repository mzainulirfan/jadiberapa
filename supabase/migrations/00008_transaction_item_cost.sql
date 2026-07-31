-- Snapshot harga beli (cost) pada tiap item transaksi.
-- Tujuan:
--   1. Menghapus join berat transaction_items -> products (price_buy) saat hitung laba.
--   2. Laba historis akurat walau harga beli produk berubah / produk dihapus.

alter table transaction_items
  add column if not exists price_buy integer not null default 0;

-- Backfill baris lama dari harga beli produk saat ini (perkiraan terbaik untuk data historis).
update transaction_items ti
set price_buy = coalesce(p.price_buy, 0)
from products p
where ti.product_id = p.id
  and ti.price_buy = 0;
