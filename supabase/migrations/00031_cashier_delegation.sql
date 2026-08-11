-- Owner-to-cashier delegated mode. The owner keeps the authenticated session,
-- while authorization and transaction attribution use the selected cashier.

create table if not exists cashier_delegations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  cashier_user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashier_delegations_distinct_users check (owner_user_id <> cashier_user_id),
  constraint cashier_delegations_fixed_duration
    check (expires_at = created_at + interval '30 minutes'),
  constraint cashier_delegations_valid_end
    check (ended_at is null or ended_at >= created_at)
);

create unique index if not exists cashier_delegations_one_open_owner_session_idx
  on cashier_delegations (owner_user_id, session_id)
  where ended_at is null;
create index if not exists cashier_delegations_store_created_idx
  on cashier_delegations (store_id, created_at desc);
create index if not exists cashier_delegations_cashier_idx
  on cashier_delegations (cashier_user_id, created_at desc);

alter table cashier_delegations enable row level security;

-- There is deliberately no API-role policy. SECURITY DEFINER functions owned
-- by postgres use the same explicit internal policy convention as migration 30.
drop policy if exists internal_rpc_all on cashier_delegations;
create policy internal_rpc_all on cashier_delegations
  for all to postgres using (true) with check (true);

-- Delegation helpers also inspect membership tables from postgres-owned
-- SECURITY DEFINER functions, so make that internal path explicit under RLS.
drop policy if exists internal_rpc_all on store_members;
create policy internal_rpc_all on store_members
  for all to postgres using (true) with check (true);

drop policy if exists internal_rpc_all on user_active_store;
create policy internal_rpc_all on user_active_store
  for all to postgres using (true) with check (true);

drop policy if exists internal_rpc_all on carts;
create policy internal_rpc_all on carts
  for all to postgres using (true) with check (true);

create or replace function current_auth_session_id()
returns uuid
language plpgsql
stable
set search_path = public
as $$
declare
  claim text;
begin
  claim := nullif(auth.jwt()->>'session_id', '');
  if claim is null then return null; end if;
  return claim::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Returns the open delegation for this physical user and JWT session. is_valid
-- is recalculated on every statement so revoked memberships fail closed.
create or replace function current_cashier_delegation()
returns table (
  delegation_id uuid,
  owner_user_id uuid,
  cashier_user_id uuid,
  store_id uuid,
  expires_at timestamptz,
  created_at timestamptz,
  is_valid boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.owner_user_id,
    d.cashier_user_id,
    d.store_id,
    d.expires_at,
    d.created_at,
    d.expires_at > statement_timestamp()
      and exists (
        select 1
        from store_members owner_member
        where owner_member.user_id = d.owner_user_id
          and owner_member.store_id = d.store_id
          and owner_member.role = 'owner'
          and owner_member.approved
      )
      and exists (
        select 1
        from store_members cashier_member
        where cashier_member.user_id = d.cashier_user_id
          and cashier_member.store_id = d.store_id
          and cashier_member.role = 'kasir'
          and cashier_member.approved
      )
      and exists (
        select 1
        from user_active_store active_store
        where active_store.user_id = d.owner_user_id
          and active_store.store_id = d.store_id
      ) as is_valid
  from cashier_delegations d
  where d.owner_user_id = auth.uid()
    and d.session_id = current_auth_session_id()
    and d.ended_at is null
  limit 1;
$$;

create or replace function current_delegation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.delegation_id
  from current_cashier_delegation() d
  where d.is_valid;
$$;

create or replace function has_open_cashier_delegation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from current_cashier_delegation());
$$;

create or replace function current_effective_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  delegated_user_id uuid;
  delegation_valid boolean;
begin
  select d.cashier_user_id, d.is_valid
    into delegated_user_id, delegation_valid
  from current_cashier_delegation() d;

  if found then
    return case when delegation_valid then delegated_user_id else null end;
  end if;
  return auth.uid();
