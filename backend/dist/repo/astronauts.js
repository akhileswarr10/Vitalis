export const astronautsRepo = {
    /** Ensure astronaut exists or update label if already present. */
    async ensure(db, astronaut) {
        const sql = `
      INSERT INTO public.astronauts (id, label)
      VALUES ($1, $2)
      ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label
      RETURNING id, label, created_at;
    `;
        const result = await db.query(sql, [astronaut.id, astronaut.label]);
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
    async findById(db, id) {
        const sql = `
      SELECT id, label, created_at
      FROM public.astronauts
      WHERE id = $1;
    `;
        const result = await db.query(sql, [id]);
        const row = result.rows[0];
        if (!row)
            return null;
        return {
            id: String(row.id),
            label: String(row.label),
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        };
    },
    /** List all astronauts ordered by created_at. */
    async list(db) {
        const sql = `
      SELECT id, label, created_at
      FROM public.astronauts
      ORDER BY created_at ASC;
    `;
        const result = await db.query(sql);
        return result.rows.map(row => ({
            id: String(row.id),
            label: String(row.label),
            created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
        }));
    },
};
//# sourceMappingURL=astronauts.js.map