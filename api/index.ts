import { Elysia } from 'elysia'
import { auth, isAuthDatabaseConfigured } from '../auth'
import { app as todos } from '../server/app'

export const app = new Elysia()
  .get('/api/hello', ({ request }) => ({
    message: 'Hello from a Vercel function!',
    time: new Date().toISOString(),
    url: request.url,
  }))
  .all('/api/auth/*', ({ request }) => {
    if (!isAuthDatabaseConfigured() && !isSignOutRequest(request)) {
      return Response.json(
        { error: 'POSTGRES_URL or DATABASE_URL is not configured' },
        { status: 500 },
      )
    }

    return auth.handler(request)
  })
  .use(todos)

export type App = typeof app

export default {
  fetch: app.handle,
}

function isSignOutRequest(request: Request) {
  const url = new URL(request.url)
  return request.method === 'POST' && url.pathname === '/api/auth/sign-out'
}
