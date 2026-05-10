import { SQL } from 'bun'
import { attachDatabasePool } from '@vercel/functions'
import { Elysia, status, t } from 'elysia'

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

if (sql) {
  try {
    attachDatabasePool(sql)
  } catch (error) {
    if (
      !(error instanceof Error && error.message === 'Unsupported database pool type')
    ) {
      throw error
    }
  }
}

const errorResponse = t.Object({
  error: t.String(),
})

const todoSchema = t.Object({
  id: t.String(),
  text: t.String(),
  completed: t.Boolean(),
})

export const app = new Elysia({ prefix: '/api/todos' })
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') {
      set.status = 400
      return { error: 'Invalid todo request' }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Not found' }
    }

    if (error instanceof Error && error.message === 'POSTGRES_URL is not configured') {
      set.status = 500
      return { error: error.message }
    }

    console.error(error)
    set.status = 500
    return { error: 'Unable to process todos' }
  })
  .get(
    '/',
    async () => {
      const todos = await listTodos()
      return { todos }
    },
    {
      response: {
        200: t.Object({ todos: t.Array(todoSchema) }),
        500: errorResponse,
      },
    },
  )
  .post(
    '/',
    async ({ body }) => {
      const text = body.text.trim()
      if (!text) {
        return status(400, { error: 'Todo text is required' })
      }

      const userId = await resolveUserId()
      const todo = await createTodo(text, userId)
      return status(201, { todo })
    },
    {
      body: t.Object({ text: t.String() }),
      response: {
        201: t.Object({ todo: todoSchema }),
        400: errorResponse,
        500: errorResponse,
      },
    },
  )
  .patch(
    '/',
    async ({ body, query }) => {
      const todo = await updateTodo(query.id, body.completed)
      if (!todo) {
        return status(404, { error: 'Todo not found' })
      }

      return { todo }
    },
    {
      query: t.Object({ id: t.String({ minLength: 1 }) }),
      body: t.Object({ completed: t.Boolean() }),
      response: {
        200: t.Object({ todo: todoSchema }),
        404: errorResponse,
        500: errorResponse,
      },
    },
  )
  .delete(
    '/',
    async ({ query }) => {
      if (query.id) {
        await deleteTodo(query.id)
        return status(204)
      }

      if (query.completed === 'true') {
        await deleteCompletedTodos()
        return status(204)
      }

      return status(400, { error: 'Todo id or completed=true is required' })
    },
    {
      query: t.Object({
        id: t.Optional(t.String()),
        completed: t.Optional(t.String()),
      }),
      response: {
        204: t.Void(),
        400: errorResponse,
        500: errorResponse,
      },
    },
  )

export type TodoApp = typeof app

export default {
  fetch: app.handle,
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
