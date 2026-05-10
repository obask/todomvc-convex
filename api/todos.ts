import { SQL } from 'bun'
import { attachDatabasePool } from '@vercel/functions'

type TodoRow = {
  id: string
  text: string
  completed: boolean
}

const env = Bun.env
const connectionString = env.POSTGRES_URL
const sql = connectionString
  ? new SQL({
      url: connectionString,
      idleTimeout: readPositiveNumber(env.POSTGRES_IDLE_TIMEOUT, 5),
      max: readPositiveNumber(env.POSTGRES_MAX_CONNECTIONS, 5),
      maxLifetime: readPositiveNumber(env.POSTGRES_MAX_LIFETIME, 60 * 30),
    })
  : null

if (sql) attachDatabasePool(sql)

export default {
  async fetch(request: Request) {
    if (!sql) {
      return json({ error: 'POSTGRES_URL is not configured' }, 500)
    }

    try {
      const url = new URL(request.url)

      if (request.method === 'GET') {
        const todos = await listTodos()
        return json({ todos })
      }

      if (request.method === 'POST') {
        const text = readText(await readBody(request))
        if (!text) {
          return json({ error: 'Todo text is required' }, 400)
        }

        const userId = await resolveUserId()
        const todo = await createTodo(text, userId)
        return json({ todo }, 201)
      }

      if (request.method === 'PATCH') {
        const id = url.searchParams.get('id') ?? ''
        const completed = readCompleted(await readBody(request))
        if (!id || completed === null) {
          return json({ error: 'Todo id and completed state are required' }, 400)
        }

        const todo = await updateTodo(id, completed)
        if (!todo) {
          return json({ error: 'Todo not found' }, 404)
        }

        return json({ todo })
      }

      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? ''
        if (id) {
          await deleteTodo(id)
          return new Response(null, { status: 204 })
        }

        if (url.searchParams.get('completed') === 'true') {
          await deleteCompletedTodos()
          return new Response(null, { status: 204 })
        }

        return json({ error: 'Todo id or completed=true is required' }, 400)
      }

      return json(
        { error: 'Method not allowed' },
        405,
        { Allow: 'GET, POST, PATCH, DELETE' },
      )
    } catch (error) {
      console.error(error)
      return json({ error: 'Unable to process todos' }, 500)
    }
  },
}

async function listTodos() {
  const database = getSql()
  const rows = (await database`
    select id, text, completed
    from todo
    order by created_at asc, id asc
  `) as TodoRow[]

  return rows
}

async function createTodo(text: string, userId: string) {
  const database = getSql()
  const [todo] = (await database`
    insert into todo (text, user_id)
    values (${text}, ${userId})
    returning id, text, completed
  `) as TodoRow[]

  return todo
}

async function updateTodo(id: string, completed: boolean) {
  const database = getSql()
  const [todo] = (await database`
    update todo
    set completed = ${completed}, updated_at = now()
    where id = ${id}
    returning id, text, completed
  `) as TodoRow[]

  return todo ?? null
}

async function deleteTodo(id: string) {
  const database = getSql()
  await database`delete from todo where id = ${id}`
}

async function deleteCompletedTodos() {
  const database = getSql()
  await database`delete from todo where completed = true`
}

async function resolveUserId() {
  if (env.TODO_USER_ID) return env.TODO_USER_ID

  const database = getSql()
  const [todo] = (await database`
    select user_id from todo order by created_at asc limit 1
  `) as { user_id: string }[]

  return todo?.user_id ?? 'local'
}

function getSql() {
  if (!sql) {
    throw new Error('POSTGRES_URL is not configured')
  }

  return sql
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

async function readBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
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

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers,
  })
}
