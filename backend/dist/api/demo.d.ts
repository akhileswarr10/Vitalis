/**
 * api/demo.ts – Demo seeding route:
 * POST /api/demo/seed (APP_ENV=development only, 403 in production)
 *
 * Populates crew-01 with 30 days of synthetic data:
 * - Days 1–17: stable baseline
 * - Days 18–30: slow hidden decline in sleep, mood and exercise
 * - Day 22: radiation dose spike
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
type RouteOpts = {
    deps: AppDeps;
};
export declare const demoRoute: FastifyPluginAsync<RouteOpts>;
export {};
//# sourceMappingURL=demo.d.ts.map