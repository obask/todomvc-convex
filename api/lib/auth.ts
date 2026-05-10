import { waitUntil } from '@vercel/functions'
import { betterAuth } from 'better-auth'
import { pool } from './db.js'

export const authOptions = {
  appName: 'Todos',
  baseURL: getBaseUrl(),
  database: pool,
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
  return 'http://localhost:5173'
}
