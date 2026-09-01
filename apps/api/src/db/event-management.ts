import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

const EVENT_MANAGEMENT_DATABASE_URL = process.env.EVENT_MANAGEMENT_DATABASE_URL
if (!EVENT_MANAGEMENT_DATABASE_URL) {
  throw new Error('EVENT_MANAGEMENT_DATABASE_URL environment variable is required')
}

const pool = mysql.createPool(EVENT_MANAGEMENT_DATABASE_URL)
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'")
})

export const eventManagementDb = drizzle(pool, { mode: 'default' })
export type EventManagementDatabase = typeof eventManagementDb
