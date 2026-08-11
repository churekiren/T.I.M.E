-- Universal first-registration credentials and field authorization waiting pool.
begin;

alter table public.registration_tokens alter column session_id drop not null;

create table if not exists public.registration_waiting_requests (
  token_id uuid primary key references public.registration_tokens(id) on delete cascade,
  requested_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  state text not null default 'WAITING' check (state in ('WAITING','AUTHORIZED','CANCELLED')),
  authorized_at timestamptz,
  authorized_by uuid references auth.users(id),
  authorized_session_id text references public.sessions(id)
);
create index if not exists registration_waiting_state_requested_idx
  on public.registration_waiting_requests(state, requested_at);

alter table public.registration_waiting_requests enable row level security;
revoke all on public.registration_waiting_requests from anon, authenticated;

create or replace function public.create_universal_registration_tokens(p_count integer)
returns table(id uuid, raw_token text, short_code text, session_id text, status text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_index integer; v_raw text; v_row public.registration_tokens%rowtype;
begin
  if not public.has_permission('tokens.manage') then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
  if p_count < 1 or p_count > 500 then raise exception using errcode='22023',message='TOKEN_COUNT_INVALID'; end if;
  for v_index in 1..p_count loop
    v_raw := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.registration_tokens(token_hash,short_code,session_id,purpose,status)
    values(encode(extensions.digest(convert_to(v_raw,'UTF8'),'sha256'),'hex'),
      'REG-'||lpad(nextval('public.registration_short_code_seq')::text,4,'0'),null,'FIRST_REGISTRATION','UNUSED')
    returning * into v_row;
    id:=v_row.id;raw_token:=v_raw;short_code:=v_row.short_code;session_id:=null;status:=v_row.status;created_at:=v_row.created_at;
    return next;
  end loop;
end;$$;

create or replace function public.request_registration_waiting(p_raw_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.registration_tokens%rowtype; v_request public.registration_waiting_requests%rowtype;
begin
  if p_raw_token is null or length(p_raw_token)<32 then return jsonb_build_object('state','INVALID');end if;
  select * into v_token from public.registration_tokens
    where token_hash=encode(extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256'),'hex') for update;
  if not found or v_token.purpose<>'FIRST_REGISTRATION' or v_token.status<>'UNUSED'
    or v_token.session_id is not null or (v_token.expires_at is not null and v_token.expires_at<=now()) then
    return jsonb_build_object('state','INVALID');
  end if;
  insert into public.registration_waiting_requests(token_id,requested_at,last_seen_at,expires_at,state)
  values(v_token.id,now(),now(),now()+interval '8 hours','WAITING')
  on conflict(token_id) do update set
    last_seen_at=now(),
    requested_at=case when public.registration_waiting_requests.state='CANCELLED' or public.registration_waiting_requests.expires_at<=now() then now() else public.registration_waiting_requests.requested_at end,
    expires_at=case when public.registration_waiting_requests.state='CANCELLED' or public.registration_waiting_requests.expires_at<=now() then now()+interval '8 hours' else public.registration_waiting_requests.expires_at end,
    state='WAITING',authorized_at=null,authorized_by=null,authorized_session_id=null
  returning * into v_request;
  return jsonb_build_object('state','WAITING','shortCode',v_token.short_code,'requestedAt',v_request.requested_at,'expiresAt',v_request.expires_at);
end;$$;

create or replace function public.inspect_registration_token(p_raw_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_token public.registration_tokens%rowtype;v_agent public.agents%rowtype;v_enrollment public.enrollments%rowtype;v_session public.sessions%rowtype;
begin
  if p_raw_token is null or length(p_raw_token)<32 then return jsonb_build_object('state','INVALID');end if;
  select * into v_token from public.registration_tokens where token_hash=encode(extensions.digest(convert_to(p_raw_token,'UTF8'),'sha256'),'hex');
  if not found then return jsonb_build_object('state','INVALID');end if;
  if v_token.status='UNUSED' and v_token.expires_at is not null and v_token.expires_at<=now() then return jsonb_build_object('state','INVALID');end if;
  if v_token.status='UNUSED' and v_token.session_id is null then
    return jsonb_build_object('state','UNASSIGNED','shortCode',v_token.short_code);
  end if;
  select * into v_session from public.sessions where id=v_token.session_id;
  if v_token.status='UNUSED' then
    if v_session.status<>'ACTIVE' then return jsonb_build_object('state','CLOSED','shortCode',v_token.short_code,'session',jsonb_build_object('id',v_session.id,'name',v_session.name));end if;
    return jsonb_build_object('state','UNUSED','shortCode',v_token.short_code,'session',jsonb_build_object('id',v_session.id,'name',v_session.name));
  end if;
  if v_token.status='USED' then
    select * into v_agent from public.agents where id=v_token.agent_id;
    select * into v_enrollment from public.enrollments where id=v_token.enrollment_id;
    return jsonb_build_object('state','USED','shortCode',v_token.short_code,
      'session',jsonb_build_object('id',v_session.id,'name',v_session.name),
      'agent',jsonb_build_object('id',v_agent.permanent_agent_id,'codename',v_agent.codename,'emblemPath',v_agent.emblem_path,'firstRegisteredAt',v_agent.first_registered_at,'status',v_agent.status),
      'enrollment',jsonb_build_object('id',v_enrollment.id,'displayAgentNumber',v_enrollment.display_agent_number,'returningAgent',v_enrollment.returning_agent));
  end if;
  return jsonb_build_object('state','INVALID');
end;$$;

create or replace function public.list_registration_waiting_pool()
returns table(token_id uuid,short_code text,requested_at timestamptz,last_seen_at timestamptz,waiting_seconds bigint,state text)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(public.current_staff_role(),'') not in ('OWNER','ADMIN','STAFF') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  return query select r.token_id,t.short_code,r.requested_at,r.last_seen_at,
    greatest(0,extract(epoch from(now()-r.requested_at))::bigint),r.state
    from public.registration_waiting_requests r join public.registration_tokens t on t.id=r.token_id
    where r.state='WAITING' and r.expires_at>now() and t.status='UNUSED' and t.session_id is null and t.purpose='FIRST_REGISTRATION'
    order by r.requested_at;
end;$$;

create or replace function public.authorize_registration_waiting(p_token_ids uuid[],p_target_session_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_authorized jsonb;v_count integer;
begin
  if coalesce(public.current_staff_role(),'') not in ('OWNER','ADMIN','STAFF') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  if not exists(select 1 from public.sessions where id=p_target_session_id and status='ACTIVE') then raise exception using errcode='22023',message='SESSION_NOT_ACTIVE';end if;
  if coalesce(array_length(p_token_ids,1),0)<1 or array_length(p_token_ids,1)>500 then raise exception using errcode='22023',message='SELECTION_INVALID';end if;
  with candidates as (
    select r.token_id from public.registration_waiting_requests r
    where r.token_id=any(p_token_ids) and r.state='WAITING' and r.expires_at>now() for update
  ), updated as (
    update public.registration_tokens t set session_id=p_target_session_id
    from candidates c where t.id=c.token_id and t.status='UNUSED' and t.session_id is null and t.purpose='FIRST_REGISTRATION'
    returning t.id,t.short_code
  ), marked as (
    update public.registration_waiting_requests r set state='AUTHORIZED',authorized_at=now(),authorized_by=auth.uid(),authorized_session_id=p_target_session_id
    from updated u where r.token_id=u.id returning u.id,u.short_code
  ) select count(*),coalesce(jsonb_agg(short_code order by short_code),'[]'::jsonb) into v_count,v_authorized from marked;
  if v_count>0 then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,after_data,session_id)
    values(auth.uid(),'REGISTRATION_CREDENTIALS_AUTHORIZED','REGISTRATION_BATCH',extensions.gen_random_uuid()::text,
      jsonb_build_object('authorizedCount',v_count,'shortCodes',v_authorized),p_target_session_id);
  end if;
  return jsonb_build_object('authorizedCount',v_count,'targetSessionId',p_target_session_id,'shortCodes',v_authorized,'skippedCount',array_length(p_token_ids,1)-v_count);
end;$$;

create or replace function public.cancel_registration_waiting(p_token_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if coalesce(public.current_staff_role(),'') not in ('OWNER','ADMIN','STAFF') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  update public.registration_waiting_requests r set state='CANCELLED'
    where r.token_id=any(p_token_ids) and r.state='WAITING'
      and exists(select 1 from public.registration_tokens t where t.id=r.token_id and t.status='UNUSED' and t.session_id is null);
  get diagnostics v_count=row_count;
  return jsonb_build_object('cancelledCount',v_count);
end;$$;

create or replace function public.release_authorized_unused_credential(p_token_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.registration_tokens%rowtype;
begin
  if coalesce(public.current_staff_role(),'') not in ('OWNER','ADMIN','STAFF') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  select * into v_token from public.registration_tokens where id=p_token_id for update;
  if not found or v_token.status<>'UNUSED' or v_token.session_id is null or v_token.agent_id is not null or v_token.enrollment_id is not null then
    raise exception using errcode='22023',message='CREDENTIAL_NOT_RELEASABLE';
  end if;
  update public.registration_tokens set session_id=null where id=v_token.id;
  update public.registration_waiting_requests set state='CANCELLED',authorized_at=null,authorized_by=null,authorized_session_id=null where token_id=v_token.id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data)
    values(auth.uid(),'AUTHORIZED_CREDENTIAL_RELEASED','REGISTRATION_TOKEN',v_token.id::text,jsonb_build_object('shortCode',v_token.short_code,'sessionId',v_token.session_id));
  return jsonb_build_object('released',true,'shortCode',v_token.short_code);
end;$$;

revoke all on function public.create_universal_registration_tokens(integer),public.request_registration_waiting(text),
  public.list_registration_waiting_pool(),public.authorize_registration_waiting(uuid[],text),
  public.cancel_registration_waiting(uuid[]),public.release_authorized_unused_credential(uuid) from public,anon,authenticated;
grant execute on function public.create_universal_registration_tokens(integer),public.list_registration_waiting_pool(),
  public.authorize_registration_waiting(uuid[],text),public.cancel_registration_waiting(uuid[]),
  public.release_authorized_unused_credential(uuid) to authenticated;
grant execute on function public.request_registration_waiting(text) to anon,authenticated;

commit;
