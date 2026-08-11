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
  const { email, role } = await request.json()
  const allowedRoles = profile.role === 'OWNER' ? ['OWNER', 'ADMIN', 'STAFF'] : ['STAFF']
  if (!allowedRoles.includes(role)) return new Response(JSON.stringify({ error: 'ROLE_NOT_ALLOWED' }), { status: 403, headers: cors })
  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
  const { error: profileError } = await admin.from('staff_profiles').upsert({ user_id: data.user.id, email, role, active: true, updated_at: new Date().toISOString() })
  if (profileError) return new Response(JSON.stringify({ error: profileError.message }), { status: 400, headers: cors })
  return new Response(JSON.stringify({ invited: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
