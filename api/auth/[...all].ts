import type { VercelRequest, VercelResponse } from '@vercel/node'

const baseUrl = process.env.NEON_AUTH_BASE_URL

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!baseUrl) {
    res.status(500).json({ error: 'NEON_AUTH_BASE_URL is not configured' })
    return
  }

  const incoming = toRequestUrl(req)
  const subpath = incoming.pathname.replace(/^\/api\/auth\/?/, '')
  const search = stripCatchAllParam(incoming.searchParams, subpath)
  const upstreamUrl = `${baseUrl.replace(/\/$/, '')}/${subpath}${search}`

  const headers = toHeaders(req.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('connection')
  headers.delete('accept-encoding')
  headers.delete('x-forwarded-for')
  headers.delete('x-forwarded-host')
  headers.delete('x-forwarded-port')
  headers.delete('x-forwarded-proto')

  const body = await readRequestBody(req)
  if (body !== undefined) {
    headers.set('content-length', String(Buffer.byteLength(body)))
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
      redirect: 'manual',
    })
  } catch (error) {
    console.error('[auth-proxy] upstream fetch failed', error)
    res.status(502).json({ error: 'Auth upstream unreachable' })
    return
  }

  upstream.headers.forEach((value, name) => {
    if (name === 'set-cookie' || name === 'content-encoding' || name === 'content-length' || name === 'transfer-encoding') {
      return
    }
    res.setHeader(name, value)
  })

  const setCookies = upstream.headers.getSetCookie?.().map(rewriteCookie) ?? []
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies)
  }

  const responseBody = Buffer.from(await upstream.arrayBuffer())
  res.status(upstream.status).send(responseBody)
}

async function readRequestBody(req: VercelRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined

  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === 'string') return Buffer.from(req.body)
    return Buffer.from(JSON.stringify(req.body))
  }

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const buffer = Buffer.concat(chunks)
  return buffer.length > 0 ? buffer : undefined
}

function stripCatchAllParam(params: URLSearchParams, subpath: string): string {
  const next = new URLSearchParams(params)
  // Vercel sometimes echoes the catch-all into query params (`all`); drop it
  // when it matches the actual route segments so we don't leak it upstream.
  const segments = subpath.split('/').filter(Boolean)
  for (const key of ['all', '...all']) {
    const values = next.getAll(key)
    if (values.length > 0 && values.every((v) => segments.includes(v))) {
      next.delete(key)
    }
  }
  const serialized = next.toString()
  return serialized ? `?${serialized}` : ''
}

function toRequestUrl(req: VercelRequest): URL {
  const host = (req.headers.host as string | undefined) ?? 'localhost'
  return new URL(req.url ?? '/', `http://${host}`)
}

function toHeaders(source: VercelRequest['headers']): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item)
    } else if (value !== undefined) {
      headers.set(name, value)
    }
  }
  return headers
}

function rewriteCookie(cookie: string): string {
  return cookie
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^domain=/i.test(part))
    .join('; ')
}
