import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL environment variable is required')

const pool = mysql.createPool(DATABASE_URL)
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'")
})

export const db = drizzle(pool, { schema, mode: 'default' })

export type Database = typeof db
