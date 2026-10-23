-- 005_org_settings.sql
-- Per-org settings blob (business profile, phone number, hours, voice, etc.)
-- Run this once in the Supabase SQL editor.

create table if not exists public.org_settings (
    org_id      uuid primary key references public.organizations(id) on delete cascade,
    data        jsonb not null default '{}'::jsonb,
    updated_at  timestamptz not null default now()
);

alter table public.org_settings enable row level security;

-- The backend connects with a privileged role and scopes by org in code; RLS is
-- the safety net so a member can only ever see/change their own org's settings.
drop policy if exists org_settings_rw on public.org_settings;
create policy org_settings_rw on public.org_settings
    for all
    using (exists (select 1 from public.memberships m
                   where m.org_id = org_settings.org_id and m.user_id = auth.uid()))
    with check (exists (select 1 from public.memberships m
                        where m.org_id = org_settings.org_id and m.user_id = auth.uid()));
