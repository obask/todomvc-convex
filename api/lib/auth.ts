import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { IncomingHttpHeaders } from 'node:http'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { and, eq } from 'drizzle-orm'
import { db } from './drizzle.js'
import { account, user } from './schema.js'

const scryptAsync = promisify(scrypt)
const sessionCookieName = 'simple_auth_session'
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30

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
  exp: number
}

export async function signUp(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = await readJson(req)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')
  const name = readString(body, 'name') || email.split('@')[0] || email

  if (!email || !isValidEmail(email) || password.length < 8) {
    res.status(400).json({ error: 'Valid email and password of at least 8 characters are required' })
    return
  }

  const existing = await findUserByEmail(email)
  if (existing) {
    res.status(409).json({ error: 'Account already exists' })
    return
  }

  const userId = randomUUID()
  const now = new Date()
  await db.insert(user).values({
    id: userId,
    name,
    email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert(account).values({
    id: randomUUID(),
    accountId: email,
    providerId: 'credential',
    userId,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  })

  setSessionCookie(res, { uid: userId, name, email })
  res.status(200).json({ user: { id: userId, name, email } })
}

export async function signIn(req: VercelRequest, res: VercelResponse): Promise<void> {
  const body = await readJson(req)
  const email = normalizeEmail(readString(body, 'email'))
  const password = readString(body, 'password')
  const found = await findUserByEmail(email)

  if (!found || !found.account.password || !(await verifyPassword(password, found.account.password))) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  setSessionCookie(res, {
    uid: found.user.id,
    name: found.user.name,
    email: found.user.email,
  })
  res.status(200).json({
    user: {
      id: found.user.id,
      name: found.user.name,
      email: found.user.email,
    },
  })
}

export async function signOut(_req: VercelRequest, res: VercelResponse): Promise<void> {
  clearSessionCookie(res)
  res.status(200).json({ ok: true })
}

export function getSession(req: VercelRequest): AuthSession | null {
  const payload = readAuthPayload(req.headers)
  if (!payload) return null

  return {
    user: {
      id: payload.uid,
      name: payload.name,
      email: payload.email,
    },
  }
}

export function requireUserId(req: VercelRequest): string {
  const authSession = getSession(req)
  if (!authSession) throw new Error('Unauthorized')
  return authSession.user.id
}

async function findUserByEmail(email: string) {
  const [row] = await db
    .select({
      user,
      account,
    })
    .from(user)
    .innerJoin(
      account,
      and(eq(account.userId, user.id), eq(account.providerId, 'credential')),
    )
    .where(eq(user.email, email))
    .limit(1)
  return row ?? null
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt:${salt}:${derived.toString('base64url')}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false

  const expected = Buffer.from(hash, 'base64url')
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function setSessionCookie(
  res: VercelResponse,
  user: { uid: string; name: string; email: string },
): void {
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000)
  const value = createAuthCookieValue({
    ...user,
    exp: expiresAt.getTime(),
  })
  res.setHeader('set-cookie', serializeCookie(sessionCookieName, encodeURIComponent(value), {
    expires: expiresAt,
    maxAge: sessionMaxAgeSeconds,
  }))
}

function clearSessionCookie(res: VercelResponse): void {
  res.setHeader('set-cookie', serializeCookie(sessionCookieName, '', {
    expires: new Date(0),
    maxAge: 0,
  }))
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
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ].filter(Boolean).join('; ')
}

function readAuthPayload(headers: IncomingHttpHeaders): AuthPayload | null {
  const cookies = parseCookies(readHeader(headers.cookie) ?? '')
  const value = cookies.get(sessionCookieName)
  return value ? verifyAuthCookieValue(value) : null
}

function createAuthCookieValue(payload: AuthPayload): string {
  const body = base64url(JSON.stringify(payload))
  const signature = sign(body)
  return `${body}.${signature}`
}

function verifyAuthCookieValue(cookieValue: string): AuthPayload | null {
  const dot = cookieValue.lastIndexOf('.')
  if (dot <= 0) return null

  const body = cookieValue.slice(0, dot)
  const signature = cookieValue.slice(dot + 1)
  const expectedSignature = sign(body)
  if (!safeEqual(signature, expectedSignature)) return null

  try {
    const payload = JSON.parse(unbase64url(body).toString('utf8')) as Partial<AuthPayload>
    if (!payload.uid || typeof payload.uid !== 'string') return null
    if (!payload.name || typeof payload.name !== 'string') return null
    if (!payload.email || typeof payload.email !== 'string') return null
    if (!payload.exp || typeof payload.exp !== 'number') return null
    if (payload.exp <= Date.now()) return null
    return {
      uid: payload.uid,
      name: payload.name,
      email: payload.email,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

function sign(data: string): string {
  return base64url(createHmac('sha256', getAuthSecret()).update(data).digest())
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

function unbase64url(input: string): Buffer {
  return Buffer.from(input, 'base64url')
}

function getAuthSecret(): string {
  const secret =
    process.env.APP_AUTH_COOKIE_SECRET ??
    process.env.NEON_AUTH_COOKIE_SECRET ??
    process.env.BETTER_AUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_AUTH_COOKIE_SECRET is required')
  }
  return 'dev-only-simple-auth-cookie-secret'
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

async function readJson(req: VercelRequest): Promise<unknown> {
  if (req.body !== undefined) return req.body

  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return null

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
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

function readHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}
