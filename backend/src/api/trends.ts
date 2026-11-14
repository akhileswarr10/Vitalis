/**
 * api/trends.ts – GET /api/astronauts/:id/trends/:metric
 * Returns time-series values for a single metric plus effective thresholds.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../app.js';
import { checkInsRepo } from '../repo/checkIns.js';
import { thresholdsByKey, METRIC_KEYS } from '../engine/thresholds.js';
import { computeHrBaseline, type CheckInEntry } from '../engine/evaluate.js';
import type { CheckIn } from '../schemas.js';

interface TrendsRouteOpts {
  deps: AppDeps;
}

export const trendsRoute: FastifyPluginAsync<TrendsRouteOpts> = async (app, opts) => {
  const { db } = opts.deps;

  app.get<{ Params: { id: string; metric: string } }>(
    '/astronauts/:id/trends/:metric',
    async (req, reply) => {
      const { id, metric } = req.params;

      // Validate metric key (400 for unknown).
      const validKey = METRIC_KEYS.find(k => k === metric);
      if (!validKey) {
        return reply.status(400).send({
          error: `Unknown metric "${metric}". Valid keys: ${METRIC_KEYS.join(', ')}`,
        });
      }

      const threshold = thresholdsByKey.get(validKey);
      if (!threshold) {
        return reply.status(400).send({ error: `Threshold not found for metric "${validKey}"` });
      }

      // findByAstronautId already returns CheckIn[] sorted by day ASC.
      const checkIns = await checkInsRepo.findByAstronautId(db, id);

      // Sort ascending by day (repo guarantees this, but we sort defensively).
      const sorted = [...checkIns].sort((a: CheckIn, b: CheckIn) => a.day - b.day);

      const entries: CheckInEntry[] = sorted.map(ci => ({
        day: ci.day,
        hr: ci.hr,
        sbp: ci.sbp,
        ortho: ci.ortho,
        ex: ci.ex,
        bone: ci.bone,
        temp: ci.temp,
        sym: ci.sym,
        sleep: ci.sleep,
        mood: ci.mood,
        stress: ci.stress,
        dose: ci.dose,
        co2: ci.co2,
      }));

      // Build series.
      const series = sorted.map(ci => ({
        day: ci.day,
        value: ci[validKey as keyof CheckIn] as number,
      }));

      // Compute effective thresholds (apply HR baseline if baseline_relative).
      let effectiveWatch = threshold.watch;
      let effectiveAction = threshold.action;
      let hrBaseline: number | null = null;

      if (threshold.baseline_relative) {
        const { baseline } = computeHrBaseline(entries);
        hrBaseline = baseline;
        if (baseline !== null) {
          effectiveWatch = baseline + threshold.watch;
          effectiveAction = baseline + threshold.action;
        }
      }

      return reply.send({
        astronaut_id: id,
        metric: validKey,
        label: threshold.label,
        unit: threshold.unit,
        domain: threshold.domain,
        direction: threshold.direction,
        effectiveWatch,
        effectiveAction,
        hrBaseline,
        why: threshold.why,
        source: threshold.source,
        series,
      });
    },
  );
};
