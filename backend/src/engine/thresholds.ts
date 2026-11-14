/**
 * thresholds.ts – Load thresholds.yaml once at module init and export typed lookups.
 * No I/O at call time; the YAML is read once synchronously when this module is first imported.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dir = dirname(fileURLToPath(import.meta.url));

// ---- Types -----------------------------------------------------------------

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

// ---- Load YAML -------------------------------------------------------------

interface YamlFile {
  metrics: Threshold[];
}

const yamlPath = join(__dir, 'thresholds.yaml');
const raw = readFileSync(yamlPath, 'utf8');
const parsed = parse(raw) as YamlFile;

export const thresholds: Threshold[] = parsed.metrics;
export const thresholdsByKey: Map<string, Threshold> = new Map(
  thresholds.map(t => [t.key, t]),
);

export const METRIC_KEYS = thresholds.map(t => t.key) as [string, ...string[]];

