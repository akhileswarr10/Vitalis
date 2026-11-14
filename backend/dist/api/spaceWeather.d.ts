/**
 * api/spaceWeather.ts – GET /api/space-weather
 * Exposes NASA DONKI space weather telemetry (cached in-memory, fails soft).
 *
 * RESTRICTIONS.md & Prompt 10:
 * - On any failure returns { available: false } with HTTP 200.
 * - Does not alter health telemetry levels.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
interface SpaceWeatherRouteOpts {
    deps: AppDeps;
}
export declare const spaceWeatherRoute: FastifyPluginAsync<SpaceWeatherRouteOpts>;
export {};
//# sourceMappingURL=spaceWeather.d.ts.map