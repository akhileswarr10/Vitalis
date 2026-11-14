/**
 * engine/anomaly.ts – Rolling z-score anomaly detector per metric.
 *
 * Advisory only: anomaly flags NEVER change any health level.
 * CLAUDE.md rule 1: status is decided solely by evaluate.ts.
 *
 * Algorithm:
 *   - For each metric, use the last `window` values (default 14).
 *   - Require at least `minPoints` values (default 10) or skip.
 *   - Compute mean and population std-dev of the window.
 *   - z = (latestValue - mean) / stdDev.
 *   - Flag if |z| >= threshold (default 2.5).
 */
import { METRIC_KEYS } from './evaluate.js';
// ---- Constants -------------------------------------------------------------
const DEFAULT_WINDOW = 14;
const DEFAULT_MIN_POINTS = 10;
const DEFAULT_Z_THRESHOLD = 2.5;
// ---- Internal helpers ------------------------------------------------------
function stdDev(values, mean) {
    if (values.length < 2)
        return 0;
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}
// ---- Public API ------------------------------------------------------------
/**
 * detectAnomalies – pure function, no I/O, no randomness.
 *
 * @param entries   Check-in entries, unsorted (function sorts internally).
 * @param window    Rolling window size (default 14).
 * @param minPoints Minimum points required (default 10).
 * @param zThreshold Absolute z-score threshold for a flag (default 2.5).
 * @returns         Advisory AnomalyFlag[] (empty if no anomalies).
 */
export function detectAnomalies(entries, window = DEFAULT_WINDOW, minPoints = DEFAULT_MIN_POINTS, zThreshold = DEFAULT_Z_THRESHOLD) {
    if (entries.length < minPoints)
        return [];
    // Sort ascending by day (pure – does not mutate caller's array).
    const sorted = [...entries].sort((a, b) => a.day - b.day);
    // The latest entry is the one being assessed.
    // The window includes the last `window` entries (including the latest).
    const windowEntries = sorted.slice(-window);
    if (windowEntries.length < minPoints)
        return [];
    const flags = [];
    for (const key of METRIC_KEYS) {
        const values = windowEntries.map(e => e[key]);
        const latestValue = values[values.length - 1];
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const sd = stdDev(values, mean);
        // If all values are identical, stdDev is 0 → no anomaly possible.
        if (sd === 0)
            continue;
        const z = (latestValue - mean) / sd;
        if (Math.abs(z) >= zThreshold) {
            const direction = z > 0 ? 'up' : 'down';
            flags.push({
                metric: key,
                value: latestValue,
                z: parseFloat(z.toFixed(3)),
                direction,
                windowMean: parseFloat(mean.toFixed(3)),
                windowStdDev: parseFloat(sd.toFixed(3)),
            });
        }
    }
    return flags;
}
//# sourceMappingURL=anomaly.js.map