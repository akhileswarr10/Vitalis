import { checkInsRepo } from '../repo/checkIns.js';
import { assess } from '../engine/evaluate.js';
import { detectAnomalies } from '../engine/anomaly.js';
import { getActions } from '../engine/actions.js';
export const statusRoute = async (app, opts) => {
    const { db } = opts.deps;
    app.get('/astronauts/:id/status', async (req, reply) => {
        const { id } = req.params;
        // Load all check-ins for this astronaut; repo returns CheckIn[] sorted by day ASC.
        const checkIns = await checkInsRepo.findByAstronautId(db, id);
        const entries = checkIns.map(ci => ({
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
        const result = assess(entries);
        const anomalies = detectAnomalies(entries);
        // Enrich each domain with deterministic guidance steps.
        const enrichedDomains = result.domains.map(ds => ({
            ...ds,
            actions: getActions(ds.domain, ds.level),
        }));
        return reply.send({
            astronaut_id: id,
            overall: result.overall,
            multi_domain: result.multi_domain,
            hrBaseline: result.hrBaseline,
            hrBaselineFallback: result.hrBaselineFallback,
            domains: enrichedDomains,
            metrics: result.metrics,
            anomalies,
            entry_count: entries.length,
        });
    });
};
//# sourceMappingURL=status.js.map