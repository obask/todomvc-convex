import { attachDatabasePool, waitUntil } from '@vercel/functions'
import { betterAuth } from 'better-auth'
import { SQL } from 'bun'
import { PostgresDialect } from 'kysely'
import pg from 'pg'

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
const authPool = connectionString
  ? new pg.Pool({
      connectionString,
      idleTimeoutMillis: readPositiveNumber(env.POSTGRES_IDLE_TIMEOUT, 5) * 1000,
      max: readPositiveNumber(env.POSTGRES_MAX_CONNECTIONS, 5),
      maxLifetimeSeconds: readPositiveNumber(
        env.POSTGRES_MAX_LIFETIME,
        60 * 30,
      ),
    })
  : null

if (authPool) attachDatabasePool(authPool)

export const authSql = sql

export const auth = betterAuth({
  database: authPool
    ? {
        dialect: new PostgresDialect({
          pool: authPool,
        }),
        type: 'postgres',
      }
    : undefined,
  emailAndPassword: {
    enabled: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  advanced: {
    backgroundTasks: {
      handler: waitUntil,
    },
  },
  experimental: {
    joins: true,
  },
})

export function isAuthDatabaseConfigured() {
  return Boolean(sql)
}

function readPositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
