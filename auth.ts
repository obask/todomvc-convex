import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { SQL } from 'bun'

const env = Bun.env
const connectionString = env.POSTGRES_URL ?? env.DATABASE_URL
const sessionCookieName = 'simple_auth_session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

export const authSql = connectionString
  ? new SQL({
      url: connectionString,
      idleTimeout: readPositiveNumber(env.POSTGRES_IDLE_TIMEOUT, 5),
      max: readPositiveNumber(env.POSTGRES_MAX_CONNECTIONS, 5),
      maxLifetime: readPositiveNumber(env.POSTGRES_MAX_LIFETIME, 60 * 30),
    })
  : null

type AuthUser = {
  id: string
  name: string
  email: string
}

type AuthSession = {
  user: AuthUser
}

type AuthPayload = {
  uid: string
  name: string
  email: string
}

type UserAccountRow = {
  id: string
  name: string
  email: string
  password: string | null
}

type PasswordVerificationResult =
  | { ok: true }
  | { ok: false; reason: 'mismatch' | 'unsupported-algorithm' }

export function isAuthDatabaseConfigured() {
  return Boolean(authSql)
}

export async function signUp(request: Request): Promise<Response> {
  const configError = readAuthConfigError()
  if (configError) return json({ error: configError }, 500)

  const body = await readJson(request)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')
  const name = readString(body, 'name') || email.split('@')[0] || email

  if (!email || !isValidEmail(email) || password.length < 8) {
    return json(
      { error: 'Valid email and password of at least 8 characters are required' },
      400,
    )
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    return json({ error: 'Account already exists' }, 409)
  }

  const userId = crypto.randomUUID()
  const accountId = crypto.randomUUID()
  const hashedPassword = await Bun.password.hash(password)
  const database = getSql()

  await database.begin(async (tx) => {
    await tx`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${name}, ${email}, true, now(), now())
    `
    await tx`
      insert into account (
        id,
        "accountId",
        "providerId",
        "userId",
        password,
        "createdAt",
        "updatedAt"
      )
      values (
        ${accountId},
        ${email},
        'credential',
        ${userId},
        ${hashedPassword},
        now(),
        now()
      )
    `
  })

  return jsonWithSession({ user: { id: userId, name, email } }, { uid: userId, name, email })
}

export async function signIn(request: Request): Promise<Response> {
  const configError = readAuthConfigError()
  if (configError) return json({ error: configError }, 500)

  const body = await readJson(request)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')
  const found = await findUserByEmail(email)
  const verification = found?.password
    ? await verifyStoredPassword(password, found.password)
    : { ok: false, reason: 'mismatch' as const }

  if (!verification.ok && verification.reason === 'unsupported-algorithm') {
    return json(
      { error: 'Stored password hash algorithm is not supported by Bun.password' },
      409,
    )
  }

  if (!verification.ok) {
    return json({ error: 'Invalid email or password' }, 401)
  }

  return jsonWithSession(
    {
      user: {
        id: found.id,
        name: found.name,
        email: found.email,
      },
    },
    {
      uid: found.id,
      name: found.name,
      email: found.email,
    },
  )
}

export function signOut(): Response {
  const headers = new Headers()
  headers.append('set-cookie', serializeCookie(sessionCookieName, '', {
    expires: new Date(0),
    maxAge: 0,
  }))
  return Response.json({ ok: true }, { headers })
}

export async function getSession(request: Request): Promise<AuthSession | null> {
  const payload = await readAuthPayload(request.headers)
  if (!payload) return null

  return {
    user: {
      id: payload.uid,
      name: payload.name,
      email: payload.email,
    },
  }
}

export async function requireUserId(request: Request): Promise<string> {
  const authSession = await getSession(request)
  if (!authSession) throw new Error('Unauthorized')
  return authSession.user.id
}

async function findUserByEmail(email: string) {
  const database = getSql()
  const [row] = (await database`
    select
      u.id,
      u.name,
      u.email,
      a.password
    from "user" u
    inner join account a
      on a."userId" = u.id
      and a."providerId" = 'credential'
    where u.email = ${email}
    limit 1
  `) as UserAccountRow[]

  return row ?? null
}

async function jsonWithSession(body: unknown, payload: AuthPayload): Promise<Response> {
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000)
  const value = await createAuthCookieValue(payload)
  const headers = new Headers()
  headers.append('set-cookie', serializeCookie(sessionCookieName, encodeURIComponent(value), {
    expires: expiresAt,
    maxAge: sessionMaxAgeSeconds,
  }))
  return Response.json(body, { headers })
}

function serializeCookie(
  name: string,
  value: string,
  options: { expires: Date; maxAge: number },
): string {
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`,
    `Expires=${options.expires.toUTCString()}`,
    env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

async function readAuthPayload(headers: Headers): Promise<AuthPayload | null> {
  const cookies = parseCookies(headers.get('cookie') ?? '')
  const value = cookies.get(sessionCookieName)
  return value ? await verifyAuthCookieValue(value) : null
}

async function createAuthCookieValue(payload: AuthPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds}s`)
    .sign(getAuthSecretKey())
}

async function verifyAuthCookieValue(cookieValue: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(cookieValue, getAuthSecretKey(), {
      algorithms: ['HS256'],
    })
    if (!hasAuthClaims(payload)) return null
    return {
      uid: payload.uid,
      name: payload.name,
      email: payload.email,
    }
  } catch {
    return null
  }
}

function hasAuthClaims(payload: JWTPayload): payload is JWTPayload & AuthPayload {
  return (
    typeof payload.uid === 'string' &&
    typeof payload.name === 'string' &&
    typeof payload.email === 'string'
  )
}

function getAuthSecretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret())
}

function getAuthSecret(): string {
  const secret =
    env.APP_AUTH_COOKIE_SECRET ??
    env.NEON_AUTH_COOKIE_SECRET ??
    env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (env.NODE_ENV === 'production') {
    throw new Error('APP_AUTH_COOKIE_SECRET is required')
  }
  return 'dev-only-simple-auth-cookie-secret'
}

function readAuthConfigError(): string | null {
  const hasSecret = Boolean(
    env.APP_AUTH_COOKIE_SECRET ??
      env.NEON_AUTH_COOKIE_SECRET ??
      env.BETTER_AUTH_SECRET,
  )
  if (!hasSecret && env.NODE_ENV === 'production') {
    return 'APP_AUTH_COOKIE_SECRET is required'
  }
  return null
}

async function verifyStoredPassword(
  password: string,
  stored: string,
): Promise<PasswordVerificationResult> {
  try {
    return (await Bun.password.verify(password, stored))
      ? { ok: true }
      : { ok: false, reason: 'mismatch' }
  } catch {
    return { ok: false, reason: 'unsupported-algorithm' }
  }
}

function parseCookies(cookieHeader: string): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName || rawValue.length === 0) continue
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')))
  }
  return cookies
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object') return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getSql() {
  if (!authSql) {
    throw new Error('POSTGRES_URL or DATABASE_URL is not configured')
  }

  return authSql
}

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
