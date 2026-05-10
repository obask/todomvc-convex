import { waitUntil } from '@vercel/functions'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './drizzle.js'
import * as schema from './schema.js'

export const authOptions = {
  appName: 'Todos',
  baseURL: getBaseUrl(),
  trustedOrigins: getTrustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEON_AUTH_COOKIE_SECRET,
  advanced: {
    trustedProxyHeaders: true,
    backgroundTasks: {
      handler: waitUntil,
    },
  },
} satisfies Parameters<typeof betterAuth>[0]

export const auth = betterAuth(authOptions)

function getBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function getTrustedOrigins(request?: Request): string[] {
  return [
    new URL(getBaseUrl()).origin,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    request?.headers.get('origin'),
    request ? new URL(request.url).origin : null,
    ...readTrustedOriginsEnv(),
  ].filter((origin): origin is string => Boolean(origin))
}

function readTrustedOriginsEnv(): string[] {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}
