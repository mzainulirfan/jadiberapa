-- Fase 4f: Satuan produk (pcs, lusin, kg, dll.) — hanya metadata tampilan.

alter table products
  add column if not exists unit text not null default 'pcs';
