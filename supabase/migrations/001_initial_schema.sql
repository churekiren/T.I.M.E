-- T.I.M.E. central data model — PHASE 1
-- Run this file once in the Supabase SQL Editor. It is intentionally safe to
-- rerun for seed/configuration statements, but do not treat it as a down/up reset.

begin;

create extension if not exists pgcrypto with schema extensions;

create sequence if not exists public.agent_number_seq start 1;
create sequence if not exists public.registration_short_code_seq start 1;

create table if not exists public.sessions (
  id text primary key,
  name text not null,
  start_date date,
  end_date date,
  status text not null check (status in ('PLANNED', 'ACTIVE', 'COMPLETE', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  permanent_agent_id text unique not null,
  codename text not null check (codename ~ '^[A-Z]{2,18}$'),
  emblem_path text,
  first_registered_at timestamptz not null default now(),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  session_id text not null references public.sessions(id),
  display_agent_number text not null,
  returning_agent boolean not null default false,
  joined_at timestamptz not null default now(),
  completion_status text not null default 'ACTIVE' check (completion_status in ('ACTIVE', 'COMPLETE', 'WITHDRAWN')),
  constraint enrollments_agent_session_key unique (agent_id, session_id),
  constraint enrollments_session_number_key unique (session_id, display_agent_number)
);

create table if not exists public.registration_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null check (token_hash ~ '^[0-9a-f]{64}$'),
  short_code text unique not null,
  session_id text not null references public.sessions(id),
  agent_id uuid references public.agents(id),
  enrollment_id uuid references public.enrollments(id),
  purpose text not null default 'FIRST_REGISTRATION' check (purpose in ('FIRST_REGISTRATION', 'MISSION_ACCESS')),
  status text not null default 'UNUSED' check (status in ('UNUSED', 'USED', 'REVOKED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  expires_at timestamptz,
  constraint registration_tokens_usage_consistency check (
    (status = 'USED' and agent_id is not null and enrollment_id is not null and used_at is not null)
    or
    (status <> 'USED')
  )
);

-- One row per session makes T-xxx allocation concurrency safe.
create table if not exists public.session_counters (
  session_id text primary key references public.sessions(id) on delete cascade,
  last_value bigint not null default 0 check (last_value >= 0)
);

-- Staff membership is intentionally empty until Supabase Auth is configured.
create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Public projection for the live wall. It contains no token hashes, internal
-- agent profile fields, or historical data outside ACTIVE sessions.
create table if not exists public.wall_entries (
  enrollment_id uuid primary key references public.enrollments(id) on delete cascade,
  session_id text not null references public.sessions(id) on delete cascade,
  display_agent_number text not null,
  returning_agent boolean not null default false,
  codename text not null,
  emblem_path text,
  joined_at timestamptz not null
);

create index if not exists enrollments_session_id_idx on public.enrollments(session_id);
create index if not exists enrollments_agent_id_idx on public.enrollments(agent_id);
create index if not exists registration_tokens_agent_id_idx on public.registration_tokens(agent_id);
create index if not exists registration_tokens_session_id_idx on public.registration_tokens(session_id);
create index if not exists wall_entries_session_joined_idx on public.wall_entries(session_id, joined_at);

insert into public.sessions (id, name, start_date, end_date, status)
values ('2026-SUMMER-01', '2026 夏季第一梯', null, null, 'ACTIVE')
on conflict (id) do update set name = excluded.name, status = excluded.status;

insert into public.session_counters (session_id, last_value)
values ('2026-SUMMER-01', 0)
on conflict (session_id) do nothing;

create or replace function public.is_time_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles
    where user_id = auth.uid() and active = true
  );
$$;

create or replace function public.is_active_session(p_session_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sessions where id = p_session_id and status = 'ACTIVE'
  );
$$;

create or replace function public.can_use_emblem_token_hash(p_token_hash text, p_require_unused boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registration_tokens
    where token_hash = p_token_hash
      and (not p_require_unused or status = 'UNUSED')
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.is_registered_agent_storage_id(p_agent_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.registration_tokens
    where agent_id::text = p_agent_id and status = 'USED'
  );
$$;

create or replace function public.next_session_agent_number(p_session_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value bigint;
begin
  insert into public.session_counters (session_id, last_value)
  values (p_session_id, 1)
  on conflict (session_id)
  do update set last_value = public.session_counters.last_value + 1
  returning last_value into v_value;

  return 'T-' || lpad(v_value::text, 3, '0');
end;
$$;

create or replace function public.sync_wall_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.wall_entries (
    enrollment_id, session_id, display_agent_number, returning_agent,
    codename, emblem_path, joined_at
  )
  select new.id, new.session_id, new.display_agent_number, new.returning_agent,
         a.codename, a.emblem_path, new.joined_at
  from public.agents a where a.id = new.agent_id
  on conflict (enrollment_id) do update set
    session_id = excluded.session_id,
    display_agent_number = excluded.display_agent_number,
    returning_agent = excluded.returning_agent,
    codename = excluded.codename,
    emblem_path = excluded.emblem_path,
    joined_at = excluded.joined_at;
  return new;
end;
$$;

create or replace function public.sync_agent_wall_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.wall_entries
  set codename = new.codename, emblem_path = new.emblem_path
  where enrollment_id in (
    select e.id from public.enrollments e where e.agent_id = new.id
  );
  return new;
end;
$$;

drop trigger if exists enrollments_sync_wall on public.enrollments;
create trigger enrollments_sync_wall
after insert or update of display_agent_number, returning_agent, completion_status
on public.enrollments for each row execute function public.sync_wall_entry();

drop trigger if exists agents_sync_wall_identity on public.agents;
create trigger agents_sync_wall_identity
after update of codename, emblem_path on public.agents
for each row execute function public.sync_agent_wall_identity();

create or replace function public.inspect_registration_token(p_raw_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token public.registration_tokens%rowtype;
  v_agent public.agents%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_session public.sessions%rowtype;
begin
  if p_raw_token is null or length(p_raw_token) < 32 then
    return jsonb_build_object('state', 'INVALID');
  end if;

  select * into v_token from public.registration_tokens
  where token_hash = encode(extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex');

  if not found then return jsonb_build_object('state', 'INVALID'); end if;
  if v_token.status = 'UNUSED' and v_token.expires_at is not null and v_token.expires_at <= now() then
    return jsonb_build_object('state', 'INVALID');
  end if;

  select * into v_session from public.sessions where id = v_token.session_id;

  if v_token.status = 'UNUSED' then
    return jsonb_build_object(
      'state', 'UNUSED', 'shortCode', v_token.short_code,
      'session', jsonb_build_object('id', v_session.id, 'name', v_session.name)
    );
  end if;

  if v_token.status = 'USED' then
    select * into v_agent from public.agents where id = v_token.agent_id;
    select * into v_enrollment from public.enrollments where id = v_token.enrollment_id;
    return jsonb_build_object(
      'state', 'USED', 'shortCode', v_token.short_code,
      'session', jsonb_build_object('id', v_session.id, 'name', v_session.name),
      'agent', jsonb_build_object(
        'id', v_agent.permanent_agent_id, 'codename', v_agent.codename,
        'emblemPath', v_agent.emblem_path,
        'firstRegisteredAt', v_agent.first_registered_at, 'status', v_agent.status
      ),
      'enrollment', jsonb_build_object(
        'id', v_enrollment.id, 'displayAgentNumber', v_enrollment.display_agent_number,
        'returningAgent', v_enrollment.returning_agent
      )
    );
  end if;

  return jsonb_build_object('state', 'INVALID');
end;
$$;

create or replace function public.register_new_agent(
  p_raw_token text,
  p_codename text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.registration_tokens%rowtype;
  v_agent public.agents%rowtype;
  v_enrollment public.enrollments%rowtype;
  v_permanent_id text;
  v_display_number text;
begin
  if p_raw_token is null or length(p_raw_token) < 32 then
    raise exception using errcode = '22023', message = 'ACCESS_CREDENTIAL_INVALID';
  end if;
  if upper(trim(p_codename)) !~ '^[A-Z]{2,18}$' then
    raise exception using errcode = '22023', message = 'CODENAME_INVALID';
  end if;

  select * into v_token
  from public.registration_tokens
  where token_hash = encode(extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex')
  for update;

  if not found then raise exception using errcode = '22023', message = 'ACCESS_CREDENTIAL_INVALID'; end if;
  if v_token.status <> 'UNUSED' then raise exception using errcode = 'P0001', message = 'ACCESS_CREDENTIAL_ALREADY_USED'; end if;
  if v_token.purpose <> 'FIRST_REGISTRATION' then raise exception using errcode = 'P0001', message = 'ACCESS_PURPOSE_INVALID'; end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then raise exception using errcode = 'P0001', message = 'ACCESS_CREDENTIAL_EXPIRED'; end if;
  if not exists (select 1 from public.sessions s where s.id = v_token.session_id and s.status = 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_ACTIVE';
  end if;

  v_permanent_id := 'AGENT-' || lpad(nextval('public.agent_number_seq')::text, 6, '0');
  v_display_number := public.next_session_agent_number(v_token.session_id);

  insert into public.agents (permanent_agent_id, codename)
  values (v_permanent_id, upper(trim(p_codename))) returning * into v_agent;

  insert into public.enrollments (agent_id, session_id, display_agent_number, returning_agent)
  values (v_agent.id, v_token.session_id, v_display_number, false) returning * into v_enrollment;

  update public.registration_tokens set
    agent_id = v_agent.id,
    enrollment_id = v_enrollment.id,
    status = 'USED',
    used_at = now()
  where id = v_token.id;

  return jsonb_build_object(
    'agent', jsonb_build_object(
      'internalId', v_agent.id, 'id', v_agent.permanent_agent_id,
      'codename', v_agent.codename, 'status', v_agent.status,
      'firstRegisteredAt', v_agent.first_registered_at
    ),
    'enrollment', jsonb_build_object(
      'id', v_enrollment.id, 'sessionId', v_enrollment.session_id,
      'displayAgentNumber', v_enrollment.display_agent_number,
      'returningAgent', false
    )
  );
end;
$$;

create or replace function public.finalize_agent_emblem(p_raw_token text, p_emblem_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.registration_tokens%rowtype;
begin
  select * into v_token from public.registration_tokens
  where token_hash = encode(extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex')
    and status = 'USED';
  if not found then raise exception using errcode = '22023', message = 'ACCESS_CREDENTIAL_INVALID'; end if;
  if p_emblem_path <> ('agents/' || v_token.agent_id::text || '/emblem.png') then
    raise exception using errcode = '22023', message = 'EMBLEM_PATH_INVALID';
  end if;
  update public.agents set emblem_path = p_emblem_path where id = v_token.agent_id;
  return jsonb_build_object('agentId', v_token.agent_id, 'emblemPath', p_emblem_path);
end;
$$;

create or replace function public.get_agent_file_by_token(p_raw_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_token public.registration_tokens%rowtype;
  v_agent public.agents%rowtype;
begin
  select * into v_token from public.registration_tokens
  where token_hash = encode(extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex')
    and status = 'USED';
  if not found then return jsonb_build_object('state', 'INVALID'); end if;
  select * into v_agent from public.agents where id = v_token.agent_id;
  return jsonb_build_object(
    'state', 'USED',
    'authorizedSessionId', v_token.session_id,
    'agent', jsonb_build_object(
      'id', v_agent.permanent_agent_id, 'codename', v_agent.codename,
      'emblemPath', v_agent.emblem_path,
      'firstRegisteredAt', v_agent.first_registered_at, 'status', v_agent.status
    ),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollmentId', e.id, 'sessionId', s.id, 'sessionName', s.name,
        'displayAgentNumber', e.display_agent_number,
        'returningAgent', e.returning_agent, 'joinedAt', e.joined_at,
        'completionStatus', e.completion_status
      ) order by e.joined_at)
      from public.enrollments e join public.sessions s on s.id = e.session_id
      where e.agent_id = v_agent.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.get_session_wall(p_session_id text)
returns table (
  enrollment_id uuid,
  display_agent_number text,
  returning_agent boolean,
  codename text,
  emblem_path text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.enrollment_id, w.display_agent_number, w.returning_agent,
         w.codename, w.emblem_path, w.joined_at
  from public.wall_entries w
  join public.sessions s on s.id = w.session_id
  where w.session_id = p_session_id and s.status = 'ACTIVE'
  order by w.joined_at;
$$;

create or replace function public.create_registration_tokens(p_session_id text, p_count integer)
returns table (id uuid, raw_token text, short_code text, session_id text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_index integer;
  v_raw text;
  v_row public.registration_tokens%rowtype;
begin
  if not public.is_time_staff() then raise exception using errcode = '42501', message = 'STAFF_AUTH_REQUIRED'; end if;
  if p_count < 1 or p_count > 100 then raise exception using errcode = '22023', message = 'TOKEN_COUNT_INVALID'; end if;
  if not exists (select 1 from public.sessions s where s.id = p_session_id) then raise exception using errcode = '22023', message = 'SESSION_NOT_FOUND'; end if;
  for v_index in 1..p_count loop
    v_raw := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.registration_tokens (token_hash, short_code, session_id)
    values (
      encode(extensions.digest(convert_to(v_raw, 'UTF8'), 'sha256'), 'hex'),
      'REG-' || lpad(nextval('public.registration_short_code_seq')::text, 4, '0'),
      p_session_id
    ) returning * into v_row;
    id := v_row.id; raw_token := v_raw; short_code := v_row.short_code;
    session_id := v_row.session_id; status := v_row.status; created_at := v_row.created_at;
    return next;
  end loop;
end;
$$;

create or replace function public.register_returning_agent(p_permanent_agent_id text, p_session_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent public.agents%rowtype;
  v_enrollment public.enrollments%rowtype;
begin
  if not public.is_time_staff() then raise exception using errcode = '42501', message = 'STAFF_AUTH_REQUIRED'; end if;
  select * into v_agent from public.agents where permanent_agent_id = upper(trim(p_permanent_agent_id));
  if not found then raise exception using errcode = '22023', message = 'AGENT_NOT_FOUND'; end if;
  insert into public.enrollments (agent_id, session_id, display_agent_number, returning_agent)
  values (v_agent.id, p_session_id, public.next_session_agent_number(p_session_id), true)
  returning * into v_enrollment;
  return jsonb_build_object(
    'agent', jsonb_build_object('id', v_agent.permanent_agent_id, 'codename', v_agent.codename, 'emblemPath', v_agent.emblem_path),
    'enrollment', jsonb_build_object('id', v_enrollment.id, 'displayAgentNumber', v_enrollment.display_agent_number, 'sessionId', v_enrollment.session_id, 'returningAgent', true)
  );
exception when unique_violation then
  raise exception using errcode = '23505', message = 'AGENT_ALREADY_ENROLLED';
end;
$$;

-- Private bucket: reads are delivered with signed URLs in PHASE 2. PNG only,
-- maximum 2 MB after EmblemCapture processing.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-emblems', 'agent-emblems', false, 2097152, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/png'];

alter table public.sessions enable row level security;
alter table public.agents enable row level security;
alter table public.enrollments enable row level security;
alter table public.registration_tokens enable row level security;
alter table public.session_counters enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.wall_entries enable row level security;

revoke all on public.sessions, public.agents, public.enrollments, public.registration_tokens,
  public.session_counters, public.staff_profiles, public.wall_entries from anon, authenticated;
grant select, insert, update, delete on public.sessions, public.agents, public.enrollments,
  public.registration_tokens, public.staff_profiles to authenticated;
grant select on public.wall_entries to anon, authenticated;

drop policy if exists "staff_manage_sessions" on public.sessions;
create policy "staff_manage_sessions" on public.sessions for all to authenticated using (public.is_time_staff()) with check (public.is_time_staff());
drop policy if exists "staff_manage_agents" on public.agents;
create policy "staff_manage_agents" on public.agents for all to authenticated using (public.is_time_staff()) with check (public.is_time_staff());
drop policy if exists "staff_manage_enrollments" on public.enrollments;
create policy "staff_manage_enrollments" on public.enrollments for all to authenticated using (public.is_time_staff()) with check (public.is_time_staff());
drop policy if exists "staff_manage_registration_tokens" on public.registration_tokens;
create policy "staff_manage_registration_tokens" on public.registration_tokens for all to authenticated using (public.is_time_staff()) with check (public.is_time_staff());
drop policy if exists "staff_manage_staff_profiles" on public.staff_profiles;
create policy "staff_manage_staff_profiles" on public.staff_profiles for all to authenticated using (public.is_time_staff()) with check (public.is_time_staff());
drop policy if exists "active_session_wall_entries" on public.wall_entries;
create policy "active_session_wall_entries" on public.wall_entries for select to anon, authenticated using (
  public.is_active_session(session_id)
);

-- Temporary uploads are namespaced by SHA-256(raw token):
-- temporary/{token_hash}/{random}.png
drop policy if exists "token_holder_upload_temporary_emblem" on storage.objects;
create policy "token_holder_upload_temporary_emblem" on storage.objects
for insert to anon, authenticated with check (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'temporary'
  and lower(storage.extension(name)) = 'png'
  and public.can_use_emblem_token_hash((storage.foldername(name))[2], true)
);

drop policy if exists "token_holder_read_temporary_emblem" on storage.objects;
create policy "token_holder_read_temporary_emblem" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'temporary'
  and public.can_use_emblem_token_hash((storage.foldername(name))[2], false)
);

drop policy if exists "token_holder_delete_temporary_emblem" on storage.objects;
create policy "token_holder_delete_temporary_emblem" on storage.objects
for delete to anon, authenticated using (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'temporary'
  and public.can_use_emblem_token_hash((storage.foldername(name))[2], false)
);

drop policy if exists "registered_agent_upload_final_emblem" on storage.objects;
create policy "registered_agent_upload_final_emblem" on storage.objects
for insert to anon, authenticated with check (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'agents'
  and name = ('agents/' || (storage.foldername(name))[2] || '/emblem.png')
  and public.is_registered_agent_storage_id((storage.foldername(name))[2])
);

drop policy if exists "registered_agent_read_final_emblem" on storage.objects;
create policy "registered_agent_read_final_emblem" on storage.objects
for select to anon, authenticated using (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'agents'
  and public.is_registered_agent_storage_id((storage.foldername(name))[2])
);

drop policy if exists "registered_agent_cleanup_final_emblem" on storage.objects;
create policy "registered_agent_cleanup_final_emblem" on storage.objects
for delete to anon, authenticated using (
  bucket_id = 'agent-emblems'
  and (storage.foldername(name))[1] = 'agents'
  and public.is_registered_agent_storage_id((storage.foldername(name))[2])
);

drop policy if exists "staff_manage_emblem_objects" on storage.objects;
create policy "staff_manage_emblem_objects" on storage.objects
for all to authenticated using (bucket_id = 'agent-emblems' and public.is_time_staff())
with check (bucket_id = 'agent-emblems' and public.is_time_staff());

revoke all on function public.is_time_staff() from public, anon, authenticated;
grant execute on function public.is_time_staff() to authenticated;
revoke all on function public.is_active_session(text) from public, anon, authenticated;
grant execute on function public.is_active_session(text) to anon, authenticated;
revoke all on function public.can_use_emblem_token_hash(text, boolean) from public, anon, authenticated;
grant execute on function public.can_use_emblem_token_hash(text, boolean) to anon, authenticated;
revoke all on function public.is_registered_agent_storage_id(text) from public, anon, authenticated;
grant execute on function public.is_registered_agent_storage_id(text) to anon, authenticated;
revoke all on function public.next_session_agent_number(text) from public, anon, authenticated;
revoke all on function public.sync_wall_entry() from public, anon, authenticated;
revoke all on function public.sync_agent_wall_identity() from public, anon, authenticated;

revoke all on function public.inspect_registration_token(text) from public, anon, authenticated;
grant execute on function public.inspect_registration_token(text) to anon, authenticated;
revoke all on function public.register_new_agent(text, text) from public, anon, authenticated;
grant execute on function public.register_new_agent(text, text) to anon, authenticated;
revoke all on function public.finalize_agent_emblem(text, text) from public, anon, authenticated;
grant execute on function public.finalize_agent_emblem(text, text) to anon, authenticated;
revoke all on function public.get_agent_file_by_token(text) from public, anon, authenticated;
grant execute on function public.get_agent_file_by_token(text) to anon, authenticated;
revoke all on function public.get_session_wall(text) from public, anon, authenticated;
grant execute on function public.get_session_wall(text) to anon, authenticated;
revoke all on function public.create_registration_tokens(text, integer) from public, anon, authenticated;
grant execute on function public.create_registration_tokens(text, integer) to authenticated;
revoke all on function public.register_returning_agent(text, text) from public, anon, authenticated;
grant execute on function public.register_returning_agent(text, text) to authenticated;

-- Realtime publishes only the minimal wall projection, never agents or tokens.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wall_entries'
  ) then
    alter publication supabase_realtime add table public.wall_entries;
  end if;
end $$;

commit;
