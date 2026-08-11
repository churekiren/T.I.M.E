const basePath = import.meta.env.BASE_URL || '/'

export function assetUrl(path) {
  return `${basePath}${String(path).replace(/^\/+/, '')}`
}

export function absoluteAppUrl(path, locationLike = window.location) {
  return new URL(`${basePath}${String(path).replace(/^\/+/, '')}`, locationLike.origin).href
}
