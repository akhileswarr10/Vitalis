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
import { type CheckInEntry, type MetricKey } from './evaluate.js';
export interface AnomalyFlag {
    metric: MetricKey;
    value: number;
    z: number;
    /** 'up' when z > 0 (high spike), 'down' when z < 0 (low dip). */
    direction: 'up' | 'down';
    windowMean: number;
    windowStdDev: number;
}
/**
 * detectAnomalies – pure function, no I/O, no randomness.
 *
 * @param entries   Check-in entries, unsorted (function sorts internally).
 * @param window    Rolling window size (default 14).
 * @param minPoints Minimum points required (default 10).
 * @param zThreshold Absolute z-score threshold for a flag (default 2.5).
 * @returns         Advisory AnomalyFlag[] (empty if no anomalies).
 */
export declare function detectAnomalies(entries: CheckInEntry[], window?: number, minPoints?: number, zThreshold?: number): AnomalyFlag[];
//# sourceMappingURL=anomaly.d.ts.map