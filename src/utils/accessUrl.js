const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export function isLocalOnlyOrigin(locationLike = window.location) {
  return LOCAL_HOSTS.has(locationLike.hostname.toLowerCase())
}

export function buildAccessUrl(token, locationLike = window.location) {
  return absoluteAppUrl(`access/${encodeURIComponent(token)}`, locationLike)
}
import { absoluteAppUrl } from './basePath'
