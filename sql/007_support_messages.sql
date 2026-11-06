-- Support / contact messages: a customer writes to the LumiDesk team from inside
-- the app, and the founder reads + replies from the admin dashboard. One row per
-- message; the admin reply lives on the same row (a simple one-reply thread).

create table if not exists support_messages (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references organizations(id) on delete set null,
  user_id     uuid,
  email       text,
  subject     text,
  message     text not null,
  admin_reply text,
  status      text not null default 'open',   -- open | replied | closed
  created_at  timestamptz not null default now(),
  replied_at  timestamptz
);

create index if not exists support_messages_org_idx    on support_messages (org_id);
create index if not exists support_messages_status_idx on support_messages (status);
create index if not exists support_messages_created_idx on support_messages (created_at desc);
