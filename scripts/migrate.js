/**
 * Agelya — automatic database migration runner
 *
 * Reads SQL files from supabase/migrations/ in order and applies any that
 * haven't been applied yet. Applied migrations are tracked in the
 * `schema_migrations` table inside the same Postgres database.
 *
 * Required env var: DATABASE_URL
 * Optional:         NEXT_PUBLIC_APP_URL, CRON_SECRET
 */

'use strict'

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DATABASE_URL = process.env.DATABASE_URL
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations')

const OPTIONAL_MIGRATIONS = new Set([
  '007_cron_jobs.sql',
])

function interpolate(sql) {
  return sql.replace(/\$\{([A-Z0-9_]+)\}/g, (match, key) => {
    const val = process.env[key]
    if (!val) {
      console.warn(`  ⚠  env var ${key} is not set — placeholder left as-is`)
      return match
    }
    return val
  })
}

async function connectWithRetry() {
  let lastErr

  for (let attempt = 1; attempt <= 5; attempt++) {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })

    try {
      await client.connect()
      return client
    } catch (err) {
      lastErr = err
      await client.end().catch(() => {})
      console.log(`  Connection attempt ${attempt}/5 failed: ${err.message}`)

      if (attempt < 5) {
        console.log('  Retrying in 5 s…')
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  throw lastErr
}

async function main() {
  if (!DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set.')
    console.error('Use the Supabase Session pooler connection string in Vercel.')
    process.exit(1)
  }

  const pool = await connectWithRetry()

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query('ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY')

    const { rows } = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename')
    const applied = new Set(rows.map((r) => r.filename))

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    const pending = files.filter((f) => !applied.has(f))

    if (pending.length === 0) {
      console.log('✓ All migrations already applied — nothing to do.')
      return
    }

    console.log(`Found ${pending.length} pending migration(s):`)

    let failed = 0

    for (const file of pending) {
      process.stdout.write(`  → ${file} … `)

      const filePath = path.join(MIGRATIONS_DIR, file)
      const rawSql = fs.readFileSync(filePath, 'utf8')
      const sql = interpolate(rawSql)

      try {
        await pool.query(sql)
        await pool.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        )
        console.log('done')
      } catch (err) {
        const msg = err.message || ''

        if (
          OPTIONAL_MIGRATIONS.has(file) &&
          (msg.includes('schema "cron" does not exist') ||
            msg.includes('function cron.') ||
            msg.includes('schema "net" does not exist') ||
            msg.includes('function net.'))
        ) {
          console.log('skipped (optional — enable pg_cron / pg_net in Supabase Dashboard → Database → Extensions)')
        } else if (msg.includes('already exists')) {
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          )
          console.log('skipped (already applied)')
        } else {
          console.log('FAILED')
          console.error(`     Error: ${msg}`)
          failed++
        }
      }
    }

    if (failed > 0) {
      console.error(`\n${failed} migration(s) failed. Fix the errors above and re-run.`)
      process.exit(1)
    }

    console.log('\n✓ Migrations complete.')
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err.message)
  process.exit(1)
})
