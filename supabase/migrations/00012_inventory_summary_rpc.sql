-- Ringkasan inventaris halaman Produk dihitung di database.
-- Menggantikan select("stock, price_buy") atas SELURUH tabel produk yang lalu
-- dijumlah di browser (beban tumbuh linear seiring katalog).

create or replace function get_inventory_summary()
returns table (count bigint, stock_value bigint, low_stock bigint)
language sql
stable
as $$
  select
    count(*)::bigint,
    coalesce(sum(price_buy::bigint * stock::bigint), 0)::bigint,
    count(*) filter (where stock <= 5)::bigint
  from products;
$$;
