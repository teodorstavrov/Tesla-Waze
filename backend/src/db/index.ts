import { Pool } from 'pg'

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

db.on('error', (err) => {
  console.error('[DB] Pool error:', err)
})

export async function initDb(): Promise<void> {
  const client = await db.connect()
  try {
    await client.query('SELECT 1')
    console.log('[DB] Connected to PostgreSQL')
  } finally {
    client.release()
  }
}
