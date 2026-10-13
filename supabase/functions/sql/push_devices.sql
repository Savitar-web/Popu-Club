-- Tokens FCM del APK. Un usuario puede tener varios dispositivos.
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_devices_user_id_idx on public.push_devices (user_id);

alter table public.push_devices enable row level security;

drop policy if exists "push_devices_own" on public.push_devices;
create policy "push_devices_own"
  on public.push_devices
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- La función de Supabase usa service_role y no pasa por estas políticas.
grant select, insert, update, delete on public.push_devices to authenticated;
