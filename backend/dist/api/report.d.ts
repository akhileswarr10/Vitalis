/**
 * api/report.ts – GET /api/astronauts/:id/report
 * Plain-text ground telemetry and health status report for flight surgeons.
 *
 * RESTRICTIONS.md §1 & CLAUDE.md:
 * - Status is decided ONLY by engine/evaluate.ts
 * - Mandatory disclaimer: "Decision support only. Not a medical device."
 * - Content-Type: text/plain; charset=utf-8
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
import { type CheckInEntry } from '../engine/evaluate.js';
interface ReportRouteOpts {
    deps: AppDeps;
}
/**
 * Pure report generator function.
 */
export declare function generatePlainTextReport(astronaut: {
    id: string;
    label: string;
}, entries: CheckInEntry[], generatedAt?: Date): string;
export declare const reportRoute: FastifyPluginAsync<ReportRouteOpts>;
export {};
//# sourceMappingURL=report.d.ts.map