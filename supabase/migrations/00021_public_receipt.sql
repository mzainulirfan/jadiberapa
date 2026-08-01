-- Fase 4c: Struk digital via link publik
-- Tambah token acak per transaksi untuk link struk (/s/<token>) yang bisa dibuka
-- tanpa login. Fungsi get_public_receipt (security definer) hanya mengembalikan
-- data transaksi untuk token yang cocok, tanpa membocorkan tabel lain.

alter table transactions
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists transactions_share_token_idx on transactions (share_token);

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
    'paid_amount', coalesce(t.paid_amount, t.total),
    'status', coalesce(t.status, 'lunas'),
    'customer', (
      select json_build_object('name', c.name) from customers c where c.id = t.customer_id
    ),
    'items', (
      select coalesce(json_agg(json_build_object(
        'name',       coalesce(p.name, 'Produk dihapus'),
        'qty',        ti.qty,
        'price_sell', ti.price_sell,
        'subtotal',   ti.subtotal,
        'discount',   coalesce(ti.discount, 0)
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
