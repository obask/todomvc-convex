import { attachDatabasePool } from '@vercel/functions'
import { Pool } from 'pg'

export const pool = new Pool({
  connectionString: process.env.POSTGRES_URL ?? process.env.DATABASE_URL,
})

attachDatabasePool(pool)

export function hasDatabaseConfig(): boolean {
  return Boolean(
    process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE),
  )
}
