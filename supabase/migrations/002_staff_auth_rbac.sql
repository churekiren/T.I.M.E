-- T.I.M.E. Staff Authentication + role-based authorization
begin;

alter table public.staff_profiles add column if not exists email text;
alter table public.staff_profiles add column if not exists role text;
alter table public.staff_profiles add column if not exists updated_at timestamptz not null default now();
update public.staff_profiles set role = 'STAFF' where role is null;
alter table public.staff_profiles alter column role set default 'STAFF';
alter table public.staff_profiles alter column role set not null;
alter table public.staff_profiles drop constraint if exists staff_profiles_role_check;
alter table public.staff_profiles add constraint staff_profiles_role_check check (role in ('OWNER','ADMIN','STAFF'));

create or replace function public.current_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff_profiles where user_id = auth.uid() and active = true;
$$;

create or replace function public.has_staff_role(p_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.current_staff_role() = any(p_roles), false);
$$;

create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.current_staff_role()
    when 'OWNER' then p_permission = any(array[
      'staff.manage','roles.manage','sessions.manage','agents.manage','agents.delete',
      'tokens.manage','tokens.reissue','enrollments.manage','enrollments.add',
      'emblems.manage','emblems.revision_once','wall.manage','wall.read','agents.read','agents.correct_basic'
    ])
    when 'ADMIN' then p_permission = any(array[
      'staff.invite_staff','sessions.manage','agents.manage','tokens.manage','tokens.reissue',
      'enrollments.manage','enrollments.add','emblems.manage','emblems.revision_once',
      'wall.manage','wall.read','agents.read','agents.correct_basic'
    ])
    when 'STAFF' then p_permission = any(array[
      'agents.read','agents.correct_basic','tokens.manage','tokens.reissue','enrollments.add',
      'enrollments.correct_current','emblems.revision_once','wall.read'
    ])
    else false end;
$$;

create or replace function public.is_time_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_staff_role() is not null;
$$;

create or replace function public.get_my_staff_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object(
    'userId', p.user_id, 'email', coalesce(p.email, u.email), 'displayName', p.display_name,
    'role', p.role, 'active', p.active, 'createdAt', p.created_at, 'updatedAt', p.updated_at
  ) from public.staff_profiles p join auth.users u on u.id = p.user_id
  where p.user_id = auth.uid() and p.active = true), jsonb_build_object('state','DENIED'));
$$;

create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'OWNER' and (tg_op = 'DELETE' or new.role <> 'OWNER' or not new.active) then
    if (select count(*) from public.staff_profiles where role='OWNER' and active=true and user_id<>old.user_id) = 0 then
      raise exception using errcode='P0001', message='LAST_OWNER_PROTECTED';
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end; $$;
drop trigger if exists staff_profiles_guard_last_owner on public.staff_profiles;
create trigger staff_profiles_guard_last_owner before update or delete on public.staff_profiles
for each row execute function public.guard_last_owner();

create or replace function public.list_staff_profiles()
returns table(user_id uuid,email text,display_name text,role text,active boolean,created_at timestamptz,updated_at timestamptz,last_sign_in_at timestamptz)
language sql stable security definer set search_path='' as $$
  select p.user_id,coalesce(p.email,u.email),p.display_name,p.role,p.active,p.created_at,p.updated_at,u.last_sign_in_at
  from public.staff_profiles p join auth.users u on u.id=p.user_id
  where public.has_staff_role(array['OWNER']) order by p.created_at;
$$;

