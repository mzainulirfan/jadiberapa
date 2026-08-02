-- Fase multi-toko (bagian 6/6): keranjang tertahan + hook auth signup
-- (owner membuat toko, kasir gabung via kode). Dipecah dari 00002_multi_store.sql.

-- Held carts are created after store isolation exists.
create table if not exists held_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade default current_store_id(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Pesanan',
  items jsonb not null default '[]',
  customer jsonb,
  created_at timestamptz not null default now()
);

alter table held_carts enable row level security;
drop policy if exists held_carts_store on held_carts;
create policy held_carts_store on held_carts
  for all to authenticated
  using (store_id = current_store_id() and user_id = auth.uid())
  with check (store_id = current_store_id() and user_id = auth.uid());

create index if not exists held_carts_store_idx on held_carts (store_id);

-- Auth signup hook: owner creates a new store; cashier joins by store code.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  store_code text;
  target_store uuid;
begin
  store_code := nullif(trim(coalesce(new.raw_user_meta_data->>'store_code', '')), '');

  if store_code is not null then
    select id into target_store from stores where code = lower(store_code);
    if target_store is null then
      raise exception 'Kode toko tidak ditemukan';
    end if;
    insert into store_members (user_id, store_id, role)
    values (new.id, target_store, 'kasir')
    on conflict (user_id, store_id) do nothing;
    return new;
  end if;

  insert into stores (name, code)
  values (
    coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'),
    make_store_code(coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya'))
  )
  returning id into target_store;

  insert into store_members (user_id, store_id, role)
  values (new.id, target_store, 'owner');

  insert into settings (store_id, key, value) values
    (target_store, 'store_name',    coalesce(new.raw_user_meta_data->>'store_name', 'Toko Saya')),
    (target_store, 'store_address', ''),
    (target_store, 'store_phone',   '');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
