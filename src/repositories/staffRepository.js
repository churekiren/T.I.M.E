import { requireSupabase } from '../lib/supabase'
import { runQuery } from './repositoryCore'

export const staffRepository = {
  list: () => runQuery((client) => client.rpc('list_staff_profiles')),
  updateAccess: (userId, role, active) => runQuery((client) => client.rpc('update_staff_access', { p_user_id: userId, p_role: role, p_active: active })),
  async invite(email, role) {
    const redirectTo = new URL(`${import.meta.env.BASE_URL}staff/activate`, window.location.origin).href
    const { data, error } = await requireSupabase().functions.invoke('invite-staff', { body: { email: email.trim(), role, redirectTo } })
    if (error) throw new Error('邀請服務目前無法使用，請確認 Edge Function 已部署。', { cause: error })
    return data
  },
}
