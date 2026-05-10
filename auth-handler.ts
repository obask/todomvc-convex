import { auth, isAuthDatabaseConfigured } from './auth'

export function handleAuthRequest(request: Request) {
  if (!isAuthDatabaseConfigured()) {
    return Response.json(
      { error: 'POSTGRES_URL or DATABASE_URL is not configured' },
      { status: 500 },
    )
  }

  return auth.handler(request)
}
