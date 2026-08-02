-- Fase multi-toko (bagian 1/6): tabel toko & keanggotaan, kode toko, dan
-- seeding default store untuk data yang sudah ada. Dipecah dari 00002_multi_store.sql.

-- Stores and membership
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Toko Saya',
  code text,
  template_key text,
  created_at timestamptz not null default now()
);

create table if not exists store_members (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'kasir')),
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

create table if not exists user_active_store (
  user_id uuid primary key references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  updated_at timestamptz not null default now()
);

alter table stores enable row level security;
alter table store_members enable row level security;
alter table user_active_store enable row level security;

create or replace function current_store_id()
returns uuid
language sql
stable
as $$
  select sm.store_id
  from store_members sm
  join user_active_store uas
    on uas.user_id = sm.user_id
   and uas.store_id = sm.store_id
  where sm.user_id = auth.uid()
  limit 1;
$$;

create or replace function current_user_role()
returns text
language sql
stable
as $$
  select sm.role
  from store_members sm
  join user_active_store uas
    on uas.user_id = sm.user_id
   and uas.store_id = sm.store_id
  where sm.user_id = auth.uid()
  limit 1;
$$;

-- Store codes
create or replace function make_store_code(p_name text)
returns text
language plpgsql
as $$
declare
  base text;
  result text;
begin
  base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from base);
  if base = '' then base := 'toko'; end if;
  loop
    result := base || '-' || substr(md5(random()::text), 1, 4);
    exit when not exists (select 1 from stores where code = result);
  end loop;
  return result;
end;
$$;

-- Default store for data/users that already exist before this migration.
insert into stores (id, name, code)
values (
  '11111111-1111-1111-1111-111111111111',
  coalesce((select value from settings where key = 'store_name'), 'Toko Saya'),
  make_store_code(coalesce((select value from settings where key = 'store_name'), 'Toko Saya'))
)
on conflict (id) do nothing;

update stores
set code = make_store_code(name)
where code is null;

alter table stores alter column code set not null;
create unique index if not exists stores_code_key on stores (code);
create index if not exists idx_stores_template_key on stores (template_key);

insert into store_members (user_id, store_id, role)
select id, '11111111-1111-1111-1111-111111111111', 'owner'
from auth.users
on conflict (user_id, store_id) do nothing;

insert into user_active_store (user_id, store_id)
select distinct on (user_id) user_id, store_id
from store_members
order by user_id, created_at asc
on conflict (user_id) do nothing;
