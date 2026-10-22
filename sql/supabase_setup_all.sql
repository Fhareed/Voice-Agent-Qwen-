-- ============================================================
--  LumiDesk - one-shot Supabase setup (safe to re-run)
--  Paste this WHOLE file into Supabase -> SQL Editor -> New query -> Run.
--  Every statement is guarded, so running it again does nothing harmful
--  even if some tables/policies already exist from earlier.
-- ============================================================

-- ---------------------------------------------------------------
-- 1/5  Organizations + memberships (the multi-tenant foundation)
-- ---------------------------------------------------------------
-- ============================================================
--  Voice Agent — multi-tenant foundation (Phase 1, Step 2)
--  Organizations (tenants) + who belongs to them + their roles.
--  Run this in the Supabase SQL Editor (SQL Editor → New query → paste → Run).
-- ============================================================

-- 1) A customer company = a "tenant".
create table if not exists public.organizations (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    created_at  timestamptz not null default now()
);

-- 2) Which person belongs to which org, and their role.
--    auth.users is Supabase's built-in table of people (created at signup).
create table if not exists public.memberships (
    id          uuid primary key default gen_random_uuid(),
    org_id      uuid not null references public.organizations(id) on delete cascade,
    user_id     uuid not null references auth.users(id)          on delete cascade,
    role        text not null default 'member'
                check (role in ('owner', 'admin', 'member')),
    created_at  timestamptz not null default now(),
    unique (org_id, user_id)   -- one membership per person per org
);

create index if not exists memberships_user_idx on public.memberships(user_id);
create index if not exists memberships_org_idx  on public.memberships(org_id);

-- 3) Helper: is the logged-in user a member of a given org?
--    SECURITY DEFINER lets it read memberships without tripping the security
--    rules below (which would otherwise recurse). Standard Supabase pattern.
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1
        from public.memberships m
        where m.org_id = target_org
          and m.user_id = auth.uid()
    );
$$;

-- 4) Turn ON Row-Level Security. After this, NO row is visible unless a
--    policy below explicitly allows it. This is the tenant "wall".
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;

-- 5) The rules: you can only see orgs you belong to, and memberships
--    inside those orgs. (Who can ADD/REMOVE members comes in Step 5.)
drop policy if exists "members can view their org" on public.organizations;
create policy "members can view their org"
    on public.organizations for select
    to authenticated
    using (public.is_org_member(id));

drop policy if exists "members can view memberships in their org" on public.memberships;
create policy "members can view memberships in their org"
    on public.memberships for select
    to authenticated
    using (public.is_org_member(org_id));

-- 6) Creating an org: done via this function so it happens atomically —
--    the org is created AND the creator is made its 'owner' in one step.
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    new_org_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Must be logged in to create an organization';
    end if;

    insert into public.organizations (name)
    values (org_name)
    returning id into new_org_id;

    insert into public.memberships (org_id, user_id, role)
    values (new_org_id, auth.uid(), 'owner');

    return new_org_id;
end;
$$;

grant execute on function public.is_org_member(uuid)       to authenticated;
grant execute on function public.create_organization(text) to authenticated;

-- ---------------------------------------------------------------
-- 2/5  Bookings
-- ---------------------------------------------------------------
-- Bookings made by the voice agent.
--
-- Run this once in the Supabase SQL editor (like the other files in db/).
-- It is additive and safe to re-run (create ... if not exists).
--
-- A booking is created when the agent calls the /tools/book_appointment
-- webhook during a call. We store it here (source of truth for the dashboard)
-- and, when Google Calendar is configured, also create a real calendar event
-- and keep its id in calendar_event_id.

create table if not exists public.bookings (
    id                uuid primary key default gen_random_uuid(),
    org_id            uuid not null references public.organizations(id) on delete cascade,
    call_id           text,                 -- links back to call_logs.call_id when known
    customer_name     text not null default '',
    customer_phone    text not null default '',
    customer_email    text,
    service           text,                 -- e.g. "burst pipe", "haircut", "table for 4"
    start_ts          timestamptz not null,
    end_ts            timestamptz,
    notes             text,
    calendar_event_id text,                 -- Google Calendar event id, if created
    status            text not null default 'booked'
                        check (status in ('booked', 'cancelled', 'completed', 'no_show')),
    created_at        timestamptz not null default now()
);

-- Fast lookups for the dashboard: this org's upcoming bookings, newest first.
create index if not exists bookings_org_start_idx
    on public.bookings (org_id, start_ts desc);

-- Row-Level Security (backstop for direct Supabase-API access; the backend
-- connects with a privileged role and enforces org_id in Python).
alter table public.bookings enable row level security;

drop policy if exists bookings_member_rw on public.bookings;
create policy bookings_member_rw on public.bookings
    for all
    using (exists (select 1 from public.memberships m
                   where m.org_id = bookings.org_id and m.user_id = auth.uid()))
    with check (exists (select 1 from public.memberships m
                   where m.org_id = bookings.org_id and m.user_id = auth.uid()));

-- ---------------------------------------------------------------
-- 3/5  Call logs (the mini-CRM; one row per call)
-- ---------------------------------------------------------------
-- Call log / mini-CRM.
-- One lean row PER CALL (not per sentence) so the table stays small: we store
-- text only -- never audio. Run this once in the Supabase SQL editor.

create table if not exists call_logs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  call_id         text not null,                       -- one call = one browser session
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  transcript      text not null default '',            -- "Caller: .. / Assistant: .." lines
  summary         text,                                -- filled in when the call ends
  caller_name     text,
  caller_phone    text,
  intent          text,                                -- e.g. quote / booking / question
  is_booking      boolean not null default false,
  booking_details text,
  status          text not null default 'unresolved',  -- 'unresolved' | 'resolved'
  unique (org_id, call_id)
);

create index if not exists call_logs_org_created_idx
  on call_logs (org_id, created_at desc);

-- Row-Level Security: a member of the org can see and update that org's calls.
-- (The backend uses a privileged role and enforces scoping in code too; this is
-- the safety net, matching how organizations/memberships are protected.)
alter table call_logs enable row level security;

drop policy if exists call_logs_member_rw on call_logs;
create policy call_logs_member_rw on call_logs
  for all
  using (
    exists (select 1 from memberships m
            where m.org_id = call_logs.org_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from memberships m
            where m.org_id = call_logs.org_id and m.user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 4/5  Extra columns on call_logs for real phone calls
-- ---------------------------------------------------------------
-- ============================================================
--  Give call_logs the extra fields a REAL phone call carries.
--
--  The original call_logs table was built for the browser demo (transcript +
--  summary + extracted lead). A Retell phone call also tells us the numbers,
--  how long it lasted, the spoken language, and the direction. These columns
--  let the dashboard show the same rich call cards the demo showed, now backed
--  by the real multi-tenant database instead of JSONL files.
--
--  Run once in the Supabase SQL editor, AFTER schema_call_logs.sql.
--  Every column is added "if not exists", so this is safe to re-run.
-- ============================================================

alter table public.call_logs add column if not exists from_number  text;
alter table public.call_logs add column if not exists to_number    text;
alter table public.call_logs add column if not exists direction    text;   -- 'inbound' | 'outbound'
alter table public.call_logs add column if not exists duration_sec integer;
alter table public.call_logs add column if not exists language     text;   -- 'Finnish' | 'English' | ...
alter table public.call_logs add column if not exists started_at   timestamptz;
alter table public.call_logs add column if not exists ended_at     timestamptz;

-- ---------------------------------------------------------------
-- 5/5  Phone number -> business map (for routing live calls)
-- ---------------------------------------------------------------
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

