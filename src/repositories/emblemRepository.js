import { runQuery } from './repositoryCore'

const BUCKET = 'agent-emblems'

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = dataUrl.split(',')
  if (!header?.includes('image/png') || !encoded) throw new Error('徽章必須是處理完成的透明 PNG。')
  const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: 'image/png' })
}

export const emblemRepository = {
  async prepareTemporary(rawToken) {
    const prepared = await runQuery((client) => client.rpc('prepare_registration_emblem_upload', { p_raw_token: rawToken }))
    const path = prepared?.path
    if (!path) throw new Error('無法取得徽章暫存位置，請稍後再試。')
    return path
  },
  async uploadTemporary(path, pngDataUrl) {
    const blob = dataUrlToBlob(pngDataUrl)
    try {
      await runQuery((client) => client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false }))
      return { path, blob }
    } catch (error) {
      try { await runQuery((client) => client.storage.from(BUCKET).remove([path])) } catch { /* best-effort cleanup */ }
      throw error
    }
  },
  async uploadFinal(agentInternalId, blob) {
    const path = `agents/${agentInternalId}/emblem.png`
    await runQuery((client) => client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/png', upsert: false }))
    return path
  },
  async remove(paths) {
    const targets = paths.filter(Boolean)
    if (!targets.length) return
    await runQuery((client) => client.storage.from(BUCKET).remove(targets))
  },
  async createSignedUrl(path, expiresIn = 3600) {
    if (!path) return ''
    const data = await runQuery((client) => client.storage.from(BUCKET).createSignedUrl(path, expiresIn))
    return data?.signedUrl || ''
  },
}
