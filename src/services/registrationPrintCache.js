const PREFIX = 'time-registration-print:'

export function cacheRegistrationPrintBatch(tokens) {
  const id = tokens.map((token) => token.id).join('.')
  const printable = tokens.map(({ id: tokenId, rawToken, shortCode }) => ({ id: tokenId, rawToken, shortCode }))
  sessionStorage.setItem(`${PREFIX}${id}`, JSON.stringify(printable))
  return id
}

export function readRegistrationPrintBatch(id) {
  if (!id) return []
  try { return JSON.parse(sessionStorage.getItem(`${PREFIX}${id}`)) || [] } catch { return [] }
}
