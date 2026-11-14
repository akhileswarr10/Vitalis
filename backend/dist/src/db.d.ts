/** Minimal DB interface implemented by both pg.Pool and PGlite wrappers. */
export interface Db {
    query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{
        rows: T[];
    }>;
    /** Close the connection pool / in-memory DB (call on graceful shutdown). */
    close(): Promise<void>;
}
/** Create the appropriate Db implementation based on DATABASE_URL. */
export declare function createDb(databaseUrl: string): Promise<Db>;
//# sourceMappingURL=db.d.ts.map