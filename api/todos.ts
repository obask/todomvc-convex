import { authSql, requireUserId } from '../auth'

type TodoRow = {
  id: string
  text: string
  completed: boolean
}

export default {
  async fetch(request: Request) {
    if (!authSql) {
      return json({ error: 'POSTGRES_URL or DATABASE_URL is not configured' }, 500)
    }

    try {
      const url = new URL(request.url)
      const userId = await requireUserId(request)

      if (request.method === 'GET') {
        const todos = await listTodos(userId)
        return json({ todos })
      }

      if (request.method === 'POST') {
        const text = readText(await readBody(request))
        if (!text) {
          return json({ error: 'Todo text is required' }, 400)
        }

        const todo = await createTodo(text, userId)
        return json({ todo }, 201)
      }

      if (request.method === 'PATCH') {
        const id = url.searchParams.get('id') ?? ''
        const body = await readBody(request)
        const completed = readCompleted(body)
        const text = readText(body)

        if (completed !== null && isBulkCompletedUpdate(body)) {
          const todos = await updateAllTodos(completed, userId)
          return json({ todos })
        }

        if (!id || completed === null) {
          if (!id || !text) {
            return json({ error: 'Todo id and completed state or text are required' }, 400)
          }

          const todo = await updateTodoText(id, text, userId)
          if (!todo) {
            return json({ error: 'Todo not found' }, 404)
          }

          return json({ todo })
        }

        const todo = await updateTodo(id, completed, userId)
        if (!todo) {
          return json({ error: 'Todo not found' }, 404)
        }

        return json({ todo })
      }

      if (request.method === 'DELETE') {
        const id = url.searchParams.get('id') ?? ''
        if (id) {
          await deleteTodo(id, userId)
          return new Response(null, { status: 204 })
        }

        if (url.searchParams.get('completed') === 'true') {
          await deleteCompletedTodos(userId)
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
      if (error instanceof Error && error.message === 'Unauthorized') {
        return json({ error: 'Log in to manage todos' }, 401)
      }
      console.error(formatError('[todos] unhandled error', error))
      return json({ error: 'Unable to process todos' }, 500)
    }
  },
}

async function listTodos(userId: string) {
  const database = getSql()
  const rows = (await database`
    select id, title as text, is_completed as completed
    from todos
    where user_id = ${userId}
    order by created_at asc, id asc
  `) as TodoRow[]

  return rows
}

async function createTodo(text: string, userId: string) {
  const database = getSql()
  const id = crypto.randomUUID()
  const [todo] = (await database`
    insert into todos (id, title, user_id)
    values (${id}, ${text}, ${userId})
    returning id, title as text, is_completed as completed
  `) as TodoRow[]

  return todo
}

async function updateTodo(id: string, completed: boolean, userId: string) {
  const database = getSql()
  const [todo] = (await database`
    update todos
    set is_completed = ${completed}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, title as text, is_completed as completed
  `) as TodoRow[]

  return todo ?? null
}

async function updateTodoText(id: string, text: string, userId: string) {
  const database = getSql()
  const [todo] = (await database`
    update todos
    set title = ${text}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, title as text, is_completed as completed
  `) as TodoRow[]

  return todo ?? null
}

async function updateAllTodos(completed: boolean, userId: string) {
  const database = getSql()
  const rows = (await database`
    update todos
    set is_completed = ${completed}, updated_at = now()
    where user_id = ${userId}
    returning id, title as text, is_completed as completed
  `) as TodoRow[]

  return rows
}

async function deleteTodo(id: string, userId: string) {
  const database = getSql()
  await database`delete from todos where id = ${id} and user_id = ${userId}`
}

async function deleteCompletedTodos(userId: string) {
  const database = getSql()
  await database`delete from todos where is_completed = true and user_id = ${userId}`
}

function getSql() {
  if (!authSql) {
    throw new Error('POSTGRES_URL or DATABASE_URL is not configured')
  }

  return authSql
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

function isBulkCompletedUpdate(body: unknown) {
  return Boolean(
    body &&
      typeof body === 'object' &&
      (body as Record<string, unknown>).all === true,
  )
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

function formatError(prefix: string, error: unknown): string {
  if (error instanceof Error) {
    return `${prefix}\n${error.stack ?? `${error.name}: ${error.message}`}`
  }
  if (error instanceof Uint8Array) {
    return `${prefix}\n${new TextDecoder().decode(error)}`
  }
  return `${prefix}\n${String(error)}`
}
