import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadEnvFile } from 'node:process'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate as migrateDrizzle } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

if (!process.env.VERCEL && existsSync('.env.local')) {
  loadEnvFile('.env.local')
}

const databaseUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('POSTGRES_URL or DATABASE_URL is required to run migrations')
}

const pool = new Pool({ connectionString: databaseUrl })

try {
  await withMigrationLock(async () => {
    await migrateDrizzleFiles()
  })
} finally {
  await pool.end()
}

async function withMigrationLock(run) {
  const client = await pool.connect()

  try {
    await client.query(`select pg_advisory_lock(hashtext('todomvc_vite_migrations'))`)
    await run(client)
  } finally {
    await client.query(`select pg_advisory_unlock(hashtext('todomvc_vite_migrations'))`)
    client.release()
  }
}

async function migrateDrizzleFiles() {
  const migrationsFolder = 'db/drizzle'
  if (!existsSync(join(migrationsFolder, 'meta', '_journal.json'))) return

  console.log('Applying Drizzle migrations')
  await migrateDrizzle(drizzle(pool), { migrationsFolder })
}
