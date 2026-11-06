-- Support messages, threaded. Replaces the one-shot (message + single admin_reply)
-- model from 007 with a message-per-row model so a customer and the LumiDesk team
-- can go back and forth continuously. A "thread" is every row sharing thread_id,
-- ordered by created_at; the first row (sender='customer') carries the subject.
-- Thread status is derived from the last message's sender, not stored.
--
-- NOTE: this drops the old support_messages table (and its test rows) and rebuilds
-- it. Safe pre-launch; run it before clean_reset_data.sql.

drop table if exists public.support_messages cascade;

create table public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null,
  org_id      uuid references public.organizations(id) on delete set null,
  user_id     uuid,
  email       text,
  subject     text,
  sender      text not null,              -- 'customer' | 'admin'
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists support_messages_thread_idx  on public.support_messages (thread_id);
create index if not exists support_messages_org_idx     on public.support_messages (org_id);
create index if not exists support_messages_created_idx  on public.support_messages (created_at desc);
