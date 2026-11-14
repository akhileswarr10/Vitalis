/**
 * api/checkins.ts – Check-in routes:
 * POST /api/astronauts/:id/checkins (validated, idempotent upsert)
 * GET  /api/astronauts/:id/checkins (chronological history)
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
type RouteOpts = {
    deps: AppDeps;
};
export declare const checkinsRoute: FastifyPluginAsync<RouteOpts>;
export {};
//# sourceMappingURL=checkins.d.ts.map