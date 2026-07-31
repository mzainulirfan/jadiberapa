-- Ensure every product has an internal EAN-13 barcode
-- Internal/in-store prefix range 200-299 (prefix "200" here) + 9 digits + check digit

-- EAN-13 check digit for a 12-digit base
create or replace function ean13_check_digit(base12 text)
returns text as $$
declare
  s int := 0;
  i int;
  d int;
begin
  for i in 1..12 loop
    d := substr(base12, i, 1)::int;
    if i % 2 = 1 then
      s := s + d;
    else
      s := s + d * 3;
    end if;
  end loop;
  return ((10 - (s % 10)) % 10)::text;
end;
$$ language plpgsql immutable;

-- Generate a unique internal EAN-13 (prefix 200)
create or replace function gen_ean13_internal()
returns text as $$
declare
  base12 text;
  code text;
begin
  loop
    base12 := '200' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0');
    code := base12 || ean13_check_digit(base12);
    exit when not exists (select 1 from products where barcode = code);
  end loop;
  return code;
end;
$$ language plpgsql volatile;

-- Trigger: fill barcode when empty on insert/update
create or replace function set_product_barcode()
returns trigger as $$
begin
  if new.barcode is null or new.barcode = '' then
    new.barcode := gen_ean13_internal();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_product_barcode on products;
create trigger trg_set_product_barcode
  before insert or update on products
  for each row execute function set_product_barcode();

-- Backfill existing products missing a barcode
update products set barcode = gen_ean13_internal() where barcode is null or barcode = '';

-- Enforce uniqueness for non-null barcodes
create unique index if not exists products_barcode_unique on products (barcode) where barcode is not null;
