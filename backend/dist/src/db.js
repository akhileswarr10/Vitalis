/**
 * db.ts – database abstraction.
 *
 * Production: pg.Pool over Supabase Postgres (TLS on, parameterized queries only).
 * Tests/CI:   PGlite in-process Postgres (DATABASE_URL = "pglite://memory").
 *             Applies supabase/migrations/*.sql in order on first use.
 *
 * CLAUDE.md rule 7: DB access ONLY via parameterized queries. No string-built SQL.
 */
import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From backend/src/db.ts (or backend/dist/db.js after build):
// go up 2 levels → vitalis-kit root → supabase/migrations
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');
/** Load and apply all supabase/migrations/*.sql files in lexicographic order. */
async function applyMigrations(exec) {
    const files = readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
        // Strip RLS statements – PGlite supports the syntax but doesn't enforce it;
        // that's fine for tests (backend-only access is a Supabase production concern).
        const testSql = sql.replace(/^\s*alter\s+table\s+\S+\s+enable\s+row\s+level\s+security\s*;/gim, '');
        await exec(testSql);
    }
}
/** Create the appropriate Db implementation based on DATABASE_URL. */
export async function createDb(databaseUrl) {
    if (databaseUrl === 'pglite://memory') {
        // ---- PGlite (tests only) ------------------------------------------------
        const { PGlite } = await import('@electric-sql/pglite');
        const pglite = new PGlite(); // in-memory
        await applyMigrations(sql => pglite.exec(sql));
        return {
            async query(sql, params) {
                const result = await pglite.query(sql, params ?? []);
                return { rows: result.rows };
            },
            async close() {
                // PGlite 0.2 may not have a close(); gracefully ignore
                if (typeof pglite.close === 'function') {
                    await pglite.close();
                }
            },
        };
    }
    // ---- node-postgres Pool (production / development) -----------------------
    const pool = new Pool({
        connectionString: databaseUrl,
        // TLS on for Supabase pooler (required; self-signed certs are fine for the pooler)
        ssl: { rejectUnauthorized: false },
        max: 10,
    });
    // Eagerly verify connectivity; fail fast at startup rather than on first request
    await pool.query('SELECT 1');
    return {
        async query(sql, params) {
            const result = await pool.query(sql, params ?? []);
            return { rows: result.rows };
        },
        async close() {
            await pool.end();
        },
    };
}
//# sourceMappingURL=db.js.map