import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.env.local')) {
  loadEnvFile('.env.local')
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './api/lib/schema.ts',
  out: './db/drizzle',
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? '',
  },
  tablesFilter: ['todo'],
})
