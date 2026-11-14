/**
 * repo/checkIns.ts – parameterized queries for the public.check_ins table.
 * Idempotent upsert via ON CONFLICT (astronaut_id, day) DO UPDATE.
 */
import type { Db } from '../db.js';
import { type CheckIn, type CheckInCreate } from '../schemas.js';
export declare const checkInsRepo: {
    /**
     * Idempotent check-in insert/update.
     * Matches unique(astronaut_id, day) constraint in supabase/migrations/0001_init.sql.
     */
    createOrUpdate(db: Db, astronautId: string, data: CheckInCreate): Promise<CheckIn>;
    /** Find all check-ins for an astronaut ordered by day ascending. */
    findByAstronautId(db: Db, astronautId: string): Promise<CheckIn[]>;
    /** Find specific day check-in for an astronaut. */
    findByAstronautAndDay(db: Db, astronautId: string, day: number): Promise<CheckIn | null>;
};
//# sourceMappingURL=checkIns.d.ts.map