end;
$$;

-- An invalid or expired open delegation keeps its recorded store to preserve
-- An invalid or expired open delegation returns no store/effective user and a
-- non-privileged sentinel role. This makes store-scoped RLS fail closed while
-- avoiding SQL `NULL <> 'owner'` traps in legacy RPC guards.
create or replace function current_store_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  delegated_store_id uuid;
  delegation_valid boolean;
begin
  select d.store_id, d.is_valid into delegated_store_id, delegation_valid
  from current_cashier_delegation() d;

  if found then
    return case when delegation_valid then delegated_store_id else null end;
  end if;

  return (
    select sm.store_id
    from store_members sm
    join user_active_store uas
      on uas.user_id = sm.user_id
     and uas.store_id = sm.store_id
    where sm.user_id = auth.uid()
      and sm.approved
    limit 1
  );
end;
$$;

create or replace function current_user_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  delegation_valid boolean;
begin
  select d.is_valid into delegation_valid
  from current_cashier_delegation() d;

  if found then
    return case when delegation_valid then 'kasir' else 'delegation_locked' end;
  end if;

  return (
    select sm.role
    from store_members sm
    join user_active_store uas
      on uas.user_id = sm.user_id
     and uas.store_id = sm.store_id
    where sm.user_id = auth.uid()
      and sm.approved
    limit 1
  );
end;
$$;

