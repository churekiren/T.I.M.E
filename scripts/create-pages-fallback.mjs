import { readFile, writeFile } from 'node:fs/promises'

const base = normalizeBase(process.env.VITE_BASE_PATH || '/')
const indexPath = new URL('../dist/index.html', import.meta.url)
const fallbackPath = new URL('../dist/404.html', import.meta.url)
const restoreScript = `<script>(function(){var p=new URLSearchParams(location.search).get('__time_route');if(!p)return;history.replaceState(null,'',${JSON.stringify(base)}+p.replace(/^\\/+/,''));})();</script>`
const index = await readFile(indexPath, 'utf8')
await writeFile(indexPath, index.replace('</head>', `${restoreScript}</head>`), 'utf8')

const fallback = `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T.I.M.E.</title></head><body><script>(function(){var base=${JSON.stringify(base)};var path=location.pathname.indexOf(base)===0?location.pathname.slice(base.length):location.pathname.replace(/^\\/+/, '');var route='/' + path + location.search + location.hash;location.replace(location.origin+base+'?__time_route='+encodeURIComponent(route));})();</script></body></html>`
await writeFile(fallbackPath, fallback, 'utf8')

function normalizeBase(value) {
  const withLeading = value.startsWith('/') ? value : `/${value}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}
