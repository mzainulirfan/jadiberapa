-- Carts (per-user cart persisted across devices)
create table if not exists carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]',
  updated_at timestamptz default now()
);

alter table carts enable row level security;

drop policy if exists "cart_own" on carts;
create policy "cart_own" on carts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Enable realtime for live cross-device sync
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'carts'
  ) then
    alter publication supabase_realtime add table public.carts;
  end if;
end $$;
