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
import { getSpaceWeather } from '../services/spaceWeather.js';

interface SpaceWeatherRouteOpts {
  deps: AppDeps;
}

export const spaceWeatherRoute: FastifyPluginAsync<SpaceWeatherRouteOpts> = async (app, opts) => {
  const { config } = opts.deps;

  app.get('/space-weather', async (_req, reply) => {
    const result = await getSpaceWeather(config);
    return reply.status(200).send(result);
  });
};

