-- Pulihkan referensi customer yang ikut berubah oleh penggantian alias produk
-- di 00021-00024, lalu serialkan pembayaran supplier pada baris pembelian.

do $$
declare
  function_def text;
  fixed_def text;
begin
  select pg_get_functiondef(
    'public.create_transaction(jsonb,text,uuid,integer,integer,integer,integer,text)'::regprocedure
  ) into function_def;

  if position('product.store_id = sid' in function_def) > 0
    and position('where id = p_customer_id and product.store_id = sid' in function_def) > 0 then
    fixed_def := replace(
      function_def,
      'where id = p_customer_id and product.store_id = sid',
      'where id = p_customer_id and customers.store_id = sid'
    );
    execute fixed_def;
  end if;

  select pg_get_functiondef(
    'public.record_supplier_payment(uuid,integer,text,text)'::regprocedure
  ) into function_def;

  if position(
    'select * into pur from purchases where id = p_purchase_id and store_id = sid;'
    in function_def
  ) > 0 then
    fixed_def := replace(
      function_def,
      'select * into pur from purchases where id = p_purchase_id and store_id = sid;',
      E'select * into pur from purchases where id = p_purchase_id and store_id = sid\n  for update;'
    );
    execute fixed_def;
  end if;
end;
$$;
