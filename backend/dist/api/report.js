import { astronautsRepo } from '../repo/astronauts.js';
import { checkInsRepo } from '../repo/checkIns.js';
import { assess } from '../engine/evaluate.js';
import { detectAnomalies } from '../engine/anomaly.js';
import { getActions } from '../engine/actions.js';
import { thresholdsByKey } from '../engine/thresholds.js';
const LEVEL_NAMES = {
    0: 'NOMINAL (Level 0)',
    1: 'WATCH (Level 1)',
    2: 'ACTION NEEDED (Level 2)',
};
const DOMAIN_LABELS = {
    cardio: 'Cardiovascular',
    msk: 'Musculoskeletal',
    immune: 'Immune & Infection',
    behav: 'Behavioral & Cognitive',
    env: 'Habitability & Environment',
};
/**
 * Pure report generator function.
 */
export function generatePlainTextReport(astronaut, entries, generatedAt = new Date()) {
    const result = assess(entries);
    const anomalies = detectAnomalies(entries);
    const sorted = [...entries].sort((a, b) => a.day - b.day);
    const latestDay = sorted.length > 0 ? (sorted[sorted.length - 1]?.day ?? null) : null;
    const lines = [];
    const sepDouble = '='.repeat(76);
    const sepSingle = '-'.repeat(76);
    lines.push(sepDouble);
    lines.push('VITALIS CREW HEALTH STATUS REPORT — GROUND TELEMETRY');
    lines.push(sepDouble);
    lines.push(`Astronaut ID    : ${astronaut.id} (${astronaut.label})`);
    lines.push(`Generated At    : ${generatedAt.toISOString()}`);
    lines.push(`Mission Day     : ${latestDay !== null ? `Day ${latestDay}` : 'No telemetry recorded'}`);
    lines.push(`Logged Entries  : ${entries.length}`);
    lines.push('');
    lines.push('DISCLAIMER:');
    lines.push('Decision support only. Not a medical device.');
    lines.push('Ground flight surgeon review required for all clinical countermeasures.');
    lines.push(sepDouble);
    // Overall status summary
    lines.push('');
    lines.push(`OVERALL HEALTH STATUS : ${LEVEL_NAMES[result.overall]}`);
    lines.push(`MULTI-DOMAIN ELEVATION: ${result.multi_domain ? 'YES (2+ domains elevated)' : 'NO'}`);
    lines.push(`HEART RATE BASELINE   : ${result.hrBaseline !== null
        ? `${result.hrBaseline.toFixed(1)} bpm${result.hrBaselineFallback ? ' (fallback to latest)' : ''}`
        : 'Not established'}`);
    lines.push('');
    // Domain Breakdown
    lines.push(sepSingle);
    lines.push('STATUS PER DOMAIN');
    lines.push(sepSingle);
    for (const ds of result.domains) {
        const domainLabel = DOMAIN_LABELS[ds.domain] ?? ds.domain;
        lines.push(`[${ds.domain.toUpperCase()}] ${domainLabel}: ${LEVEL_NAMES[ds.level]}`);
        // Flagged reasons
        const flaggedMetrics = ds.metrics.filter(m => m.level > 0);
        if (flaggedMetrics.length > 0) {
            lines.push('  Flagged reasons:');
            for (const m of flaggedMetrics) {
                const t = thresholdsByKey.get(m.key);
                const condition = m.level === 2 ? 'ACTION threshold reached' : 'WATCH threshold reached';
                const limit = m.level === 2 ? m.effectiveAction : m.effectiveWatch;
                lines.push(`  * ${t.label} (${m.key}): ${m.value} ${t.unit} (${condition}: limit ${limit} ${t.unit}). ${t.why}`);
            }
        }
        else {
            lines.push('  All domain metrics are nominal.');
        }
        lines.push('');
    }
    // Drift Flags
    lines.push(sepSingle);
    lines.push('DRIFT FLAGS (Early Warning Before Threshold Crossing)');
    lines.push(sepSingle);
    const driftMetrics = result.metrics.filter(m => m.drift !== undefined);
    if (driftMetrics.length > 0) {
        for (const m of driftMetrics) {
            const d = m.drift;
            if (!d)
                continue;
            const t = thresholdsByKey.get(m.key);
            lines.push(`* ${t.label} (${m.key}): Drifting ${d.direction} | 3-day mean: ${d.last3Mean.toFixed(2)} ${t.unit} vs prior 14-day mean: ${d.prev14Mean.toFixed(2)} ${t.unit} (tolerance: ${d.tolerance} ${t.unit}).`);
        }
    }
    else {
        lines.push('No metric drift flags detected.');
    }
    lines.push('');
    // Anomalies
    lines.push(sepSingle);
    lines.push('STATISTICAL ANOMALIES (Rolling Z-Score Advisory |z| >= 2.5)');
    lines.push(sepSingle);
    if (anomalies.length > 0) {
        for (const a of anomalies) {
            const t = thresholdsByKey.get(a.metric);
            lines.push(`* ${t.label} (${a.metric}): z = ${a.z > 0 ? '+' : ''}${a.z.toFixed(2)} (${a.direction}). Advisory only.`);
        }
    }
    else {
        lines.push('No statistical anomalies detected.');
    }
    lines.push('');
    // Latest Values (All 12 metrics)
    lines.push(sepSingle);
    lines.push('LATEST METRIC VALUES');
    lines.push(sepSingle);
    for (const m of result.metrics) {
        const t = thresholdsByKey.get(m.key);
        const levelTag = m.level === 2 ? '[ACTION]' : m.level === 1 ? '[WATCH]' : '[NOMINAL]';
        const limitInfo = t.baseline_relative
            ? `baseline ${result.hrBaseline?.toFixed(1) ?? 'N/A'}, watch +${t.watch}, action +${t.action}`
            : `watch ${t.watch}, action ${t.action}`;
        lines.push(`  ${m.key.padEnd(8)} : ${String(m.value).padStart(6)} ${t.unit.padEnd(6)} ${levelTag.padEnd(9)} (${t.label}; limits: ${limitInfo})`);
    }
    lines.push('');
    // Deterministic Actions & Emergency Procedures
    lines.push(sepSingle);
    lines.push('DETERMINISTIC ACTION PROTOCOL');
    lines.push(sepSingle);
    if (result.overall === 2) {
        lines.push('*** EMERGENCY ACTION REQUIRED (LEVEL 2 CRITICAL STATUS) ***');
        lines.push('The following emergency clinical countermeasure protocols must be executed immediately:');
        lines.push('');
    }
    let hasActions = false;
    for (const ds of result.domains) {
        if (ds.level > 0) {
            hasActions = true;
            const actions = getActions(ds.domain, ds.level);
            const domainLabel = DOMAIN_LABELS[ds.domain] ?? ds.domain;
            lines.push(`[${domainLabel} - Level ${ds.level} Guidance]`);
            for (let i = 0; i < actions.length; i++) {
                lines.push(`  ${i + 1}. ${actions[i]}`);
            }
            lines.push('');
        }
    }
    if (!hasActions) {
        lines.push('All parameters within nominal operational limits. Continue standard flight schedule.');
        lines.push('');
    }
    lines.push(sepDouble);
    lines.push('END OF REPORT — VITALIS ONBOARD DECISION SUPPORT');
    lines.push('Decision support only. Not a medical device.');
    lines.push(sepDouble);
    return lines.join('\n');
}
export const reportRoute = async (app, opts) => {
    const { db } = opts.deps;
    app.get('/astronauts/:id/report', async (req, reply) => {
        const { id } = req.params;
        const astro = await astronautsRepo.findById(db, id);
        if (!astro) {
            return reply.status(404).send({
                statusCode: 404,
                error: 'Not Found',
                message: `Astronaut '${id}' not found`,
            });
        }
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
        const reportText = generatePlainTextReport(astro, entries);
        return reply
            .type('text/plain; charset=utf-8')
            .header('Content-Disposition', `inline; filename="vitalis-report-${id}.txt"`)
            .send(reportText);
    });
};
//# sourceMappingURL=report.js.map