-- ============================================================================
-- CLEAN RESET — remove all test / mock businesses, KEEP the demo org (DEV).
-- ============================================================================
-- Review before running. This DELETES every organization EXCEPT the demo org
-- (your Numidex / Retell default), along with all data tied to the deleted
-- orgs (calls, bookings, numbers, settings, outbound, support, memberships).
-- The admin dashboard metrics reset to just the demo org afterward.
--
-- Run it in the Supabase SQL editor (paste + Run), or:
--     psql "$DATABASE_URL" -f sql/clean_reset_data.sql
--
-- IMPORTANT:
--   • Run the support migration (008) FIRST if you haven't — this assumes the
--     current support schema.
--   • KEEP id below = RETELL_DEFAULT_ORG_ID (your demo). Double-check it against
--     the demo org's "Org ID" on the admin dashboard before running.
--   • Login accounts live in Supabase Auth (auth.users), NOT here. Wiping orgs
--     does not delete logins — see the note at the very bottom.
--   • Landing-page "leads" are stored in a flat file on the server, not the DB,
--     so they are untouched by this script.
-- ============================================================================

-- ── KEEP THE DEMO ORG, DELETE EVERYTHING ELSE (default) ─────────────────────
begin;

  create temp table keep_orgs on commit drop as
    select id from public.organizations
    where id in (
      'a98dfa4e-e1a8-4317-8cfe-a59180b15d3f'   -- demo org (RETELL_DEFAULT_ORG_ID)
      -- , 'another-org-id-to-also-keep'
    );

  delete from public.support_messages   where org_id not in (select id from keep_orgs);
  delete from public.outbound_targets   where org_id not in (select id from keep_orgs);
  delete from public.outbound_campaigns where org_id not in (select id from keep_orgs);
  delete from public.bookings           where org_id not in (select id from keep_orgs);
  delete from public.call_logs          where org_id not in (select id from keep_orgs);
  delete from public.org_phone_numbers  where org_id not in (select id from keep_orgs);
  delete from public.org_settings       where org_id not in (select id from keep_orgs);
  delete from public.memberships        where org_id not in (select id from keep_orgs);
  delete from public.organizations      where id     not in (select id from keep_orgs);

commit;

-- Sanity check — orgs should be 1 (the demo), and the rest only its own data:
select
  (select count(*) from public.organizations)     as orgs,
  (select count(*) from public.memberships)       as members,
  (select count(*) from public.call_logs)         as calls,
  (select count(*) from public.bookings)          as bookings,
  (select count(*) from public.org_phone_numbers) as numbers,
  (select count(*) from public.support_messages)  as support;


-- ============================================================================
-- FULL-WIPE VARIANT — use THIS instead (removes the demo too) only if you want
-- a completely empty slate. Comment out the KEEP block above, uncomment this.
-- ============================================================================
-- begin;
--   delete from public.support_messages;
--   delete from public.outbound_targets;
--   delete from public.outbound_campaigns;
--   delete from public.bookings;
--   delete from public.call_logs;
--   delete from public.org_phone_numbers;
--   delete from public.org_settings;
--   delete from public.memberships;
--   delete from public.organizations;
-- commit;


-- ============================================================================
-- OPTIONAL — remove test LOGIN accounts too (Supabase Auth).
-- Safest: Supabase Dashboard → Authentication → Users → delete the test users
-- (keep the demo org's owner + your own admin login).
-- Or, by SQL (careful — permanently removes those logins):
--   delete from auth.users
--   where email in ('test1@example.com', 'test2@example.com');
-- ============================================================================
