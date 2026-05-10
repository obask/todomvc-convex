import type { VercelRequest, VercelResponse } from '@vercel/node'
import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

type TodoRow = {
  id: string
  text: string
  completed: boolean
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})
attachDatabasePool(pool)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.POSTGRES_URL) {
    res.status(500).json({ error: 'POSTGRES_URL is not configured' })
    return
  }

  try {
    if (req.method === 'GET') {
      const todos = await listTodos()
      res.status(200).json({ todos })
      return
    }

    if (req.method === 'POST') {
      const text = readText(req.body)
      if (!text) {
        res.status(400).json({ error: 'Todo text is required' })
        return
      }

      const userId = await resolveUserId()
      const todo = await createTodo(text, userId)
      res.status(201).json({ todo })
      return
    }

    if (req.method === 'PATCH') {
      const id = readId(req.query.id)
      const completed = readCompleted(req.body)
      if (!id || completed === null) {
        res.status(400).json({ error: 'Todo id and completed state are required' })
        return
      }

      const todo = await updateTodo(id, completed)
      if (!todo) {
        res.status(404).json({ error: 'Todo not found' })
        return
      }

      res.status(200).json({ todo })
      return
    }

    if (req.method === 'DELETE') {
      const id = readId(req.query.id)
      if (id) {
        await deleteTodo(id)
        res.status(204).end()
        return
      }

      if (req.query.completed === 'true') {
        await deleteCompletedTodos()
        res.status(204).end()
        return
      }

      res.status(400).json({ error: 'Todo id or completed=true is required' })
      return
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Unable to process todos' })
  }
}

async function listTodos() {
  const { rows } = await pool.query<TodoRow>(`
    select id, text, completed
    from todo
    order by created_at asc, id asc
  `)

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

async function updateTodo(id: string, completed: boolean) {
  const { rows } = await pool.query<TodoRow>(
    `
      update todo
      set completed = $2, updated_at = now()
      where id = $1
      returning id, text, completed
    `,
    [id, completed],
  )

  return rows[0] ?? null
}

async function deleteTodo(id: string) {
  await pool.query('delete from todo where id = $1', [id])
}

async function deleteCompletedTodos() {
  await pool.query('delete from todo where completed = true')
}

async function resolveUserId() {
  if (process.env.TODO_USER_ID) return process.env.TODO_USER_ID

  const { rows } = await pool.query<{ user_id: string }>(
    'select user_id from todo order by created_at asc limit 1',
  )

  return rows[0]?.user_id ?? 'local'
}

function readText(body: unknown) {
  if (!body || typeof body !== 'object') return ''

  const text = (body as Record<string, unknown>).text
  return typeof text === 'string' ? text.trim() : ''
}

function readCompleted(body: unknown) {
  if (!body || typeof body !== 'object') return null

  const completed = (body as Record<string, unknown>).completed
  return typeof completed === 'boolean' ? completed : null
}

function readId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}
