-- Hotfix final untuk function checkout yang sudah terpasang.
-- PostgreSQL membutuhkan alias target yang eksplisit saat kolom target dirujuk
-- dari expression UPDATE.

do $$
declare
  function_def text;
begin
  select pg_get_functiondef(
    'public.create_transaction(jsonb,text,uuid,integer,integer,integer,integer,text)'::regprocedure
  ) into function_def;

  function_def := regexp_replace(
    function_def,
    E'update[[:space:]]+products([[:space:]]+as[[:space:]]+product)?',
    'update products as product',
    'gi'
  );
  function_def := replace(function_def, 'products.stock', 'product.stock');
  function_def := replace(function_def, 'products.id', 'product.id');
  function_def := replace(function_def, 'products.store_id', 'product.store_id');
  function_def := replace(
    function_def,
    'set stock = stock - (item->>''base_qty'')::integer',
    'set stock = product.stock - (item->>''base_qty'')::integer'
  );
  function_def := replace(
    function_def,
    'where id = (item->>''product_id'')::uuid',
    'where product.id = (item->>''product_id'')::uuid'
  );
  function_def := replace(function_def, 'and store_id = sid', 'and product.store_id = sid');
  function_def := replace(
    function_def,
    'and stock >= (item->>''base_qty'')::integer',
    'and product.stock >= (item->>''base_qty'')::integer'
  );
  execute function_def;
end;
$$;
