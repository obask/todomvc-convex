import type { VercelRequest, VercelResponse } from '@vercel/node'
import { auth } from '../lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const authRequest = new Request(toAuthUrl(req), {
    method: req.method,
    headers: toHeaders(req.headers),
    body: toRequestBody(await readRequestBody(req)),
  })
  const authResponse = await auth.handler(authRequest)

  authResponse.headers.forEach((value, name) => {
    if (name === 'set-cookie' || name === 'content-encoding' || name === 'content-length' || name === 'transfer-encoding') {
      return
    }
    res.setHeader(name, value)
  })

  const setCookies = authResponse.headers.getSetCookie?.() ?? []
  if (setCookies.length > 0) {
    res.setHeader('set-cookie', setCookies)
  }

  const responseBody = Buffer.from(await authResponse.arrayBuffer())
  res.status(authResponse.status).send(responseBody)
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

function toRequestBody(body: Buffer | undefined): BodyInit | undefined {
  return body ? new Uint8Array(body) : undefined
}

function toAuthUrl(req: VercelRequest): string {
  const incoming = toRequestUrl(req)
  const subpath = incoming.pathname.replace(/^\/api\/auth\/?/, '')
  incoming.search = stripCatchAllParam(incoming.searchParams, subpath)
  return incoming.toString()
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
  return next.toString()
}

function toRequestUrl(req: VercelRequest): URL {
  const host = readHeader(req.headers.host) ?? 'localhost'
  const proto = readHeader(req.headers['x-forwarded-proto']) ?? 'http'
  return new URL(req.url ?? '/', `${proto}://${host}`)
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
  headers.delete('connection')
  headers.delete('content-length')
  return headers
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
