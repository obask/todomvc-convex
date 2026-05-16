import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, asc, eq, sql } from 'drizzle-orm'
import { requireUserId } from './lib/auth.js'
import { hasDatabaseConfig } from './lib/db.js'
import { db } from './lib/drizzle.js'
import { todo } from './lib/schema.js'

type TodoRow = {
  id: string
  title: string
  completed: boolean
}

const todoSelection = {
  id: todo.id,
  title: todo.title,
  completed: todo.completed,
} satisfies Record<keyof TodoRow, unknown>

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
      const title = readTitle(await readJson(req))
      if (!title) {
        res.status(400).json({ error: 'Todo title is required' })
        return
      }
      const todo = await createTodo(title, userId)
      res.status(201).json({ todo })
      return
    }

    if (req.method === 'PATCH') {
      const id = url.searchParams.get('id') ?? ''
      const body = await readJson(req)
      const completed = readCompleted(body)
      const title = readTitle(body)

      if (completed !== null && isBulkCompletedUpdate(body)) {
        const todos = await updateAllTodos(completed, userId)
        res.status(200).json({ todos })
        return
      }

      if (completed === null) {
        if (!id || !title) {
          res.status(400).json({ error: 'Todo id and completed state or title are required' })
          return
        }

        const todo = await updateTodoTitle(id, title, userId)
        if (!todo) {
          res.status(404).json({ error: 'Todo not found' })
          return
        }
        res.status(200).json({ todo })
        return
      }

      if (!id) {
        res.status(400).json({ error: 'Todo id is required' })
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

function toRequestUrl(req: VercelRequest): URL {
  const host = (req.headers.host as string | undefined) ?? 'localhost'
  return new URL(req.url ?? '/', `http://${host}`)
}

async function listTodos(userId: string) {
  return db
    .select(todoSelection)
    .from(todo)
    .where(eq(todo.userId, userId))
    .orderBy(asc(todo.createdAt), asc(todo.id))
}

async function createTodo(title: string, userId: string) {
  const [created] = await db
    .insert(todo)
    .values({ title, userId })
    .returning(todoSelection)
  return created
}

async function updateTodo(id: string, completed: boolean, userId: string) {
  const [updated] = await db
    .update(todo)
    .set({ completed, updatedAt: sql`now()` })
    .where(and(eq(todo.id, id), eq(todo.userId, userId)))
    .returning(todoSelection)
  return updated ?? null
}

async function updateTodoTitle(id: string, title: string, userId: string) {
  const [updated] = await db
    .update(todo)
    .set({ title, updatedAt: sql`now()` })
    .where(and(eq(todo.id, id), eq(todo.userId, userId)))
    .returning(todoSelection)
  return updated ?? null
}

async function updateAllTodos(completed: boolean, userId: string) {
  return db
    .update(todo)
    .set({ completed, updatedAt: sql`now()` })
    .where(eq(todo.userId, userId))
    .returning(todoSelection)
}

async function deleteTodo(id: string, userId: string) {
  await db.delete(todo).where(and(eq(todo.id, id), eq(todo.userId, userId)))
}

async function deleteCompletedTodos(userId: string) {
  await db.delete(todo).where(and(eq(todo.completed, true), eq(todo.userId, userId)))
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

function readTitle(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const title = (body as Record<string, unknown>).title
  return typeof title === 'string' ? title.trim() : ''
}

function readCompleted(body: unknown): boolean | null {
  if (!body || typeof body !== 'object') return null
  const completed = (body as Record<string, unknown>).completed
  return typeof completed === 'boolean' ? completed : null
}

function isBulkCompletedUpdate(body: unknown) {
  return Boolean(
    body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>).all === true,
  )
}
