/**
 * api/status.ts – GET /api/astronauts/:id/status
 * Loads check-ins from DB → assess() → enrich with actions → return.
 * CLAUDE.md rule 1: only the engine decides the status.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
interface StatusRouteOpts {
    deps: AppDeps;
}
export declare const statusRoute: FastifyPluginAsync<StatusRouteOpts>;
export {};
//# sourceMappingURL=status.d.ts.map