/**
 * evaluate.ts – Pure, deterministic health assessment engine.
 * No I/O, no randomness, no side effects. Same input → same output always.
 *
 * CLAUDE.md rule 1: Status is decided ONLY by this module. The LLM may explain but never override.
 */
import { thresholdsByKey } from './thresholds.js';
export const METRIC_KEYS = [
    'hr', 'sbp', 'ortho', 'ex', 'bone',
    'temp', 'sym', 'sleep', 'mood', 'stress',
    'dose', 'co2',
];
// ---- HR baseline -----------------------------------------------------------
/**
 * Compute the HR personal baseline.
 * - Requires entries sorted ascending by day (they are in assess()).
 * - Uses mean of first 7 entries when ≥3 entries exist.
 * - Falls back to the latest (last) HR value when < 3 entries.
 * - Returns null only when entries array is empty.
 */
export function computeHrBaseline(sortedEntries) {
    if (sortedEntries.length === 0)
        return { baseline: null, fallback: false };
    if (sortedEntries.length >= 3) {
        const first7 = sortedEntries.slice(0, 7);
        const mean = first7.reduce((s, e) => s + e.hr, 0) / first7.length;
        return { baseline: mean, fallback: false };
    }
    // Fewer than 3 entries: fall back to latest available HR value.
    // sortedEntries.length >= 1 is guaranteed by the early-return guard above.
    const latestEntry = sortedEntries.at(-1);
    return { baseline: latestEntry.hr, fallback: true };
}
// ---- Metric evaluation -----------------------------------------------------
function getValue(entry, key) {
    return entry[key];
}
function computeLevel(value, threshold, effectiveWatch, effectiveAction) {
    if (threshold.direction === 'higher_is_worse') {
        if (value >= effectiveAction)
            return 2;
        if (value >= effectiveWatch)
            return 1;
        return 0;
    }
    else {
        // lower_is_worse
        if (value <= effectiveAction)
            return 2;
        if (value <= effectiveWatch)
            return 1;
        return 0;
    }
}
function mean(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
}
function computeDrift(sorted, key, threshold, currentLevel) {
    // Drift detection requires ≥8 entries and the metric must be at level 0 (still in range).
    if (sorted.length < 8 || currentLevel !== 0)
        return undefined;
    const last3 = sorted.slice(-3);
    const prev14 = sorted.slice(-17, -3);
    if (prev14.length === 0)
        return undefined;
    const last3Mean = mean(last3.map(e => getValue(e, key)));
    const prev14Mean = mean(prev14.map(e => getValue(e, key)));
    const diff = last3Mean - prev14Mean;
    const isBadDirection = threshold.direction === 'higher_is_worse' ? diff > 0 : diff < 0;
    if (!isBadDirection)
        return undefined;
    if (Math.abs(diff) <= threshold.drift_tolerance)
        return undefined;
    return {
        metric: key,
        last3Mean,
        prev14Mean,
        tolerance: threshold.drift_tolerance,
        direction: diff > 0 ? 'up' : 'down',
    };
}
// ---- Main assess function --------------------------------------------------
export function assess(entries) {
    // Sort ascending by day (pure – does not mutate the caller's array).
    const sorted = [...entries].sort((a, b) => a.day - b.day);
    const { baseline: hrBaseline, fallback: hrBaselineFallback } = computeHrBaseline(sorted);
    const latest = sorted[sorted.length - 1];
    const metricResults = METRIC_KEYS.map(key => {
        const threshold = thresholdsByKey.get(key);
        const value = latest ? getValue(latest, key) : 0;
        // Effective thresholds: HR uses offsets from personal baseline.
        let effectiveWatch = threshold.watch;
        let effectiveAction = threshold.action;
        if (threshold.baseline_relative && hrBaseline !== null) {
            effectiveWatch = hrBaseline + threshold.watch;
            effectiveAction = hrBaseline + threshold.action;
        }
        const level = latest ? computeLevel(value, threshold, effectiveWatch, effectiveAction) : 0;
        const drift = computeDrift(sorted, key, threshold, level);
        const result = {
            key,
            value,
            level,
            effectiveWatch,
            effectiveAction,
        };
        if (drift !== undefined)
            result.drift = drift;
        return result;
    });
    // ---- Domain aggregation ------------------------------------------------
    const domainMap = new Map();
    for (const mr of metricResults) {
        const t = thresholdsByKey.get(mr.key);
        const list = domainMap.get(t.domain) ?? [];
        list.push(mr);
        domainMap.set(t.domain, list);
    }
    const domainStatuses = [];
    for (const [domain, metrics] of domainMap) {
        const level = metrics.reduce((m, mr) => (mr.level > m ? mr.level : m), 0);
        domainStatuses.push({ domain, level, metrics });
    }
    // ---- Overall level + multi_domain flag ---------------------------------
    const overall = domainStatuses.reduce((m, ds) => (ds.level > m ? ds.level : m), 0);
    const elevatedDomains = domainStatuses.filter(ds => ds.level >= 1);
    const multi_domain = elevatedDomains.length >= 2;
    return {
        overall,
        multi_domain,
        domains: domainStatuses,
        metrics: metricResults,
        hrBaseline,
        hrBaselineFallback,
    };
}
//# sourceMappingURL=evaluate.js.map