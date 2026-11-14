/**
 * repo/astronauts.ts – parameterized queries for the public.astronauts table.
 * Matches supabase/migrations/0001_init.sql DDL exactly.
 */
import type { Db } from '../db.js';
import type { Astronaut } from '../schemas.js';
export declare const astronautsRepo: {
    /** Ensure astronaut exists or update label if already present. */
    ensure(db: Db, astronaut: {
        id: string;
        label: string;
    }): Promise<Astronaut>;
    /** Find astronaut by id. */
    findById(db: Db, id: string): Promise<Astronaut | null>;
    /** List all astronauts ordered by created_at. */
    list(db: Db): Promise<Astronaut[]>;
};
//# sourceMappingURL=astronauts.d.ts.map