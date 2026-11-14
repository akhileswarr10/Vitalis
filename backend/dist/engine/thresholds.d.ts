export type Domain = 'cardio' | 'msk' | 'immune' | 'behav' | 'env';
export type Direction = 'higher_is_worse' | 'lower_is_worse';
export interface Threshold {
    key: string;
    label: string;
    unit: string;
    domain: Domain;
    direction: Direction;
    /** If true, watch/action are offsets from the personal HR baseline (bpm above baseline). */
    baseline_relative?: boolean;
    watch: number;
    action: number;
    drift_tolerance: number;
    why: string;
    source: string;
}
export declare const thresholds: Threshold[];
export declare const thresholdsByKey: Map<string, Threshold>;
export declare const METRIC_KEYS: [string, ...string[]];
//# sourceMappingURL=thresholds.d.ts.map