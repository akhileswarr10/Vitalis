/**
 * evaluate.ts – Pure, deterministic health assessment engine.
 * No I/O, no randomness, no side effects. Same input → same output always.
 *
 * CLAUDE.md rule 1: Status is decided ONLY by this module. The LLM may explain but never override.
 */
import { type Domain } from './thresholds.js';
export type Level = 0 | 1 | 2;
export type MetricKey = 'hr' | 'sbp' | 'ortho' | 'ex' | 'bone' | 'temp' | 'sym' | 'sleep' | 'mood' | 'stress' | 'dose' | 'co2';
export declare const METRIC_KEYS: MetricKey[];
export interface CheckInEntry {
    day: number;
    hr: number;
    sbp: number;
    ortho: number;
    ex: number;
    bone: number;
    temp: number;
    sym: number;
    sleep: number;
    mood: number;
    stress: number;
    dose: number;
    co2: number;
}
export interface MetricResult {
    key: MetricKey;
    value: number;
    level: Level;
    /** Effective absolute thresholds (baseline already applied for HR). */
    effectiveWatch: number;
    effectiveAction: number;
    /** Set only when drift detection fires (level 0, ≥8 entries, bad direction, >tolerance). */
    drift?: DriftFlag;
}
export interface DriftFlag {
    metric: MetricKey;
    last3Mean: number;
    prev14Mean: number;
    tolerance: number;
    direction: 'up' | 'down';
}
export interface DomainStatus {
    domain: Domain;
    level: Level;
    metrics: MetricResult[];
}
export interface AssessResult {
    overall: Level;
    multi_domain: boolean;
    domains: DomainStatus[];
    metrics: MetricResult[];
    /** HR baseline used (mean of first 7 or latest fallback). */
    hrBaseline: number | null;
    /** True if fewer than 3 entries were available (baseline fell back to latest HR). */
    hrBaselineFallback: boolean;
}
/**
 * Compute the HR personal baseline.
 * - Requires entries sorted ascending by day (they are in assess()).
 * - Uses mean of first 7 entries when ≥3 entries exist.
 * - Falls back to the latest (last) HR value when < 3 entries.
 * - Returns null only when entries array is empty.
 */
export declare function computeHrBaseline(sortedEntries: CheckInEntry[]): {
    baseline: number | null;
    fallback: boolean;
};
export declare function assess(entries: CheckInEntry[]): AssessResult;
//# sourceMappingURL=evaluate.d.ts.map