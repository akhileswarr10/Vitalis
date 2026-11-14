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
let raw = '';
try {
  raw = readFileSync(yamlPath, 'utf8');
} catch {
  // Bundled fallback for serverless cloud environments where YAML is not extracted to disk
  raw = `
metrics:
  - key: hr
    label: Resting Heart Rate
    unit: bpm
    domain: cardio
    direction: higher_is_worse
    baseline_relative: true
    watch: 15
    action: 25
    drift_tolerance: 8
    why: Elevated resting HR in microgravity may indicate fluid-shift deconditioning.
    source: "https://www.nasa.gov/hrp/research/cardiovascular-health"
  - key: sbp
    label: Systolic Blood Pressure
    unit: mmHg
    domain: cardio
    direction: higher_is_worse
    watch: 140
    action: 160
    drift_tolerance: 8
    why: Spaceflight can cause cephalad fluid shift and altered baroreceptor sensitivity.
    source: "illustrative, to be validated by flight surgeon"
  - key: ortho
    label: Orthostatic Heart-Rate Rise
    unit: bpm
    domain: cardio
    direction: higher_is_worse
    watch: 20
    action: 30
    drift_tolerance: 5
    why: A rise of >=20 bpm from supine to standing indicates orthostatic intolerance.
    source: "https://pubmed.ncbi.nlm.nih.gov/19289835/"
  - key: ex
    label: Exercise Time
    unit: minutes/day
    domain: msk
    direction: lower_is_worse
    watch: 45
    action: 20
    drift_tolerance: 10
    why: NASA HRP requires >=2 h of daily countermeasure exercise on ISS.
    source: "https://www.nasa.gov/hrp/research/muscle-and-bone"
  - key: bone
    label: Bone Mineral Density Index
    unit: index (0–10)
    domain: msk
    direction: lower_is_worse
    watch: 7
    action: 5
    drift_tolerance: 0.5
    why: Bone loss of ~1-2% per month is typical in microgravity.
    source: "illustrative, to be validated by flight surgeon"
  - key: temp
    label: Core Body Temperature
    unit: °C
    domain: immune
    direction: higher_is_worse
    watch: 37.5
    action: 38.3
    drift_tolerance: 0.3
    why: Low-grade fever in microgravity may signal immune dysregulation.
    source: "https://www.cdc.gov/coronavirus/2019-ncov/hcp/clinical-guidance-management-patients.html"
  - key: sym
    label: Symptom Score
    unit: count (0–6)
    domain: immune
    direction: higher_is_worse
    watch: 2
    action: 4
    drift_tolerance: 1
    why: A composite count of reported symptoms.
    source: "illustrative, to be validated by flight surgeon"
  - key: sleep
    label: Sleep Duration
    unit: hours/night
    domain: behav
    direction: lower_is_worse
    watch: 6.5
    action: 5.5
    drift_tolerance: 0.5
    why: Sleep disruption is one of the most common behavioral health risks in spaceflight.
    source: "https://www.nasa.gov/hrp/research/behavioral-health"
  - key: mood
    label: Mood Score
    unit: score (1–10)
    domain: behav
    direction: lower_is_worse
    watch: 5
    action: 3
    drift_tolerance: 1
    why: Self-reported mood below 5 warrants behavioral health check-in.
    source: "illustrative, to be validated by flight surgeon"
  - key: stress
    label: Perceived Stress Score
    unit: score (0–10)
    domain: behav
    direction: higher_is_worse
    watch: 6
    action: 8
    drift_tolerance: 1.5
    why: Chronic mission stress elevates cortisol and suppresses immune function.
    source: "illustrative, to be validated by flight surgeon"
  - key: dose
    label: Radiation Dose
    unit: mGy/day
    domain: env
    direction: higher_is_worse
    watch: 1.0
    action: 5.0
    drift_tolerance: 0.3
    why: Single-day dose of >=1 mGy may indicate a solar particle event (SPE).
    source: "https://www.nasa.gov/hrp/research/space-radiation"
  - key: co2
    label: Cabin CO₂ Partial Pressure
    unit: ppm
    domain: env
    direction: higher_is_worse
    watch: 1000
    action: 5000
    drift_tolerance: 100
    why: Levels above 1000 ppm cause headaches and cognitive performance degradation.
    source: "https://ntrs.nasa.gov/citations/20170001935"
`;
}
const parsed = parse(raw) as YamlFile;

export const thresholds: Threshold[] = parsed.metrics;
export const thresholdsByKey: Map<string, Threshold> = new Map(
  thresholds.map(t => [t.key, t]),
);

export const METRIC_KEYS = thresholds.map(t => t.key) as [string, ...string[]];

