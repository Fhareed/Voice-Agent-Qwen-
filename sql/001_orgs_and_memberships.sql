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
create policy "members can view their org"
    on public.organizations for select
    to authenticated
    using (public.is_org_member(id));

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
