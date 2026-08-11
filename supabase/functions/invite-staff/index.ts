import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (request) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const authHeader = request.headers.get('Authorization') || ''
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: profile } = await caller.rpc('get_my_staff_profile')
  if (!profile?.active || !['OWNER', 'ADMIN'].includes(profile.role)) return new Response(JSON.stringify({ error: 'PERMISSION_DENIED' }), { status: 403, headers: cors })
  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  const role = String(body.role || '').trim().toUpperCase()
  const allowedRoles = profile.role === 'OWNER' ? ['ADMIN', 'STAFF'] : ['STAFF']
  if (!allowedRoles.includes(role)) return new Response(JSON.stringify({ error: 'ROLE_NOT_ALLOWED' }), { status: 403, headers: cors })
  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
  const { error: provisionError } = await admin.rpc('provision_staff_invitation', {
    p_actor_user_id: profile.userId,
    p_user_id: data.user.id,
    p_email: email,
    p_role: role,
  })
  if (provisionError) return new Response(JSON.stringify({ error: provisionError.message }), { status: 400, headers: cors })
  return new Response(JSON.stringify({ invited: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
