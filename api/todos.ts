import type { VercelRequest, VercelResponse } from '@vercel/node'
import { auth } from './lib/auth.js'
import { hasDatabaseConfig, pool } from './lib/db.js'

type TodoRow = {
  id: string
  text: string
  completed: boolean
}

type AuthSession = {
  user?: {
    id?: string
  } | null
}

const SESSION_TTL_MS = 30_000
const sessionCache = new Map<string, { userId: string; expiresAt: number }>()

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (!hasDatabaseConfig()) {
    res.status(500).json({ error: 'POSTGRES_URL or DATABASE_URL is not configured' })
    return
  }

  try {
    const userId = await requireUserId(req)
    const url = toRequestUrl(req)

    if (req.method === 'GET') {
      const todos = await listTodos(userId)
      res.status(200).json({ todos })
      return
    }

    if (req.method === 'POST') {
      const text = readText(await readJson(req))
      if (!text) {
        res.status(400).json({ error: 'Todo text is required' })
        return
      }
      const todo = await createTodo(text, userId)
      res.status(201).json({ todo })
      return
    }

    if (req.method === 'PATCH') {
      const id = url.searchParams.get('id') ?? ''
      const completed = readCompleted(await readJson(req))
      if (!id || completed === null) {
        res.status(400).json({ error: 'Todo id and completed state are required' })
        return
      }
      const todo = await updateTodo(id, completed, userId)
      if (!todo) {
        res.status(404).json({ error: 'Todo not found' })
        return
      }
      res.status(200).json({ todo })
      return
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id') ?? ''
      if (id) {
        await deleteTodo(id, userId)
        res.status(204).end()
        return
      }
      if (url.searchParams.get('completed') === 'true') {
        await deleteCompletedTodos(userId)
        res.status(204).end()
        return
      }
      res.status(400).json({ error: 'Todo id or completed=true is required' })
      return
    }

    res.setHeader('allow', 'GET, POST, PATCH, DELETE')
    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      res.status(401).json({ error: 'Log in to manage todos' })
      return
    }
    console.error('[todos] unhandled error', error)
    res.status(500).json({ error: 'Unable to process todos' })
  }
}

async function requireUserId(req: VercelRequest): Promise<string> {
  const cookie = readCookieHeader(req)
  if (!cookie) throw new Error('Unauthorized')

  const cached = sessionCache.get(cookie)
  if (cached && cached.expiresAt > Date.now()) return cached.userId

  const session = (await auth.api.getSession({
    headers: toHeaders(req.headers),
    query: { disableRefresh: true },
  })) as AuthSession | null
  const userId = session?.user?.id
  if (!userId) throw new Error('Unauthorized')

  sessionCache.set(cookie, { userId, expiresAt: Date.now() + SESSION_TTL_MS })
  return userId
}

function readCookieHeader(req: VercelRequest): string {
  const value = req.headers.cookie
  if (Array.isArray(value)) return value.join('; ')
  return value ?? ''
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

async function listTodos(userId: string) {
  const { rows } = await pool.query<TodoRow>(
    `
      select id, text, completed
      from todo
      where user_id = $1
      order by created_at asc, id asc
    `,
    [userId],
  )
  return rows
}

async function createTodo(text: string, userId: string) {
  const { rows } = await pool.query<TodoRow>(
    `
      insert into todo (text, user_id)
      values ($1, $2)
      returning id, text, completed
    `,
    [text, userId],
  )
  return rows[0]
}

async function updateTodo(id: string, completed: boolean, userId: string) {
  const { rows } = await pool.query<TodoRow>(
    `
      update todo
      set completed = $2, updated_at = now()
      where id = $1 and user_id = $3
      returning id, text, completed
    `,
    [id, completed, userId],
  )
  return rows[0] ?? null
}

async function deleteTodo(id: string, userId: string) {
  await pool.query('delete from todo where id = $1 and user_id = $2', [id, userId])
}

async function deleteCompletedTodos(userId: string) {
  await pool.query('delete from todo where completed = true and user_id = $1', [userId])
}

async function readJson(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined) return req.body

  try {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const text = Buffer.concat(chunks).toString('utf8')
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}

function readText(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const text = (body as Record<string, unknown>).text
  return typeof text === 'string' ? text.trim() : ''
}

function readCompleted(body: unknown): boolean | null {
  if (!body || typeof body !== 'object') return null
  const completed = (body as Record<string, unknown>).completed
  return typeof completed === 'boolean' ? completed : null
}
