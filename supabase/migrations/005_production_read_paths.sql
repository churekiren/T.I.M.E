-- Staff-safe operational search used by Admin, Staff and Agents pages.
begin;

create or replace function public.search_field_agents(p_query text, p_session_id text default null)
returns table (
  permanent_agent_id text,
  codename text,
  emblem_path text,
  first_registered_at timestamptz,
  agent_status text,
  current_enrollment_id uuid,
  current_display_agent_number text,
  current_enrollment_status text,
  current_returning_agent boolean,
  current_joined_at timestamptz,
  matching_short_code text,
  mission_history jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := upper(trim(coalesce(p_query, '')));
begin
  if not public.has_permission('agents.read') then
    raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
  end if;
  if length(v_query) < 2 then return; end if;

  return query
  select
    a.permanent_agent_id,
    a.codename,
    a.emblem_path,
    a.first_registered_at,
    a.status,
    current_e.id,
    current_e.display_agent_number,
    current_e.completion_status,
    current_e.returning_agent,
    current_e.joined_at,
    matched_token.short_code,
    coalesce(history.items, '[]'::jsonb)
  from public.agents a
  left join public.enrollments current_e
    on current_e.agent_id = a.id and current_e.session_id = p_session_id
  left join lateral (
    select t.short_code
    from public.registration_tokens t
    where t.agent_id = a.id and upper(t.short_code) like '%' || v_query || '%'
    order by t.created_at desc limit 1
  ) matched_token on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'enrollmentId', e.id,
      'sessionId', e.session_id,
      'sessionName', s.name,
      'displayAgentNumber', e.display_agent_number,
      'returningAgent', e.returning_agent,
      'completionStatus', e.completion_status,
      'joinedAt', e.joined_at
    ) order by e.joined_at desc) as items
    from public.enrollments e
    join public.sessions s on s.id = e.session_id
    where e.agent_id = a.id
  ) history on true
  where upper(a.codename) like '%' || v_query || '%'
     or upper(a.permanent_agent_id) like '%' || v_query || '%'
     or upper(coalesce(current_e.display_agent_number, '')) like '%' || v_query || '%'
     or matched_token.short_code is not null
  order by (upper(a.codename) = v_query) desc, a.created_at
  limit 50;
end;
$$;

revoke all on function public.search_field_agents(text, text) from public, anon, authenticated;
grant execute on function public.search_field_agents(text, text) to authenticated;

commit;
