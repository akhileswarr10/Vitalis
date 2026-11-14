/**
 * repo/astronauts.ts – parameterized queries for the public.astronauts table.
 * Matches supabase/migrations/0001_init.sql DDL exactly.
 */
import type { Db } from '../db.js';
import type { Astronaut } from '../schemas.js';

export const astronautsRepo = {
  /** Ensure astronaut exists or update label if already present. */
  async ensure(db: Db, astronaut: { id: string; label: string }): Promise<Astronaut> {
    const sql = `
      INSERT INTO public.astronauts (id, label)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label
      RETURNING id, label, created_at;
    `;
    const result = await db.query<Record<string, unknown>>(sql, [astronaut.id, astronaut.label]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to ensure astronaut ${astronaut.id}`);
    }
    return {
      id: String(row.id),
      label: String(row.label),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  },

  /** Find astronaut by id. */
  async findById(db: Db, id: string): Promise<Astronaut | null> {
    const sql = `
      SELECT id, label, created_at
      FROM public.astronauts
      WHERE id = $1;
    `;
    const result = await db.query<Record<string, unknown>>(sql, [id]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      label: String(row.label),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  },

  /** List all astronauts ordered by created_at. */
  async list(db: Db): Promise<Astronaut[]> {
    const sql = `
      SELECT id, label, created_at
      FROM public.astronauts
      ORDER BY created_at ASC;
    `;
    const result = await db.query<Record<string, unknown>>(sql);
    return result.rows.map(row => ({
      id: String(row.id),
      label: String(row.label),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  },
};
