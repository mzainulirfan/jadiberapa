-- Catat template toko yang dipilih saat onboarding.
-- Null = belum memilih; 'kosong' = pemilik sengaja mulai tanpa data contoh.

alter table stores
  add column if not exists template_key text;

create index if not exists idx_stores_template_key on stores (template_key);
