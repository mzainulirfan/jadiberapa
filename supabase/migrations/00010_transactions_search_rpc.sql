-- Halaman transaksi: pencarian & ringkasan di sisi database.
-- Tujuan:
--   1. get_transactions_summary: count + sum dihitung di DB (bukan tarik semua baris ke browser).
--   2. search_transactions: daftar transaksi + jumlah item + nama pembeli, dengan pencarian
--      no. nota ATAU nama pembeli yang benar (tak bisa via .or PostgREST lintas tabel).
--   3. Index trigram agar ilike '%kata%' tak sequential scan.

create extension if not exists pg_trgm;

create index if not exists idx_transactions_number_trgm
  on transactions using gin (number gin_trgm_ops);

create index if not exists idx_customers_name_trgm
  on customers using gin (name gin_trgm_ops);

-- Ringkasan (kartu Pendapatan / jumlah transaksi) untuk filter yang sama.
create or replace function get_transactions_summary(
  p_search text default null,
  p_date_from timestamptz default null
)
returns table (count bigint, total bigint)
language sql
stable
as $$
  select count(*)::bigint, coalesce(sum(t.total), 0)::bigint
  from transactions t
  left join customers c on c.id = t.customer_id
  where (p_date_from is null or t.created_at >= p_date_from)
    and (
      p_search is null
      or t.number ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
    );
$$;

-- Daftar transaksi berhalaman; item_count menggantikan embed transaction_items(id, qty).
create or replace function search_transactions(
  p_search text default null,
  p_date_from timestamptz default null,
  p_limit int default 21,
  p_offset int default 0
)
returns table (
  id uuid,
  number text,
  total integer,
  payment_method text,
  customer_id uuid,
  created_at timestamptz,
  item_count int,
  customer_name text
)
language sql
stable
as $$
  select
    t.id,
    t.number,
    t.total,
    t.payment_method,
    t.customer_id,
    t.created_at,
    coalesce(
      (select count(*)::int from transaction_items ti where ti.transaction_id = t.id),
      0
    ) as item_count,
    c.name as customer_name
  from transactions t
  left join customers c on c.id = t.customer_id
  where (p_date_from is null or t.created_at >= p_date_from)
    and (
      p_search is null
      or t.number ilike '%' || p_search || '%'
      or c.name ilike '%' || p_search || '%'
    )
  order by t.created_at desc
  limit p_limit offset p_offset;
$$;