create or replace function public.update_staff_access(p_user_id uuid,p_role text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_target public.staff_profiles%rowtype; v_updated public.staff_profiles%rowtype;
begin
  if not public.has_staff_role(array['OWNER']) then raise exception using errcode='42501',message='OWNER_AUTH_REQUIRED'; end if;
  if p_role not in ('OWNER','ADMIN','STAFF') then raise exception using errcode='22023',message='ROLE_INVALID'; end if;
  select * into v_target from public.staff_profiles where user_id=p_user_id for update;
  if not found then raise exception using errcode='22023',message='STAFF_NOT_FOUND'; end if;
  if v_target.role='OWNER' and p_user_id<>auth.uid() then
    raise exception using errcode='42501',message='OWNER_IMMUTABLE';
  end if;
  update public.staff_profiles set role=p_role,active=p_active,updated_at=now() where user_id=p_user_id returning * into v_updated;
  return jsonb_build_object('userId',v_updated.user_id,'role',v_updated.role,'active',v_updated.active);
end; $$;

drop policy if exists "staff_manage_sessions" on public.sessions;
drop policy if exists "rbac_sessions" on public.sessions;
create policy "rbac_sessions" on public.sessions for all to authenticated using (public.has_permission('sessions.manage')) with check (public.has_permission('sessions.manage'));
drop policy if exists "staff_manage_agents" on public.agents;
drop policy if exists "rbac_agents_read" on public.agents;
drop policy if exists "rbac_agents_write" on public.agents;
create policy "rbac_agents_read" on public.agents for select to authenticated using (public.has_permission('agents.read'));
create policy "rbac_agents_write" on public.agents for update to authenticated using (public.has_permission('agents.manage')) with check (public.has_permission('agents.manage'));
drop policy if exists "staff_manage_enrollments" on public.enrollments;
drop policy if exists "rbac_enrollments_read" on public.enrollments;
drop policy if exists "rbac_enrollments_write" on public.enrollments;
create policy "rbac_enrollments_read" on public.enrollments for select to authenticated using (public.has_permission('agents.read'));
create policy "rbac_enrollments_write" on public.enrollments for all to authenticated using (public.has_permission('enrollments.manage')) with check (public.has_permission('enrollments.manage'));
drop policy if exists "staff_manage_registration_tokens" on public.registration_tokens;
drop policy if exists "rbac_tokens" on public.registration_tokens;
create policy "rbac_tokens" on public.registration_tokens for all to authenticated using (public.has_permission('tokens.manage')) with check (public.has_permission('tokens.manage'));
drop policy if exists "staff_manage_staff_profiles" on public.staff_profiles;
drop policy if exists "owner_staff_profiles" on public.staff_profiles;
create policy "owner_staff_profiles" on public.staff_profiles for all to authenticated using (public.has_staff_role(array['OWNER'])) with check (public.has_staff_role(array['OWNER']));

drop policy if exists "staff_manage_emblem_objects" on storage.objects;
drop policy if exists "rbac_admin_manage_emblem_objects" on storage.objects;
create policy "rbac_admin_manage_emblem_objects" on storage.objects for all to authenticated
using(bucket_id='agent-emblems' and public.has_permission('emblems.manage'))
with check(bucket_id='agent-emblems' and public.has_permission('emblems.manage'));

create or replace function public.create_registration_tokens(p_session_id text,p_count integer)
returns table(id uuid,raw_token text,short_code text,session_id text,status text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_index integer;v_raw text;v_row public.registration_tokens%rowtype;
begin
  if not public.has_permission('tokens.manage') then raise exception using errcode='42501',message='STAFF_AUTH_REQUIRED'; end if;
  if p_count<1 or p_count>100 then raise exception using errcode='22023',message='TOKEN_COUNT_INVALID'; end if;
  if not exists(select 1 from public.sessions s where s.id=p_session_id) then raise exception using errcode='22023',message='SESSION_NOT_FOUND'; end if;
  for v_index in 1..p_count loop
    v_raw:=encode(extensions.gen_random_bytes(32),'hex');
    insert into public.registration_tokens(token_hash,short_code,session_id)
    values(encode(extensions.digest(convert_to(v_raw,'UTF8'),'sha256'),'hex'),'REG-'||lpad(nextval('public.registration_short_code_seq')::text,4,'0'),p_session_id)
    returning * into v_row;
    id:=v_row.id;raw_token:=v_raw;short_code:=v_row.short_code;session_id:=v_row.session_id;status:=v_row.status;created_at:=v_row.created_at;return next;
  end loop;
end; $$;

revoke all on function public.current_staff_role(),public.has_staff_role(text[]),public.has_permission(text),public.get_my_staff_profile(),public.list_staff_profiles(),public.update_staff_access(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.current_staff_role(),public.has_staff_role(text[]),public.has_permission(text),public.get_my_staff_profile(),public.list_staff_profiles(),public.update_staff_access(uuid,text,boolean) to authenticated;
commit;
