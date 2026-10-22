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
