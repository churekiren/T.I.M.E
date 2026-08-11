-- Staff operations security hardening.
-- OWNER = full system control; ADMIN = full operations without core destruction;
-- STAFF = field operations only.
begin;

create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.current_staff_role()
    when 'OWNER' then p_permission = any(array[
      'staff.read','staff.invite_staff','staff.manage_staff','roles.manage',
      'sessions.manage','agents.manage','agents.delete','agents.read','agents.correct_basic',
      'tokens.manage','tokens.reissue','enrollments.manage','enrollments.add',
      'emblems.manage','emblems.delete','emblems.revision_once','wall.manage','wall.read'
    ])
    when 'ADMIN' then p_permission = any(array[
      'staff.read','staff.invite_staff','staff.manage_staff',
      'sessions.manage','agents.manage','agents.read','agents.correct_basic',
      'tokens.manage','tokens.reissue','enrollments.manage','enrollments.add',
      'emblems.manage','emblems.revision_once','wall.manage','wall.read'
    ])
    when 'STAFF' then p_permission = any(array[
      'agents.read','agents.correct_basic','tokens.reissue','enrollments.add',
      'enrollments.correct_current','emblems.revision_once','wall.read'
    ])
    else false end;
$$;

create or replace function public.list_staff_profiles()
returns table(user_id uuid,email text,display_name text,role text,active boolean,created_at timestamptz,updated_at timestamptz,last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_caller_role text := public.current_staff_role();
begin
  if v_caller_role not in ('OWNER','ADMIN') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  return query select p.user_id,coalesce(p.email,u.email),p.display_name,p.role,p.active,p.created_at,p.updated_at,u.last_sign_in_at
    from public.staff_profiles p join auth.users u on u.id=p.user_id
    where v_caller_role='OWNER' or p.role='STAFF' order by p.created_at;
end;$$;

-- General Staff Management can only change ordinary STAFF access. OWNER and
-- ADMIN profiles are core accounts and cannot be changed through this RPC.
create or replace function public.update_staff_access(p_user_id uuid,p_role text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_caller_role text := public.current_staff_role();v_target public.staff_profiles%rowtype;v_updated public.staff_profiles%rowtype;
begin
  if v_caller_role not in ('OWNER','ADMIN') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  if p_user_id=auth.uid() then raise exception using errcode='42501',message='SELF_ACCESS_CHANGE_FORBIDDEN';end if;
  if p_role not in ('STAFF','ADMIN') or (p_role='ADMIN' and v_caller_role<>'OWNER') then
    raise exception using errcode='42501',message='CORE_ROLE_CHANGE_FORBIDDEN';
  end if;
  if p_role='ADMIN' and not p_active then raise exception using errcode='22023',message='CORE_ADMIN_MUST_BE_ACTIVE';end if;
  select * into v_target from public.staff_profiles where user_id=p_user_id for update;
  if not found then raise exception using errcode='22023',message='STAFF_NOT_FOUND';end if;
  if v_target.role<>'STAFF' then raise exception using errcode='42501',message='CORE_ACCOUNT_PROTECTED';end if;
  update public.staff_profiles set role=p_role,active=p_active,updated_at=now() where user_id=p_user_id returning * into v_updated;
  if v_target.role is distinct from v_updated.role then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data)
    values(auth.uid(),'STAFF_ROLE_CHANGED','STAFF_PROFILE',v_updated.user_id::text,
      jsonb_build_object('role',v_target.role,'active',v_target.active),jsonb_build_object('role',v_updated.role,'active',v_updated.active));
  end if;
  if v_target.active is distinct from v_updated.active then
    insert into public.audit_logs(actor_user_id,action,target_type,target_id,before_data,after_data)
    values(auth.uid(),case when v_updated.active then 'STAFF_REENABLED' else 'STAFF_DISABLED' end,'STAFF_PROFILE',v_updated.user_id::text,
      jsonb_build_object('role',v_target.role,'active',v_target.active),jsonb_build_object('role',v_updated.role,'active',v_updated.active));
  end if;
  return jsonb_build_object('userId',v_updated.user_id,'role',v_updated.role,'active',v_updated.active);
end;$$;

-- Called only by the invite-staff Edge Function with its server-side
-- service_role client. Profile creation and its audit event are atomic.
create or replace function public.provision_staff_invitation(p_actor_user_id uuid,p_user_id uuid,p_email text,p_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor_role text;v_existing_role text;
begin
  select role into v_actor_role from public.staff_profiles where user_id=p_actor_user_id and active=true;
  if v_actor_role not in ('OWNER','ADMIN') then raise exception using errcode='42501',message='PERMISSION_DENIED';end if;
  if p_role not in ('ADMIN','STAFF') or (v_actor_role='ADMIN' and p_role<>'STAFF') then
    raise exception using errcode='42501',message='ROLE_NOT_ALLOWED';
  end if;
  select role into v_existing_role from public.staff_profiles where user_id=p_user_id for update;
  if found and v_existing_role<>'STAFF' then raise exception using errcode='42501',message='CORE_ACCOUNT_PROTECTED';end if;
  insert into public.staff_profiles(user_id,email,role,active,updated_at)
    values(p_user_id,lower(trim(p_email)),p_role,true,now())
    on conflict(user_id) do update set email=excluded.email,role=excluded.role,active=true,updated_at=now();
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,after_data)
    values(p_actor_user_id,case when p_role='ADMIN' then 'CORE_ADMIN_INVITED' else 'STAFF_INVITED' end,
      'STAFF_PROFILE',p_user_id::text,jsonb_build_object('role',p_role,'active',true));
  return jsonb_build_object('userId',p_user_id,'role',p_role,'active',true);
end;$$;

drop policy if exists "rbac_sessions" on public.sessions;
drop policy if exists "time_sessions_select" on public.sessions;drop policy if exists "time_sessions_insert" on public.sessions;
drop policy if exists "time_sessions_update" on public.sessions;drop policy if exists "time_sessions_delete" on public.sessions;
create policy "time_sessions_select" on public.sessions for select to authenticated using(public.has_permission('agents.read'));
create policy "time_sessions_insert" on public.sessions for insert to authenticated with check(public.current_staff_role()='OWNER');
create policy "time_sessions_update" on public.sessions for update to authenticated using(public.current_staff_role()='OWNER') with check(public.current_staff_role()='OWNER');
create policy "time_sessions_delete" on public.sessions for delete to authenticated using(public.current_staff_role()='OWNER');

drop policy if exists "rbac_agents_read" on public.agents;drop policy if exists "rbac_agents_write" on public.agents;
drop policy if exists "time_agents_select" on public.agents;drop policy if exists "time_agents_update" on public.agents;
create policy "time_agents_select" on public.agents for select to authenticated using(public.has_permission('agents.read'));
create policy "time_agents_update" on public.agents for update to authenticated using(public.current_staff_role()='OWNER') with check(public.current_staff_role()='OWNER');

drop policy if exists "rbac_enrollments_read" on public.enrollments;drop policy if exists "rbac_enrollments_write" on public.enrollments;
drop policy if exists "time_enrollments_select" on public.enrollments;drop policy if exists "time_enrollments_insert" on public.enrollments;
drop policy if exists "time_enrollments_update" on public.enrollments;drop policy if exists "time_enrollments_delete" on public.enrollments;
create policy "time_enrollments_select" on public.enrollments for select to authenticated using(public.has_permission('agents.read'));
create policy "time_enrollments_insert" on public.enrollments for insert to authenticated with check(public.current_staff_role()='OWNER');
create policy "time_enrollments_update" on public.enrollments for update to authenticated using(public.current_staff_role()='OWNER') with check(public.current_staff_role()='OWNER');
create policy "time_enrollments_delete" on public.enrollments for delete to authenticated using(public.current_staff_role()='OWNER');

drop policy if exists "rbac_tokens" on public.registration_tokens;
drop policy if exists "time_tokens_select" on public.registration_tokens;drop policy if exists "time_tokens_insert" on public.registration_tokens;
drop policy if exists "time_tokens_update" on public.registration_tokens;drop policy if exists "time_tokens_delete" on public.registration_tokens;
create policy "time_tokens_select" on public.registration_tokens for select to authenticated using(public.has_permission('tokens.manage'));
create policy "time_tokens_insert" on public.registration_tokens for insert to authenticated with check(public.current_staff_role()='OWNER');
create policy "time_tokens_update" on public.registration_tokens for update to authenticated using(public.current_staff_role()='OWNER') with check(public.current_staff_role()='OWNER');
create policy "time_tokens_delete" on public.registration_tokens for delete to authenticated using(public.current_staff_role()='OWNER');

-- staff_profiles is RPC-only, preserving core-account target checks.
drop policy if exists "owner_staff_profiles" on public.staff_profiles;

-- Remove anonymous final-emblem deletion and broad ADMIN Storage FOR ALL.
drop policy if exists "registered_agent_cleanup_final_emblem" on storage.objects;
drop policy if exists "rbac_admin_manage_emblem_objects" on storage.objects;
drop policy if exists "time_owner_manage_emblem_objects" on storage.objects;
create policy "time_owner_manage_emblem_objects" on storage.objects for all to authenticated
  using(bucket_id='agent-emblems' and public.current_staff_role()='OWNER')
  with check(bucket_id='agent-emblems' and public.current_staff_role()='OWNER');

revoke all on function public.list_staff_profiles(),public.update_staff_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.list_staff_profiles(),public.update_staff_access(uuid,text,boolean) to authenticated;
revoke all on function public.provision_staff_invitation(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.provision_staff_invitation(uuid,uuid,text,text) to service_role;
commit;
