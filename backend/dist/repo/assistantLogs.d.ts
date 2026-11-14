/**
 * repo/assistantLogs.ts – parameterized queries for the public.assistant_logs table.
 * Matches supabase/migrations/0001_init.sql DDL exactly.
 */
import type { Db } from '../db.js';
import type { AssistantLog } from '../schemas.js';
export declare const assistantLogsRepo: {
    /** Log an assistant Q&A turn. */
    create(db: Db, log: {
        astronaut_id: string;
        question: string;
        answer: unknown;
        model?: string | null;
        fallback_used: boolean;
    }): Promise<AssistantLog>;
    /** Retrieve recent assistant logs for an astronaut. */
    findByAstronautId(db: Db, astronautId: string, limit?: number): Promise<AssistantLog[]>;
};
//# sourceMappingURL=assistantLogs.d.ts.map