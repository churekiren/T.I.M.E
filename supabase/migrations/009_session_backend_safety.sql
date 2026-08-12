-- Session backend safety contracts.
-- Session identifiers are permanent. Creation and update are intentionally
-- separate operations so a duplicate create can never overwrite a session.
begin;

create or replace function public.create_session(
  p_id text,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := upper(trim(coalesce(p_id, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_status text := upper(trim(coalesce(p_status, '')));
  v_session public.sessions%rowtype;
begin
  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  if v_id !~ '^[A-Z0-9][A-Z0-9-]{2,39}$' then
    raise exception using errcode = '22023', message = 'SESSION_ID_INVALID';
  end if;
  if v_name = '' then
    raise exception using errcode = '22023', message = 'SESSION_NAME_REQUIRED';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'SESSION_DATE_RANGE_INVALID';
  end if;
  if v_status <> 'PLANNED' then
    raise exception using errcode = '22023', message = 'SESSION_INITIAL_STATUS_INVALID';
  end if;

  begin
    insert into public.sessions(id, name, start_date, end_date, status)
    values(v_id, v_name, p_start_date, p_end_date, v_status)
    returning * into v_session;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'SESSION_ID_ALREADY_EXISTS';
  end;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, after_data, session_id)
  values(auth.uid(), 'SESSION_CREATED', 'SESSION', v_session.id, to_jsonb(v_session), v_session.id);

  return jsonb_build_object(
    'id', v_session.id,
    'name', v_session.name,
    'startDate', v_session.start_date,
    'endDate', v_session.end_date,
    'status', v_session.status,
    'createdAt', v_session.created_at
  );
end;
$$;

create or replace function public.update_session(
  p_session_id text,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := upper(trim(coalesce(p_session_id, '')));
  v_name text := trim(coalesce(p_name, ''));
  v_status text := upper(trim(coalesce(p_status, '')));
  v_before public.sessions%rowtype;
  v_after public.sessions%rowtype;
begin
  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  if v_name = '' then
    raise exception using errcode = '22023', message = 'SESSION_NAME_REQUIRED';
  end if;
  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception using errcode = '22023', message = 'SESSION_DATE_RANGE_INVALID';
  end if;
  if v_status not in ('PLANNED', 'ACTIVE', 'COMPLETE', 'ARCHIVED') then
    raise exception using errcode = '22023', message = 'SESSION_STATUS_INVALID';
  end if;

  select * into v_before
  from public.sessions
  where id = v_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND';
  end if;

  if v_status <> v_before.status and not (
    (v_before.status = 'PLANNED' and v_status = 'ACTIVE') or
    (v_before.status = 'ACTIVE' and v_status = 'COMPLETE') or
    (v_before.status = 'COMPLETE' and v_status = 'ARCHIVED')
  ) then
    raise exception using errcode = '22023', message = 'SESSION_STATUS_TRANSITION_INVALID';
  end if;

  update public.sessions
  set name = v_name,
      start_date = p_start_date,
      end_date = p_end_date,
      status = v_status
  where id = v_before.id
  returning * into v_after;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data, after_data, session_id)
  values(
    auth.uid(),
    case when v_before.status = v_after.status then 'SESSION_UPDATED' else 'SESSION_LIFECYCLE_CHANGED' end,
    'SESSION',
    v_after.id,
    to_jsonb(v_before),
    to_jsonb(v_after),
    v_after.id
  );

  return jsonb_build_object(
    'id', v_after.id,
    'name', v_after.name,
    'startDate', v_after.start_date,
    'endDate', v_after.end_date,
    'status', v_after.status,
    'createdAt', v_after.created_at
  );
end;
$$;

-- Deprecated compatibility endpoint. Existing clients may continue using it
-- until the Session UI is migrated to create_session/update_session.
comment on function public.manage_session(text, text, date, date, text) is
  'DEPRECATED: use create_session for creation and update_session for updates.';

create or replace function public.manage_session(
  p_id text,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := upper(trim(coalesce(p_id, '')));
  v_status text := case upper(trim(coalesce(p_status, '')))
    when 'PREPARING' then 'PLANNED'
    else upper(trim(coalesce(p_status, '')))
  end;
  v_exists boolean;
begin
  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;

  select exists(select 1 from public.sessions where id = v_id) into v_exists;
  if v_exists then
    return public.update_session(v_id, p_name, p_start_date, p_end_date, v_status);
  end if;
  return public.create_session(v_id, p_name, p_start_date, p_end_date, v_status);
end;
$$;

create or replace function public.list_operational_sessions()
returns table(id text, name text, start_date date, end_date date, status text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('agents.read') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  return query
    select s.id, s.name, s.start_date, s.end_date, s.status, s.created_at
    from public.sessions s
    where s.status in ('PLANNED', 'ACTIVE')
    order by s.start_date desc nulls last, s.created_at desc;
end;
$$;

revoke all on function public.create_session(text, text, date, date, text),
  public.update_session(text, text, date, date, text)
  from public, anon, authenticated;
grant execute on function public.create_session(text, text, date, date, text),
  public.update_session(text, text, date, date, text)
  to authenticated;

commit;
