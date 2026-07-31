-- Fase 5: Shift kasir / laci kas
-- Sesi kas: buka (saldo awal) -> tutup (hitung fisik & selisih). Nilai kas yang
-- "seharusnya" dihitung dari penjualan tunai + pembayaran tunai (DP/cicilan)
-- sejak sesi dibuka, ditambah saldo awal.

create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opening integer not null default 0,        -- saldo awal laci
  closing integer,                            -- hitung fisik saat tutup
  expected integer,                           -- perkiraan sistem saat tutup
  diff integer,                               -- closing - expected (lebih/kurang)
  note text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists cash_sessions_open_idx on cash_sessions (closed_at, opened_at desc);

alter table cash_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'cash_sessions' and policyname = 'cash_sessions_all'
  ) then
    create policy cash_sessions_all on cash_sessions
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Ringkasan kas tunai sejak sesi dibuka: total transaksi tunai + pembayaran tunai
-- (DP/cicilan utang). Dipakai untuk menghitung "kas seharusnya" saat tutup shift.
create or replace function get_shift_summary(p_opened_at timestamptz)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'cashSales', coalesce((
      select sum(total) from transactions
      where payment_method = 'cash' and created_at >= p_opened_at
    ), 0)
    + coalesce((
      select sum(amount) from payments
      where method = 'cash' and created_at >= p_opened_at
    ), 0),
    'txCount', coalesce((
      select count(*) from transactions
      where created_at >= p_opened_at
    ), 0)
  );
$$;
