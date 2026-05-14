import {
  getSession,
  isAuthDatabaseConfigured,
  signIn,
  signOut,
  signUp,
} from './auth'

export async function handleAuthRequest(request: Request) {
  try {
    const path = getAuthPath(request)

    if (request.method === 'POST' && path === 'sign-up/email') {
      if (!isAuthDatabaseConfigured()) {
        return databaseConfigError()
      }
      return await signUp(request)
    }

    if (request.method === 'POST' && path === 'sign-in/email') {
      if (!isAuthDatabaseConfigured()) {
        return databaseConfigError()
      }
      return await signIn(request)
    }

    if (request.method === 'POST' && path === 'sign-out') {
      return signOut()
    }

    if (request.method === 'GET' && path === 'get-session') {
      return Response.json(await getSession(request))
    }

    return Response.json(
      { error: 'Auth route not found' },
      {
        status: 404,
        headers: { Allow: 'GET, POST' },
      },
    )
  } catch (error) {
    console.error(formatError('[auth] unhandled error', error))
    return Response.json({ error: 'Unable to process authentication' }, { status: 500 })
  }
}

function getAuthPath(request: Request): string {
  const url = new URL(request.url)
  return url.pathname.replace(/^\/api\/auth\/?/, '').replace(/\/$/, '')
}

function databaseConfigError() {
  return Response.json(
    { error: 'POSTGRES_URL or DATABASE_URL is not configured' },
    { status: 500 },
  )
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