-- Service-role only: the server action verifies the owner's passcode before
-- supplying the validated owner and JWT session identities.
create or replace function start_cashier_delegation_for_session(
  p_owner_user_id uuid,
  p_session_id uuid,
  p_cashier_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  delegation_id uuid;
  delegation_expires_at timestamptz;
  cashier_username text;
  started_at timestamptz := statement_timestamp();
begin
  if p_owner_user_id is null or p_session_id is null then
    return json_build_object('error', 'Identitas sesi tidak valid');
  end if;

  select uas.store_id into sid
  from user_active_store uas
  join store_members sm
    on sm.user_id = uas.user_id
   and sm.store_id = uas.store_id
   and sm.role = 'owner'
   and sm.approved
  where uas.user_id = p_owner_user_id
  for update of uas;
  if sid is null then
    return json_build_object('error', 'Hanya pemilik toko yang bisa memulai mode kasir');
  end if;
  if p_cashier_user_id is null or p_cashier_user_id = p_owner_user_id then
    return json_build_object('error', 'Kasir tujuan tidak valid');
  end if;

  if exists (
    select 1
    from carts c
    where c.user_id = p_owner_user_id
      and c.store_id = sid
      and jsonb_array_length(coalesce(c.items, '[]'::jsonb)) > 0
  ) then
    return json_build_object('error', 'Kosongkan keranjang sebelum masuk ke mode kasir');
  end if;

  if exists (
    select 1 from cashier_delegations d
    where d.owner_user_id = p_owner_user_id
      and d.session_id = p_session_id
      and d.ended_at is null
  ) then
    return json_build_object('error', 'Mode kasir pada sesi ini belum diakhiri');
  end if;

  select split_part(coalesce(u.email, ''), '@', 1)
    into cashier_username
  from store_members sm
  join auth.users u on u.id = sm.user_id
  where sm.user_id = p_cashier_user_id
    and sm.store_id = sid
    and sm.role = 'kasir'
    and sm.approved;
  if not found then
    return json_build_object('error', 'Kasir yang disetujui tidak ditemukan di toko aktif');
  end if;

  delegation_expires_at := started_at + interval '30 minutes';
  begin
    insert into cashier_delegations (
      owner_user_id, cashier_user_id, store_id, session_id,
      created_at, updated_at, expires_at
    ) values (
      p_owner_user_id, p_cashier_user_id, sid, p_session_id,
      started_at, started_at, delegation_expires_at
    )
    returning id into delegation_id;
  exception when unique_violation then
    return json_build_object('error', 'Mode kasir pada sesi ini belum diakhiri');
  end;

  insert into audit_logs (
    store_id, user_id, actor_user_id, effective_user_id, delegation_id,
    action, entity_type, entity_id, metadata
  ) values (
    sid,
    p_owner_user_id,
    p_owner_user_id,
    p_cashier_user_id,
    delegation_id,
    'delegation.start',
    'cashier_delegation',
    delegation_id,
    jsonb_build_object(
      'owner_user_id', p_owner_user_id,
      'cashier_user_id', p_cashier_user_id,
      'expires_at', delegation_expires_at
    )
  );

  return json_build_object(
    'error', null,
    'delegation_id', delegation_id,
    'store_id', sid,
    'cashier_user_id', p_cashier_user_id,
    'cashier_username', cashier_username,
    'expires_at', delegation_expires_at,
    'active', true
  );
end;
$$;

create or replace function get_cashier_delegation_status()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  auth_session_id uuid := current_auth_session_id();
  row_id uuid;
  row_owner_id uuid;
  row_cashier_id uuid;
  row_store_id uuid;
  row_expires_at timestamptz;
  row_created_at timestamptz;
  row_valid boolean;
  cashier_username text;
  status_name text;
begin
  if auth.uid() is null or auth_session_id is null then
    return json_build_object('error', 'Sesi autentikasi tidak valid');
  end if;

  select
    d.delegation_id, d.owner_user_id, d.cashier_user_id, d.store_id,
    d.expires_at, d.created_at, d.is_valid
  into
    row_id, row_owner_id, row_cashier_id, row_store_id,
    row_expires_at, row_created_at, row_valid
  from current_cashier_delegation() d;

  if not found then
    return json_build_object(
      'error', null,
      'active', false,
      'status', 'none',
      'delegation', null
    );
  end if;

  select split_part(coalesce(u.email, ''), '@', 1)
    into cashier_username
  from auth.users u
  where u.id = row_cashier_id;

  status_name := case
    when row_valid then 'active'
    when row_expires_at <= statement_timestamp() then 'expired'
    else 'invalid'
  end;

  return json_build_object(
    'error', null,
    'active', row_valid,
    'status', status_name,
    'delegation', json_build_object(
      'id', row_id,
      'owner_user_id', row_owner_id,
      'cashier_user_id', row_cashier_id,
      'cashier_username', cashier_username,
      'store_id', row_store_id,
      'created_at', row_created_at,
      'expires_at', row_expires_at
    )
  );
end;
$$;

-- Validate the browser's expected identity and create the sale in one database
-- statement. Row locks prevent start/end mode from changing attribution between
-- validation and the nested canonical checkout RPC.
create or replace function create_transaction_with_delegation_context(
  p_items jsonb,
  p_payment_method text,
  p_customer_id uuid,
  p_paid_amount integer,
  p_discount integer,
  p_fee integer,
  p_points_redeemed integer,
  p_idempotency_key text,
  p_expected_delegation_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  active_delegation_id uuid;
  existing_id uuid;
  checkout_result json;
begin
  if auth.uid() is null then
    return json_build_object('error', 'Tidak ada sesi', 'error_code', 'AUTH_REQUIRED', 'retryable', false);
  end if;

  select uas.store_id into sid
  from user_active_store uas
  where uas.user_id = auth.uid()
  for share;
  if sid is null then
    return json_build_object('error', 'Toko aktif tidak ditemukan', 'error_code', 'STORE_NOT_FOUND', 'retryable', false);
  end if;

  -- Resolve an unknown-response retry even after its delegation has ended.
  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select t.id into existing_id
    from transactions t
    where t.store_id = sid
      and t.idempotency_key = btrim(p_idempotency_key)
      and t.delegation_id is not distinct from p_expected_delegation_id;
    if existing_id is not null then
      return json_build_object('error', null, 'id', existing_id, 'duplicate', true);
    end if;
  end if;

  perform d.id
  from cashier_delegations d
  where d.owner_user_id = auth.uid()
    and d.session_id = current_auth_session_id()
    and d.ended_at is null
  for share;

  active_delegation_id := current_delegation_id();
  if active_delegation_id is distinct from p_expected_delegation_id then
    return json_build_object(
      'error', 'Konteks mode kasir sudah berubah',
      'error_code', 'DELEGATION_CONTEXT_MISMATCH',
      'retryable', p_expected_delegation_id is null
    );
  end if;

  select create_transaction(
    p_items,
    p_payment_method,
    p_customer_id,
    p_paid_amount,
    p_discount,
    p_fee,
    p_points_redeemed,
    p_idempotency_key
  ) into checkout_result;
  return checkout_result;
end;
$$;

-- This RPC is service-role only. The server action verifies the owner's
-- passcode before supplying the validated user and JWT session identities.
create or replace function end_cashier_delegation_for_session(
  p_owner_user_id uuid,
  p_session_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  delegation_id uuid;
  delegation_store_id uuid;
  delegation_cashier_id uuid;
  ended_time timestamptz := statement_timestamp();
begin
  if p_owner_user_id is null or p_session_id is null then
    return json_build_object('error', 'Identitas sesi tidak valid');
  end if;

  update cashier_delegations d
  set ended_at = ended_time,
      updated_at = ended_time
  where d.owner_user_id = p_owner_user_id
    and d.session_id = p_session_id
    and d.ended_at is null
  returning d.id, d.store_id, d.cashier_user_id
    into delegation_id, delegation_store_id, delegation_cashier_id;

  if not found then
    return json_build_object('error', null, 'ended', false);
  end if;

  delete from carts c
  where c.user_id = p_owner_user_id
    and c.store_id = delegation_store_id;

  insert into audit_logs (
    store_id, user_id, actor_user_id, effective_user_id, delegation_id,
    action, entity_type, entity_id, metadata
  ) values (
    delegation_store_id,
    p_owner_user_id,
    p_owner_user_id,
    delegation_cashier_id,
    delegation_id,
    'delegation.end',
    'cashier_delegation',
    delegation_id,
    jsonb_build_object(
      'owner_user_id', p_owner_user_id,
      'cashier_user_id', delegation_cashier_id,
      'ended_at', ended_time
    )
  );

  return json_build_object(
    'error', null,
    'ended', true,
    'delegation_id', delegation_id,
    'ended_at', ended_time
  );
end;
$$;

-- A delegated browser must neither enumerate the owner's other stores nor
-- switch/create an active store through legacy SECURITY DEFINER RPCs.
create or replace function get_my_stores()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  active uuid;
  delegated_store uuid;
begin
  select d.store_id into delegated_store
  from current_cashier_delegation() d;

  if found then
    return (
      select coalesce(json_agg(json_build_object(
        'store_id', s.id,
        'name', s.name,
        'role', 'kasir',
        'active', true
      )), '[]'::json)
      from stores s
      where s.id = delegated_store
    );
  end if;

  select store_id into active from user_active_store where user_id = auth.uid();
  return (
    select coalesce(json_agg(json_build_object(
      'store_id', s.id,
      'name', s.name,
      'role', sm.role,
      'active', (s.id = active)
    ) order by (s.id = active) desc, sm.created_at asc), '[]'::json)
    from store_members sm
    join stores s on s.id = sm.store_id
    where sm.user_id = auth.uid() and sm.approved
  );
end;
$$;

create or replace function guard_delegated_active_store_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and exists (select 1 from current_cashier_delegation()) then
    raise exception 'Toko aktif tidak dapat diubah selama mode kasir';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_delegated_active_store_change on user_active_store;
create trigger guard_delegated_active_store_change
  before insert or update or delete on user_active_store
  for each row execute function guard_delegated_active_store_change();

-- Direct table reads must follow the effective store, not the physical owner's
-- memberships. Pending users without a delegation can still inspect their own
-- membership so NoStoreGuard keeps working.
drop policy if exists stores_member on stores;
drop policy if exists stores_select_member on stores;
create policy stores_select_member on stores
  for select to authenticated
  using (
    id = current_store_id()
    and current_user_role() in ('owner', 'kasir')
  );

drop policy if exists store_members_select_own on store_members;
create policy store_members_select_own on store_members
  for select to authenticated
  using (
    user_id = auth.uid()
    and not has_open_cashier_delegation()
    and (current_store_id() is null or store_id = current_store_id())
  );

-- Existing owner-only policies must use the effective role, rather than the
-- physical owner membership that remains present during delegated mode.
drop policy if exists stores_modify_owner on stores;
create policy stores_modify_owner on stores
  for update to authenticated
  using (id = current_store_id() and current_user_role() = 'owner')
  with check (id = current_store_id() and current_user_role() = 'owner');

drop policy if exists stores_delete_owner on stores;
create policy stores_delete_owner on stores
  for delete to authenticated
  using (id = current_store_id() and current_user_role() = 'owner');

drop policy if exists audit_logs_owner_read on audit_logs;
create policy audit_logs_owner_read on audit_logs
  for select to authenticated
  using (store_id = current_store_id() and current_user_role() = 'owner');

-- Snapshot both the physical actor and effective cashier on each new sale.
alter table transactions
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists effective_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delegation_id uuid references cashier_delegations(id) on delete set null,
  add column if not exists actor_name text,
  add column if not exists was_delegated boolean default false;

create index if not exists transactions_delegation_idx
  on transactions (delegation_id)
  where delegation_id is not null;

create or replace function snapshot_transaction_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  effective_id uuid;
  active_delegation_id uuid;
  effective_username text;
begin
  -- System imports without a user JWT keep any supplied historical values.
  if actor_id is null then return new; end if;

  -- Backup restore strips database-specific UUID references while preserving
  -- portable name snapshots and whether the sale was delegated.
  if new.actor_name like '__backup_restore__%' then
    new.actor_name := nullif(substring(new.actor_name from 19), '');
    new.actor_user_id := null;
    new.effective_user_id := null;
    new.delegation_id := null;
    new.was_delegated := coalesce(new.was_delegated, false);
    return new;
  end if;

  effective_id := current_effective_user_id();
  if effective_id is null then
    raise exception 'Delegasi kasir tidak lagi valid';
  end if;

  select d.delegation_id
    into active_delegation_id
  from current_cashier_delegation() d
  where d.is_valid;

  new.actor_user_id := coalesce(new.actor_user_id, actor_id);
  new.effective_user_id := coalesce(new.effective_user_id, effective_id);
  new.delegation_id := coalesce(new.delegation_id, active_delegation_id);
  new.was_delegated := coalesce(new.was_delegated, false) or active_delegation_id is not null;
  new.actor_name := coalesce(new.actor_name, split_part(coalesce(
    (select u.email from auth.users u where u.id = actor_id), ''
  ), '@', 1));

  if active_delegation_id is not null then
    effective_username := split_part(coalesce(
      (select u.email from auth.users u where u.id = effective_id), ''
    ), '@', 1);
    new.cashier_name := effective_username;
  end if;

  return new;
end;
$$;

drop trigger if exists snapshot_transaction_attribution on transactions;
create trigger snapshot_transaction_attribution
  before insert on transactions
  for each row execute function snapshot_transaction_attribution();

-- Preserve write_audit_log's signature so all existing audit triggers continue
-- to work, while recording physical and effective identities separately.
alter table audit_logs
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists effective_user_id uuid references auth.users(id) on delete set null,
  add column if not exists delegation_id uuid references cashier_delegations(id) on delete set null;

create index if not exists audit_logs_delegation_idx
  on audit_logs (delegation_id, created_at desc)
  where delegation_id is not null;

create or replace function write_audit_log(
  p_store_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or p_store_id is null then return; end if;

  insert into audit_logs (
    store_id, user_id, actor_user_id, effective_user_id, delegation_id,
    action, entity_type, entity_id, metadata
  ) values (
    p_store_id, actor_id, actor_id, current_effective_user_id(), current_delegation_id(),
    left(coalesce(p_action, 'unknown'), 100),
    left(coalesce(p_entity_type, 'unknown'), 100),
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Normalize SECURITY DEFINER ownership before applying the final ACLs.
alter function current_auth_session_id() owner to postgres;
alter function current_cashier_delegation() owner to postgres;
alter function current_delegation_id() owner to postgres;
alter function has_open_cashier_delegation() owner to postgres;
alter function current_effective_user_id() owner to postgres;
alter function current_store_id() owner to postgres;
alter function current_user_role() owner to postgres;
alter function start_cashier_delegation_for_session(uuid, uuid, uuid) owner to postgres;
alter function get_cashier_delegation_status() owner to postgres;
alter function create_transaction_with_delegation_context(jsonb, text, uuid, integer, integer, integer, integer, text, uuid) owner to postgres;
alter function end_cashier_delegation_for_session(uuid, uuid) owner to postgres;
alter function get_my_stores() owner to postgres;
alter function guard_delegated_active_store_change() owner to postgres;
alter function snapshot_transaction_attribution() owner to postgres;
alter function write_audit_log(uuid, text, text, uuid, jsonb) owner to postgres;

grant select, insert, update, delete on cashier_delegations to postgres;
revoke all on cashier_delegations from public, anon, authenticated;

revoke execute on function current_auth_session_id() from public, anon, authenticated, service_role;
revoke execute on function current_cashier_delegation() from public, anon, authenticated, service_role;
revoke execute on function current_delegation_id() from public, anon, authenticated, service_role;
revoke execute on function current_effective_user_id() from public, anon, authenticated, service_role;
revoke execute on function snapshot_transaction_attribution() from public, anon, authenticated, service_role;
revoke execute on function guard_delegated_active_store_change() from public, anon, authenticated, service_role;
revoke execute on function write_audit_log(uuid, text, text, uuid, jsonb) from public, anon, authenticated;

revoke execute on function current_store_id() from public, anon;
revoke execute on function current_user_role() from public, anon;
grant execute on function current_store_id() to authenticated, service_role;
grant execute on function current_user_role() to authenticated, service_role;
revoke execute on function has_open_cashier_delegation() from public, anon;
grant execute on function has_open_cashier_delegation() to authenticated, service_role;

revoke execute on function start_cashier_delegation_for_session(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke execute on function get_cashier_delegation_status() from public, anon;
revoke execute on function create_transaction_with_delegation_context(jsonb, text, uuid, integer, integer, integer, integer, text, uuid)
  from public, anon;
revoke execute on function end_cashier_delegation_for_session(uuid, uuid)
  from public, anon, authenticated;
grant execute on function start_cashier_delegation_for_session(uuid, uuid, uuid) to service_role;
grant execute on function get_cashier_delegation_status() to authenticated;
grant execute on function create_transaction_with_delegation_context(jsonb, text, uuid, integer, integer, integer, integer, text, uuid)
  to authenticated;
grant execute on function end_cashier_delegation_for_session(uuid, uuid) to service_role;

comment on table cashier_delegations is
  'Owner JWT sessions temporarily operating with an approved cashier effective identity.';
comment on column transactions.actor_user_id is
  'Physical authenticated user that created the transaction.';
comment on column transactions.effective_user_id is
  'Effective owner or delegated cashier at transaction creation.';
comment on column transactions.delegation_id is
  'Delegation active when the transaction was created, if any.';
