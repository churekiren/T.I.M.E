-- Generate registration upload paths server-side so LAN HTTP clients do not
-- depend on secure-context-only Web Crypto APIs.
begin;

create or replace function public.prepare_registration_emblem_upload(p_raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.registration_tokens%rowtype;
  v_hash text;
  v_path text;
begin
  if p_raw_token is null or length(p_raw_token) < 32 then
    raise exception using errcode = '22023', message = 'ACCESS_CREDENTIAL_INVALID';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_raw_token, 'UTF8'), 'sha256'), 'hex');
  select * into v_token from public.registration_tokens where token_hash = v_hash;

  if not found then raise exception using errcode = '22023', message = 'ACCESS_CREDENTIAL_INVALID'; end if;
  if v_token.status <> 'UNUSED' then raise exception using errcode = 'P0001', message = 'ACCESS_CREDENTIAL_ALREADY_USED'; end if;
  if v_token.purpose <> 'FIRST_REGISTRATION' then raise exception using errcode = 'P0001', message = 'ACCESS_PURPOSE_INVALID'; end if;
  if v_token.expires_at is not null and v_token.expires_at <= now() then raise exception using errcode = 'P0001', message = 'ACCESS_CREDENTIAL_EXPIRED'; end if;
  if not exists(select 1 from public.sessions where id = v_token.session_id and status = 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_ACTIVE';
  end if;

  v_path := 'temporary/' || v_hash || '/' || encode(extensions.gen_random_bytes(16), 'hex') || '.png';
  return jsonb_build_object('path', v_path);
end;
$$;

revoke all on function public.prepare_registration_emblem_upload(text) from public, anon, authenticated;
grant execute on function public.prepare_registration_emblem_upload(text) to anon, authenticated;

commit;
