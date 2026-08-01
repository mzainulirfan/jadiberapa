-- Fase 4d: Barang favorit untuk quick-add di kasir
-- Tanda favorit per produk; kasir bisa menampilkan hanya barang favorit.

alter table products
  add column if not exists is_favorite boolean not null default false;

create index if not exists products_favorite_idx on products (is_favorite);
