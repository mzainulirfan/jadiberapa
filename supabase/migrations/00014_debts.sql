-- Fase 1: Utang / Kasbon
-- Menambah pelacakan pembayaran sebagian pada transaksi + buku pembayaran (cicilan).

-- 1. Kolom pada transactions: jumlah sudah dibayar & status pelunasan.
alter table transactions
  add column if not exists paid_amount integer not null default 0,
  add column if not exists status text not null default 'lunas';

-- Transaksi lama dianggap lunas penuh (nilai bayar = total).
update transactions set paid_amount = total where paid_amount = 0;

-- Batasi status ke nilai yang valid.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_status_check'
  ) then
    alter table transactions
      add constraint transactions_status_check check (status in ('lunas', 'utang'));
  end if;
end $$;

-- 2. Buku pembayaran: tiap baris = satu kali pembayaran (DP atau cicilan).
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  amount integer not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

alter table payments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'payments' and policyname = 'payments_all') then
    create policy "payments_all" on payments
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create index if not exists payments_transaction_id_idx on payments (transaction_id);
create index if not exists transactions_utang_idx on transactions (created_at) where status = 'utang';
