-- Perbaikan lanjutan untuk function checkout yang sudah terpasang.
-- Gunakan nama tabel products secara eksplisit, tanpa alias, agar tidak ada
-- ambiguity maupun missing FROM-clause pada PostgreSQL.

do $$
declare
  function_def text;
begin
  select pg_get_functiondef(
    'public.create_transaction(jsonb,text,uuid,integer,integer,integer,integer,text)'::regprocedure
  ) into function_def;

  function_def := replace(function_def, 'update products as product', 'update products');
  function_def := replace(function_def, 'product.', 'products.');
  function_def := replace(
    function_def,
    'set stock = stock - (item->>''base_qty'')::integer',
    'set stock = products.stock - (item->>''base_qty'')::integer'
  );
  function_def := replace(
    function_def,
    'where id = (item->>''product_id'')::uuid',
    'where products.id = (item->>''product_id'')::uuid'
  );
  function_def := replace(
    function_def,
    'and store_id = sid',
    'and products.store_id = sid'
  );
  function_def := replace(
    function_def,
    'and stock >= (item->>''base_qty'')::integer',
    'and products.stock >= (item->>''base_qty'')::integer'
  );
  execute function_def;
end;
$$;
