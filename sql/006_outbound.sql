-- Outbound calling: campaigns + their call targets.
-- A campaign is a list of people to ring with one goal/script; each target is one
-- person on that list plus the outcome of their call. Mirrors call_logs' tenant
-- scoping + RLS. Run once in the Supabase SQL editor.

create table if not exists outbound_campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  name        text not null,
  goal        text not null default '',      -- what this campaign is for
  script      text not null default '',      -- how the agent should talk / what to ask
  status      text not null default 'draft', -- 'draft' | 'running' | 'done'
  from_number text not null default '',       -- the Retell number we dial out from
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists outbound_campaigns_org_created_idx
  on outbound_campaigns (org_id, created_at desc);

create table if not exists outbound_targets (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references outbound_campaigns(id) on delete cascade,
  org_id       uuid not null references organizations(id) on delete cascade,
  name         text not null default '',
  phone        text not null,                    -- E.164
  status       text not null default 'pending',  -- pending|calling|completed|failed|no_answer
  call_id      text,                             -- Retell call id once dialed
  outcome      text,                             -- post-call summary
  transcript   text not null default '',
  duration_sec integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists outbound_targets_campaign_idx
  on outbound_targets (campaign_id, created_at);
create index if not exists outbound_targets_call_idx
  on outbound_targets (call_id);

-- Row-Level Security: a member of the org can see/alter that org's rows.
alter table outbound_campaigns enable row level security;
drop policy if exists outbound_campaigns_member_rw on outbound_campaigns;
create policy outbound_campaigns_member_rw on outbound_campaigns
  for all
  using (exists (select 1 from memberships m
                 where m.org_id = outbound_campaigns.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from memberships m
                      where m.org_id = outbound_campaigns.org_id and m.user_id = auth.uid()));

alter table outbound_targets enable row level security;
drop policy if exists outbound_targets_member_rw on outbound_targets;
create policy outbound_targets_member_rw on outbound_targets
  for all
  using (exists (select 1 from memberships m
                 where m.org_id = outbound_targets.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from memberships m
                      where m.org_id = outbound_targets.org_id and m.user_id = auth.uid()));
