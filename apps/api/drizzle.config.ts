import { defineConfig } from 'drizzle-kit'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is required')

export default defineConfig({
  schema: './src/db/schema/*',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    url: DATABASE_URL,
  },
})
