// Serves web/_site under /<repo>/ exactly like GitHub Pages, for a local check.
// Usage: node scripts/serve-pages.mjs employee-portal  → http://localhost:4180/employee-portal/
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const repo = process.argv[2] ?? 'employee-portal'
const root = join(import.meta.dirname, '..', '_site')
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' }

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (!url.startsWith(`/${repo}/`)) { res.writeHead(302, { location: `/${repo}/` }); return res.end() }
  let file = normalize(join(root, url.slice(repo.length + 2)))
  if (!file.startsWith(root)) { res.writeHead(403); return res.end() }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch { file = join(root, '404.html') }
  try {
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
    res.end(await readFile(file))
  } catch { res.writeHead(404); res.end('Not found') }
}).listen(Number(process.env.PORT ?? 4180), () => console.log(`http://localhost:${process.env.PORT ?? 4180}/${repo}/`))
