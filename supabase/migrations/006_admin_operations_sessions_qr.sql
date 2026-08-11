-- T.I.M.E. production administration primitives.
begin;

create or replace function public.delete_agent_permanently(p_permanent_agent_id text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_agent public.agents%rowtype;
  v_enrollment_count integer;
  v_token_count integer;
  v_token_hashes jsonb;
begin
  if public.current_staff_role() <> 'OWNER' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED';
  end if;

  lock table public.agents in access exclusive mode;
  select * into v_agent from public.agents
    where permanent_agent_id = upper(trim(p_permanent_agent_id)) for update;
  if not found then raise exception using errcode = '22023', message = 'AGENT_NOT_FOUND'; end if;

  select count(*) into v_enrollment_count from public.enrollments where agent_id = v_agent.id;
  select count(*), coalesce(jsonb_agg(token_hash), '[]'::jsonb)
    into v_token_count, v_token_hashes
    from public.registration_tokens where agent_id = v_agent.id;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data)
  values(auth.uid(), 'PERMANENT_AGENT_DELETED', 'AGENT', v_agent.id::text,
    jsonb_build_object(
      'permanentAgentId', v_agent.permanent_agent_id,
      'codename', v_agent.codename,
      'emblemPath', v_agent.emblem_path,
      'enrollmentCount', v_enrollment_count,
      'tokenCount', v_token_count
    ));
  if v_enrollment_count > 0 then
    insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data)
    values(auth.uid(), 'ENROLLMENTS_DELETED_WITH_AGENT', 'ENROLLMENT_COLLECTION', v_agent.id::text,
      jsonb_build_object('agentUuid', v_agent.id, 'enrollmentCount', v_enrollment_count));
  end if;

  update public.registration_tokens
    set status = 'REVOKED', agent_id = null, enrollment_id = null
    where agent_id = v_agent.id;
  delete from public.agents where id = v_agent.id;

  return jsonb_build_object(
    'deleted', true,
    'agentUuid', v_agent.id,
    'permanentAgentId', v_agent.permanent_agent_id,
    'emblemPath', v_agent.emblem_path,
    'tokenHashes', v_token_hashes,
    'enrollmentCount', v_enrollment_count,
    'tokenCount', v_token_count
  );
end;
$$;

create or replace function public.resequence_permanent_agent_ids()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_mapping jsonb;
begin
  if public.current_staff_role() <> 'OWNER' then
    raise exception using errcode = '42501', message = 'OWNER_REQUIRED';
  end if;

  lock table public.agents in access exclusive mode;

  with ordered as (
    select id, permanent_agent_id as before_id,
      'AGENT-' || lpad(row_number() over(order by first_registered_at, created_at, id)::text, 6, '0') as after_id
    from public.agents
  )
  select count(*), coalesce(jsonb_agg(jsonb_build_object(
    'agentUuid', id, 'before', before_id, 'after', after_id
  ) order by after_id), '[]'::jsonb)
  into v_count, v_mapping from ordered;

  update public.agents set permanent_agent_id = 'RESEQ-' || id::text;
  with ordered as (
    select id, 'AGENT-' || lpad(row_number() over(order by first_registered_at, created_at, id)::text, 6, '0') as after_id
    from public.agents
  )
  update public.agents a set permanent_agent_id = o.after_id from ordered o where a.id = o.id;

  if v_count = 0 then
    perform setval('public.agent_number_seq', 1, false);
  else
    perform setval('public.agent_number_seq', v_count, true);
  end if;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data, after_data)
  values(auth.uid(), 'PERMANENT_AGENT_IDS_RESEQUENCED', 'AGENT_COLLECTION', 'ALL',
    jsonb_build_object('affectedCount', v_count), jsonb_build_object('mapping', v_mapping));

  return jsonb_build_object('affectedCount', v_count, 'nextNumber', v_count + 1, 'mapping', v_mapping);
end;
$$;

create or replace function public.manage_session(
  p_id text, p_name text, p_start_date date, p_end_date date, p_status text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_before public.sessions%rowtype;
  v_after public.sessions%rowtype;
  v_status text := case upper(trim(p_status)) when 'PREPARING' then 'PLANNED' else upper(trim(p_status)) end;
begin
  if not public.has_permission('sessions.manage') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  if trim(coalesce(p_id, '')) !~ '^[A-Z0-9][A-Z0-9-]{2,39}$' then
    raise exception using errcode = '22023', message = 'SESSION_ID_INVALID';
  end if;
  if v_status not in ('PLANNED','ACTIVE','ARCHIVED') then
    raise exception using errcode = '22023', message = 'SESSION_STATUS_INVALID';
  end if;

  select * into v_before from public.sessions where id = upper(trim(p_id)) for update;
  insert into public.sessions(id, name, start_date, end_date, status)
  values(upper(trim(p_id)), trim(p_name), p_start_date, p_end_date, v_status)
  on conflict(id) do update set name=excluded.name, start_date=excluded.start_date,
    end_date=excluded.end_date, status=excluded.status
  returning * into v_after;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, before_data, after_data, session_id)
  values(auth.uid(), case when v_before.id is null then 'SESSION_CREATED' else 'SESSION_LIFECYCLE_CHANGED' end,
    'SESSION', v_after.id, to_jsonb(v_before), to_jsonb(v_after), v_after.id);

  return jsonb_build_object('id',v_after.id,'name',v_after.name,'startDate',v_after.start_date,
    'endDate',v_after.end_date,'status',v_after.status,'createdAt',v_after.created_at);
end;
$$;

create or replace function public.list_registration_token_metadata(p_session_id text)
returns table(id uuid, short_code text, session_id text, status text, purpose text,
  created_at timestamptz, used_at timestamptz, permanent_agent_id text, codename text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission('tokens.manage') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  return query select t.id,t.short_code,t.session_id,t.status,t.purpose,t.created_at,t.used_at,
    a.permanent_agent_id,a.codename
    from public.registration_tokens t left join public.agents a on a.id=t.agent_id
    where t.session_id=p_session_id order by t.created_at desc;
end;
$$;

create or replace function public.list_operational_sessions()
returns table(id text, name text, start_date date, end_date date, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission('agents.read') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  return query select s.id,s.name,s.start_date,s.end_date,s.status,s.created_at
    from public.sessions s order by s.start_date desc nulls last,s.created_at desc;
end;
$$;

revoke all on function public.delete_agent_permanently(text), public.resequence_permanent_agent_ids(),
  public.manage_session(text,text,date,date,text), public.list_registration_token_metadata(text)
  , public.list_operational_sessions()
  from public, anon, authenticated;
grant execute on function public.delete_agent_permanently(text), public.resequence_permanent_agent_ids(),
  public.manage_session(text,text,date,date,text), public.list_registration_token_metadata(text)
  , public.list_operational_sessions()
  to authenticated;

commit;
