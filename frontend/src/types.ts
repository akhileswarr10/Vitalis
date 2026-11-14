/**
 * types.ts – Shared frontend types that mirror the backend API responses.
 * These are the ONLY types used to talk to the backend.
 * CLAUDE.md: "response types shared from one types.ts"
 */

// ---- Health ----------------------------------------------------------------
export interface HealthResponse {
  status: string;
  database_ok: boolean;
  llm_available: boolean;
}

// ---- CheckIn ---------------------------------------------------------------
export interface CheckInCreate {
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

export interface CheckIn extends CheckInCreate {
  id: number;
  astronaut_id: string;
  created_at: string;
}

// ---- Status / Engine -------------------------------------------------------
export type Level = 0 | 1 | 2;
export type Domain = 'cardio' | 'msk' | 'immune' | 'behav' | 'env';

export interface MetricResult {
  key: string;
  value: number;
  level: Level;
  effectiveWatch: number;
  effectiveAction: number;
  drift?: {
    metric: string;
    last3Mean: number;
    prev14Mean: number;
    tolerance: number;
    direction: 'up' | 'down';
  };
}

export interface DomainStatus {
  domain: Domain;
  level: Level;
  metrics: MetricResult[];
  actions: string[];
}

export interface AnomalyFlag {
  metric: string;
  value: number;
  z: number;
  direction: 'up' | 'down';
  windowMean: number;
  windowStdDev: number;
}

export interface StatusResponse {
  astronaut_id: string;
  overall: Level;
  multi_domain: boolean;
  hrBaseline: number | null;
  hrBaselineFallback: boolean;
  domains: DomainStatus[];
  metrics: MetricResult[];
  anomalies: AnomalyFlag[];
  entry_count: number;
}

// ---- Trends ----------------------------------------------------------------
export interface TrendPoint {
  day: number;
  value: number;
}

export interface TrendsResponse {
  astronaut_id: string;
  metric: string;
  label: string;
  unit: string;
  domain: Domain;
  direction: 'higher_is_worse' | 'lower_is_worse';
  effectiveWatch: number;
  effectiveAction: number;
  hrBaseline: number | null;
  why: string;
  source: string;
  series: TrendPoint[];
}

// ---- Assistant -------------------------------------------------------------
export interface AssistantAnswer {
  summary: string;
  explanation: string;
  steps: string[];
  escalate: boolean;
  sources: string[];
  fallback_used: boolean;
}

// ---- Seed ------------------------------------------------------------------
export interface SeedResponse {
  status: string;
  astronaut_id: string;
  days_seeded: number;
}

// ---- Space Weather (NASA DONKI) -------------------------------------------
export interface SpaceWeatherFlare {
  flrID: string;
  beginTime: string;
  peakTime?: string;
  endTime?: string;
  classType: string;
  sourceLocation?: string;
  link?: string;
}

export interface SpaceWeatherCme {
  activityID: string;
  startTime: string;
  sourceLocation?: string;
  speed?: number;
  type?: string;
  link?: string;
}

export interface SpaceWeatherResponse {
  available: boolean;
  cached?: boolean;
  last_updated?: string;
  has_strong_event?: boolean;
  advisory?: string | null;
  flares?: SpaceWeatherFlare[];
  cmes?: SpaceWeatherCme[];
  error?: string;
}

// ---- Domain metadata -------------------------------------------------------
export const DOMAIN_LABELS: Record<Domain, string> = {
  cardio: 'Cardiovascular',
  msk: 'Musculoskeletal',
  immune: 'Immune',
  behav: 'Behavioral',
  env: 'Environmental',
};

export const LEVEL_LABELS: Record<Level, string> = {
  0: 'Nominal',
  1: 'Watch',
  2: 'Action',
};

export const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  hr:     { label: 'Heart rate', unit: 'bpm' },
  sbp:    { label: 'Sys. BP', unit: 'mmHg' },
  ortho:  { label: 'Ortho HR rise', unit: 'bpm' },
  ex:     { label: 'Exercise', unit: 'min/d' },
  bone:   { label: 'Bone index', unit: '/10' },
  temp:   { label: 'Temperature', unit: '°C' },
  sym:    { label: 'Symptom score', unit: '/6' },
  sleep:  { label: 'Sleep', unit: 'h' },
  mood:   { label: 'Mood', unit: '/10' },
  stress: { label: 'Stress', unit: '/10' },
  dose:   { label: 'Radiation dose', unit: 'mGy/d' },
  co2:    { label: 'Cabin CO₂', unit: 'ppm' },
};

