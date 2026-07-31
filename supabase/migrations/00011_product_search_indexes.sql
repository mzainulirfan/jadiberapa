-- Index trigram untuk pencarian produk (name/sku/barcode) di kasir & halaman Produk.
-- ilike '%kata%' (wildcard di depan) tak bisa pakai btree; GIN trigram membuatnya
-- terindeks alih-alih sequential scan seiring katalog membesar.

create extension if not exists pg_trgm;

create index if not exists idx_products_name_trgm
  on products using gin (name gin_trgm_ops);

create index if not exists idx_products_sku_trgm
  on products using gin (sku gin_trgm_ops);

create index if not exists idx_products_barcode_trgm
  on products using gin (barcode gin_trgm_ops);
