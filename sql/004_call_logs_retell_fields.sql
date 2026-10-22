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
