-- Fase 4g: Varian produk (mis. ukuran/warna dengan harga sendiri).
-- Stok tetap di level produk; varian hanya membawa nama + harga.
-- transaction_items menyimpan snapshot variant_id + variant_name agar struk
-- historis tetap benar walau varian dihapus/diubah.

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  sku text,
  price_buy integer not null default 0,
  price_sell integer not null default 0,
  created_at timestamptz not null default now()
);

alter table product_variants enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'product_variants'
  ) then
    create policy "Semua akses product_variants" on product_variants
      for all using (true) with check (true);
  end if;
end
$$;

create index if not exists product_variants_product_idx on product_variants (product_id);

alter table transaction_items
  add column if not exists variant_id uuid references product_variants(id) on delete set null,
  add column if not exists variant_name text;

-- Perbarui struk publik agar menyertakan nama varian.
create or replace function get_public_receipt(p_token uuid)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'store', (
      select json_build_object(
        'name',    coalesce((select value from settings where key = 'store_name'), ''),
        'address', coalesce((select value from settings where key = 'store_address'), ''),
        'phone',   coalesce((select value from settings where key = 'store_phone'), '')
      )
    ),
    'number', t.number,
    'created_at', t.created_at,
    'payment_method', t.payment_method,
    'total', t.total,
    'discount', coalesce(t.discount, 0),
    'fee', coalesce(t.fee, 0),
    'paid_amount', coalesce(t.paid_amount, t.total),
    'status', coalesce(t.status, 'lunas'),
    'customer', (
      select json_build_object('name', c.name) from customers c where c.id = t.customer_id
    ),
    'items', (
      select coalesce(json_agg(json_build_object(
        'name',         coalesce(p.name, 'Produk dihapus'),
        'variant_name', coalesce(ti.variant_name, ''),
        'qty',          ti.qty,
        'price_sell',   ti.price_sell,
        'subtotal',     ti.subtotal,
        'discount',     coalesce(ti.discount, 0)
      )), '[]'::json)
      from transaction_items ti
      left join products p on p.id = ti.product_id
      where ti.transaction_id = t.id
    ),
    'payments', (
      select coalesce(json_agg(json_build_object(
        'amount',     pm.amount,
        'method',     pm.method,
        'created_at', pm.created_at
      )), '[]'::json)
      from payments pm
      where pm.transaction_id = t.id
    )
  )
  from transactions t
  where t.share_token = p_token
$$;

grant execute on function get_public_receipt(uuid) to anon, authenticated, service_role;
