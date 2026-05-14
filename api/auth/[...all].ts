import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSession, signIn, signOut, signUp } from '../lib/auth.js'
import { hasDatabaseConfig } from '../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    const path = getAuthPath(req)

    if (req.method === 'POST' && path === 'sign-up/email') {
      if (!hasDatabaseConfig()) {
        res.status(500).json({ error: 'POSTGRES_URL or DATABASE_URL is not configured' })
        return
      }
      await signUp(req, res)
      return
    }

    if (req.method === 'POST' && path === 'sign-in/email') {
      if (!hasDatabaseConfig()) {
        res.status(500).json({ error: 'POSTGRES_URL or DATABASE_URL is not configured' })
        return
      }
      await signIn(req, res)
      return
    }

    if (req.method === 'POST' && path === 'sign-out') {
      await signOut(req, res)
      return
    }

    if (req.method === 'GET' && path === 'get-session') {
      res.status(200).json(getSession(req))
      return
    }

    res.setHeader('allow', 'GET, POST')
    res.status(404).json({ error: 'Auth route not found' })
  } catch (error) {
    console.error('[auth] unhandled error', error)
    res.status(500).json({ error: 'Unable to process authentication' })
  }
}

function getAuthPath(req: VercelRequest): string {
  const host = readHeader(req.headers.host) ?? 'localhost'
  const url = new URL(req.url ?? '/', `http://${host}`)
  return url.pathname.replace(/^\/api\/auth\/?/, '').replace(/\/$/, '')
}

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
