import { Elysia } from 'elysia'
import { handleAuthRequest } from './auth-handler'
import { app as todos } from './server/app'

export const app = new Elysia()
  .all('/api/auth/*', ({ request }) => handleAuthRequest(request))
  .use(todos)

export type App = typeof app
