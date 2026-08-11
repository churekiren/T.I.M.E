-- T.I.M.E. audited field-operation primitives
begin;

alter table public.registration_tokens drop constraint if exists registration_tokens_purpose_check;
alter table public.registration_tokens add constraint registration_tokens_purpose_check
check (purpose in ('FIRST_REGISTRATION','MISSION_ACCESS','EMBLEM_REVISION'));

create table if not exists public.audit_logs(
  id uuid primary key default gen_random_uuid(), actor_user_id uuid not null references auth.users(id),
  action text not null,target_type text not null,target_id text not null,
  before_data jsonb,after_data jsonb,session_id text references public.sessions(id),created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon,authenticated;
grant select on public.audit_logs to authenticated;
drop policy if exists "audit_owner_admin_read" on public.audit_logs;
create policy "audit_owner_admin_read" on public.audit_logs for select to authenticated using(public.has_staff_role(array['OWNER','ADMIN']));

create or replace function public.correct_agent_codename(p_agent_id text,p_codename text,p_session_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_agent public.agents%rowtype;v_before text;
begin
 if not public.has_permission('agents.correct_basic') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
 if upper(trim(p_codename))!~'^[A-Z]{2,18}$' then raise exception using errcode='22023',message='CODENAME_INVALID';end if;
 select * into v_agent from public.agents where permanent_agent_id=upper(trim(p_agent_id)) for update;
 if not found then raise exception using errcode='22023',message='AGENT_NOT_FOUND';end if;
 v_before:=v_agent.codename;update public.agents set codename=upper(trim(p_codename)) where id=v_agent.id;
 insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data,session_id)
 values(auth.uid(),'AGENT_CODENAME_CORRECTED','AGENT',v_agent.id::text,jsonb_build_object('codename',v_before),jsonb_build_object('codename',upper(trim(p_codename))),p_session_id);
 return jsonb_build_object('id',v_agent.permanent_agent_id,'codename',upper(trim(p_codename)));
end;$$;

create or replace function public.create_emblem_revision_token(p_agent_id text,p_session_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_agent public.agents%rowtype;v_enrollment public.enrollments%rowtype;v_raw text;v_token public.registration_tokens%rowtype;
begin
 if not public.has_permission('emblems.revision_once') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
 select * into v_agent from public.agents where permanent_agent_id=upper(trim(p_agent_id));if not found then raise exception using errcode='22023',message='AGENT_NOT_FOUND';end if;
 select * into v_enrollment from public.enrollments where agent_id=v_agent.id and session_id=p_session_id;if not found then raise exception using errcode='22023',message='ENROLLMENT_NOT_FOUND';end if;
 update public.registration_tokens set status='REVOKED' where agent_id=v_agent.id and purpose='EMBLEM_REVISION' and status='UNUSED';
 v_raw:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.registration_tokens(token_hash,short_code,session_id,agent_id,enrollment_id,purpose,status,expires_at)
 values(encode(extensions.digest(convert_to(v_raw,'UTF8'),'sha256'),'hex'),'REV-'||lpad(nextval('public.registration_short_code_seq')::text,4,'0'),p_session_id,v_agent.id,v_enrollment.id,'EMBLEM_REVISION','UNUSED',now()+interval '20 minutes') returning * into v_token;
 insert into public.audit_logs(actor_user_id,action,target_type,target_id,after_data,session_id) values(auth.uid(),'EMBLEM_REVISION_OPENED','AGENT',v_agent.id::text,jsonb_build_object('tokenId',v_token.id,'expiresAt',v_token.expires_at),p_session_id);
 return jsonb_build_object('id',v_token.id,'rawToken',v_raw,'shortCode',v_token.short_code,'expiresAt',v_token.expires_at);
end;$$;

create or replace function public.reissue_mission_access_token(p_agent_id text,p_session_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_agent public.agents%rowtype;v_enrollment public.enrollments%rowtype;v_raw text;v_token public.registration_tokens%rowtype;
begin
 if not public.has_permission('tokens.reissue') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
 select * into v_agent from public.agents where permanent_agent_id=upper(trim(p_agent_id));if not found then raise exception using errcode='22023',message='AGENT_NOT_FOUND';end if;
 select * into v_enrollment from public.enrollments where agent_id=v_agent.id and session_id=p_session_id;if not found then raise exception using errcode='22023',message='ENROLLMENT_NOT_FOUND';end if;
 update public.registration_tokens set status='REVOKED' where agent_id=v_agent.id and session_id=p_session_id and status in('UNUSED','USED');
 v_raw:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.registration_tokens(token_hash,short_code,session_id,agent_id,enrollment_id,purpose,status,used_at)
 values(encode(extensions.digest(convert_to(v_raw,'UTF8'),'sha256'),'hex'),'REG-'||lpad(nextval('public.registration_short_code_seq')::text,4,'0'),p_session_id,v_agent.id,v_enrollment.id,'MISSION_ACCESS','USED',now()) returning * into v_token;
 insert into public.audit_logs(actor_user_id,action,target_type,target_id,after_data,session_id) values(auth.uid(),'MISSION_ACCESS_REISSUED','AGENT',v_agent.id::text,jsonb_build_object('tokenId',v_token.id),p_session_id);
 return jsonb_build_object('id',v_token.id,'rawToken',v_raw,'shortCode',v_token.short_code);
end;$$;

revoke all on function public.correct_agent_codename(text,text,text),public.create_emblem_revision_token(text,text),public.reissue_mission_access_token(text,text) from public,anon,authenticated;
grant execute on function public.correct_agent_codename(text,text,text),public.create_emblem_revision_token(text,text),public.reissue_mission_access_token(text,text) to authenticated;
commit;
