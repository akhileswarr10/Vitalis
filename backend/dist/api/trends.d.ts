/**
 * api/trends.ts – GET /api/astronauts/:id/trends/:metric
 * Returns time-series values for a single metric plus effective thresholds.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
interface TrendsRouteOpts {
    deps: AppDeps;
}
export declare const trendsRoute: FastifyPluginAsync<TrendsRouteOpts>;
export {};
//# sourceMappingURL=trends.d.ts.map