import { mapCheckInRow } from '../schemas.js';
export const checkInsRepo = {
    /**
     * Idempotent check-in insert/update.
     * Matches unique(astronaut_id, day) constraint in supabase/migrations/0001_init.sql.
     */
    async createOrUpdate(db, astronautId, data) {
        const sql = `
      INSERT INTO public.check_ins (
        astronaut_id, day, hr, sbp, ortho, ex, bone, temp, sym, sleep, mood, stress, dose, co2
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (astronaut_id, day) DO UPDATE SET
        hr = EXCLUDED.hr,
        sbp = EXCLUDED.sbp,
        ortho = EXCLUDED.ortho,
        ex = EXCLUDED.ex,
        bone = EXCLUDED.bone,
        temp = EXCLUDED.temp,
        sym = EXCLUDED.sym,
        sleep = EXCLUDED.sleep,
        mood = EXCLUDED.mood,
        stress = EXCLUDED.stress,
        dose = EXCLUDED.dose,
        co2 = EXCLUDED.co2
      RETURNING *;
    `;
        const params = [
            astronautId,
            data.day,
            data.hr,
            data.sbp,
            data.ortho,
            data.ex,
            data.bone,
            data.temp,
            data.sym,
            data.sleep,
            data.mood,
            data.stress,
            data.dose,
            data.co2,
        ];
        const result = await db.query(sql, params);
        const row = result.rows[0];
        if (!row) {
            throw new Error(`Failed to upsert check-in for astronaut ${astronautId} day ${data.day}`);
        }
        return mapCheckInRow(row);
    },
    /** Find all check-ins for an astronaut ordered by day ascending. */
    async findByAstronautId(db, astronautId) {
        const sql = `
      SELECT *
      FROM public.check_ins
      WHERE astronaut_id = $1
      ORDER BY day ASC;
    `;
        const result = await db.query(sql, [astronautId]);
        return result.rows.map(mapCheckInRow);
    },
    /** Find specific day check-in for an astronaut. */
    async findByAstronautAndDay(db, astronautId, day) {
        const sql = `
      SELECT *
      FROM public.check_ins
      WHERE astronaut_id = $1 AND day = $2;
    `;
        const result = await db.query(sql, [astronautId, day]);
        const row = result.rows[0];
        if (!row)
            return null;
        return mapCheckInRow(row);
    },
};
//# sourceMappingURL=checkIns.js.map