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
