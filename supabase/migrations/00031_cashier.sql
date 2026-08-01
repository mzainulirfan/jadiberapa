-- Fase 6 (tahap 5): nama kasir pada transaksi.
-- Tiap transaksi mencatat user_id (siapa yang membuat) + snapshot nama kasir
-- (cashier_name) agar detail transaksi & struk bisa menampilkan kasir tanpa
-- perlu join ke auth.users (yang tidak bisa diakses langsung via PostgREST).

alter table transactions add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table transactions add column if not exists cashier_name text;

create index if not exists transactions_user_idx on transactions (user_id);
