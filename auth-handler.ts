import { auth, isAuthDatabaseConfigured } from './auth'

export function handleAuthRequest(request: Request) {
  if (!isAuthDatabaseConfigured() && !isSignOutRequest(request)) {
    return Response.json(
      { error: 'POSTGRES_URL or DATABASE_URL is not configured' },
      { status: 500 },
    )
  }

  return auth.handler(request)
}

function isSignOutRequest(request: Request) {
  const url = new URL(request.url)
  return request.method === 'POST' && url.pathname === '/api/auth/sign-out'
}
