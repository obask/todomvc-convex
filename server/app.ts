import { SQL } from 'bun'
import { attachDatabasePool } from '@vercel/functions'
import { Elysia, status, t } from 'elysia'
import { auth } from '../auth'

type TodoRow = {
  id: string
  text: string
  completed: boolean
}

const env = Bun.env
const connectionString = env.POSTGRES_URL ?? env.DATABASE_URL
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

    if (error instanceof Error && error.message === 'POSTGRES_URL or DATABASE_URL is not configured') {
      set.status = 500
      return { error: error.message }
    }

    if (error instanceof Error && error.message === 'Sign in to manage todos') {
      set.status = 401
      return { error: error.message }
    }

    console.error(error)
    set.status = 500
    return { error: 'Unable to process todos' }
  })
  .get(
    '/',
    async ({ request }) => {
      const session = await getSession(request)
      const todos = await listTodos(session.user.id)
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
    async ({ body, request }) => {
      const text = body.text.trim()
      if (!text) {
        return status(400, { error: 'Todo text is required' })
      }

      const session = await getSession(request)
      const todo = await createTodo(text, session.user.id)
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
    async ({ body, query, request }) => {
      const session = await getSession(request)
      if (body.all === true) {
        if (body.completed === undefined) {
          return status(400, { error: 'Todo completed state is required' })
        }

        const todos = await updateAllTodos(body.completed, session.user.id)
        return { todos }
      }

      if (body.text !== undefined) {
        if (!query.id) {
          return status(400, { error: 'Todo id is required' })
        }

        const text = body.text.trim()
        if (!text) {
          return status(400, { error: 'Todo text is required' })
        }

        const todo = await updateTodoText(query.id, text, session.user.id)
        if (!todo) {
          return status(404, { error: 'Todo not found' })
        }

        return { todo }
      }

      if (!query.id) {
        return status(400, { error: 'Todo id is required' })
      }

      if (body.completed === undefined) {
        return status(400, { error: 'Todo completed state is required' })
      }

      const todo = await updateTodo(query.id, body.completed, session.user.id)
      if (!todo) {
        return status(404, { error: 'Todo not found' })
      }

      return { todo }
    },
    {
      query: t.Object({ id: t.Optional(t.String({ minLength: 1 })) }),
      body: t.Object({
        completed: t.Optional(t.Boolean()),
        all: t.Optional(t.Boolean()),
        text: t.Optional(t.String()),
      }),
      response: {
        200: t.Union([
          t.Object({ todo: todoSchema }),
          t.Object({ todos: t.Array(todoSchema) }),
        ]),
        400: errorResponse,
        404: errorResponse,
        500: errorResponse,
      },
    },
  )
  .delete(
    '/',
    async ({ query, request }) => {
      const session = await getSession(request)

      if (query.id) {
        await deleteTodo(query.id, session.user.id)
        return status(204)
      }

      if (query.completed === 'true') {
        await deleteCompletedTodos(session.user.id)
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

export type App = typeof app

async function listTodos(userId: string) {
  const database = getSql()
  const rows = (await database`
    select id, text, completed
    from todo
    where user_id = ${userId}
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

async function updateTodo(id: string, completed: boolean, userId: string) {
  const database = getSql()
  const [todo] = (await database`
    update todo
    set completed = ${completed}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, text, completed
  `) as TodoRow[]

  return todo ?? null
}

async function updateTodoText(id: string, text: string, userId: string) {
  const database = getSql()
  const [todo] = (await database`
    update todo
    set text = ${text}, updated_at = now()
    where id = ${id} and user_id = ${userId}
    returning id, text, completed
  `) as TodoRow[]

  return todo ?? null
}

async function updateAllTodos(completed: boolean, userId: string) {
  const database = getSql()
  const rows = (await database`
    update todo
    set completed = ${completed}, updated_at = now()
    where user_id = ${userId}
    returning id, text, completed
  `) as TodoRow[]

  return rows
}

async function deleteTodo(id: string, userId: string) {
  const database = getSql()
  await database`delete from todo where id = ${id} and user_id = ${userId}`
}

async function deleteCompletedTodos(userId: string) {
  const database = getSql()
  await database`delete from todo where completed = true and user_id = ${userId}`
}

function getSql() {
  if (!sql) {
    throw new Error('POSTGRES_URL or DATABASE_URL is not configured')
  }

  return sql
}

async function getSession(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    throw new Error('Sign in to manage todos')
  }

  return session
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
