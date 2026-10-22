-- ============================================================
--  Map a dialed phone number -> the business (org) that owns it.
--
--  When a real call comes in through Retell, the post-call webhook needs to
--  know WHICH business the call was for. Retell gives us the dialed number
--  (to_number); this table turns that number into an org_id.
--
--  First customer shortcut: you can skip this table entirely and set the env
--  var RETELL_DEFAULT_ORG_ID to your one org's id. The webhook falls back to it
--  whenever the dialed number isn't found here. Add rows here once you have more
--  than one business live.
--
--  Run once in the Supabase SQL editor. Additive and safe to re-run.
-- ============================================================

create table if not exists public.org_phone_numbers (
    phone_e164  text primary key,                         -- e.g. '+358401234567'
    org_id      uuid not null references public.organizations(id) on delete cascade,
    label       text,                                     -- optional note, e.g. "PriceVilla main line"
    created_at  timestamptz not null default now()
);

create index if not exists org_phone_numbers_org_idx
    on public.org_phone_numbers (org_id);

-- RLS backstop (the backend connects with a privileged role and scopes in code).
alter table public.org_phone_numbers enable row level security;

drop policy if exists org_phone_numbers_member_r on public.org_phone_numbers;
create policy org_phone_numbers_member_r on public.org_phone_numbers
    for select
    using (exists (select 1 from public.memberships m
                   where m.org_id = org_phone_numbers.org_id and m.user_id = auth.uid()));
