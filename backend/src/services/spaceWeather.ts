/**
 * services/spaceWeather.ts – NASA DONKI Space Weather Service.
 *
 * Implements Prompt 10 requirements:
 * - Query NASA DONKI for Solar Flares (FLR) and Coronal Mass Ejections (CME).
 * - Cache in memory for SPACE_WEATHER_CACHE_MINUTES (never write to health tables).
 * - On any failure (network error, rate-limit 429, timeout, invalid JSON), return { available: false }.
 * - Identify strong recent events (X/M-class flares, fast CMEs) and produce an advisory linking to
 *   the radiation shelter guide (radiation-spe-shelter.md).
 * - Must NOT alter engine levels.
 */
import type { Config } from '../config.js';

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

export interface SpaceWeatherResult {
  available: boolean;
  cached?: boolean;
  last_updated?: string;
  has_strong_event?: boolean;
  advisory?: string | null;
  flares?: SpaceWeatherFlare[];
  cmes?: SpaceWeatherCme[];
  error?: string;
}

interface CacheEntry {
  data: SpaceWeatherResult;
  timestamp: number;
}

let inMemoryCache: CacheEntry | null = null;

/**
 * Clear in-memory space weather cache (useful in tests).
 */
export function clearSpaceWeatherCache(): void {
  inMemoryCache = null;
}

/**
 * Check if a flare class indicates a strong event.
 * X-class = major, M-class = moderate to strong.
 */
export function isStrongFlare(classType: string): boolean {
  if (!classType) return false;
  const upper = classType.trim().toUpperCase();
  return upper.startsWith('X') || upper.startsWith('M');
}

/**
 * Check if a CME has high propagation speed (>= 800 km/s).
 */
export function isStrongCme(speed?: number): boolean {
  return typeof speed === 'number' && speed >= 800;
}

/**
 * Format YYYY-MM-DD for date range queries.
 */
function getDateRange(daysBack = 7): { startDate: string; endDate: string } {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return {
    startDate: format(past),
    endDate: format(now),
  };
}

interface FetchOptions {
  forceRefresh?: boolean;
  timeoutMs?: number;
}

/**
 * Fetch space weather telemetry from NASA DONKI with in-memory caching and soft failure.
 */
export async function getSpaceWeather(
  config: Config,
  options: FetchOptions = {},
): Promise<SpaceWeatherResult> {
  const now = Date.now();
  const cacheTtlMs = config.SPACE_WEATHER_CACHE_MINUTES * 60 * 1000;

  // 1. Check in-memory cache
  if (
    !options.forceRefresh &&
    inMemoryCache &&
    now - inMemoryCache.timestamp < cacheTtlMs &&
    inMemoryCache.data.available
  ) {
    return {
      ...inMemoryCache.data,
      cached: true,
    };
  }

  // 2. Prepare query parameters
  const { startDate, endDate } = getDateRange(7);
  const apiKey = config.NASA_API_KEY || 'DEMO_KEY';
  const timeoutMs = options.timeoutMs ?? 5000;

  const flrUrl = `https://api.nasa.gov/DONKI/FLR?startDate=${startDate}&endDate=${endDate}&api_key=${encodeURIComponent(apiKey)}`;
  const cmeUrl = `https://api.nasa.gov/DONKI/CME?startDate=${startDate}&endDate=${endDate}&api_key=${encodeURIComponent(apiKey)}`;

  try {
    const flrSignal = AbortSignal.timeout(timeoutMs);
    const cmeSignal = AbortSignal.timeout(timeoutMs);

    const [flrRes, cmeRes] = await Promise.all([
      fetch(flrUrl, {
        signal: flrSignal,
        headers: { Accept: 'application/json' },
      }),
      fetch(cmeUrl, {
        signal: cmeSignal,
        headers: { Accept: 'application/json' },
      }),
    ]);

    if (!flrRes.ok || !cmeRes.ok) {
      const status = !flrRes.ok ? flrRes.status : cmeRes.status;
      return {
        available: false,
        error: `NASA DONKI responded with HTTP ${status}`,
      };
    }

    const flrData = (await flrRes.json()) as unknown;
    const cmeData = (await cmeRes.json()) as unknown;

    if (!Array.isArray(flrData) || !Array.isArray(cmeData)) {
      return {
        available: false,
        error: 'Invalid response format from NASA DONKI',
      };
    }

    // Parse flares
    const flares: SpaceWeatherFlare[] = [];
    for (const item of flrData) {
      if (item && typeof item === 'object') {
        const raw = item as Record<string, unknown>;
        if (typeof raw.flrID === 'string' && typeof raw.classType === 'string') {
          flares.push({
            flrID: raw.flrID,
            beginTime: typeof raw.beginTime === 'string' ? raw.beginTime : '',
            peakTime: typeof raw.peakTime === 'string' ? raw.peakTime : undefined,
            endTime: typeof raw.endTime === 'string' ? raw.endTime : undefined,
            classType: raw.classType,
            sourceLocation: typeof raw.sourceLocation === 'string' ? raw.sourceLocation : undefined,
            link: typeof raw.link === 'string' ? raw.link : undefined,
          });
        }
      }
    }

    // Parse CMEs
    const cmes: SpaceWeatherCme[] = [];
    for (const item of cmeData) {
      if (item && typeof item === 'object') {
        const raw = item as Record<string, unknown>;
        if (typeof raw.activityID === 'string') {
          let speed: number | undefined;
          let type: string | undefined;

          if (Array.isArray(raw.cmeAnalyses) && raw.cmeAnalyses.length > 0) {
            const firstAnalysis = raw.cmeAnalyses[0] as Record<string, unknown>;
            if (typeof firstAnalysis.speed === 'number') {
              speed = firstAnalysis.speed;
            }
            if (typeof firstAnalysis.type === 'string') {
              type = firstAnalysis.type;
            }
          }

          cmes.push({
            activityID: raw.activityID,
            startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
            sourceLocation: typeof raw.sourceLocation === 'string' ? raw.sourceLocation : undefined,
            speed,
            type,
            link: typeof raw.link === 'string' ? raw.link : undefined,
          });
        }
      }
    }

    // Assess strong events
    const hasStrongFlareEvent = flares.some(f => isStrongFlare(f.classType));
    const hasStrongCmeEvent = cmes.some(c => isStrongCme(c.speed));
    const hasStrongEvent = hasStrongFlareEvent || hasStrongCmeEvent;

    let advisory: string | null = null;
    if (hasStrongEvent) {
      const details: string[] = [];
      const topFlare = flares.find(f => isStrongFlare(f.classType));
      if (topFlare) {
        details.push(`${topFlare.classType} solar flare (${topFlare.flrID})`);
      }
      const topCme = cmes.find(c => isStrongCme(c.speed));
      if (topCme) {
        details.push(`CME speed ${topCme.speed} km/s (${topCme.activityID})`);
      }

      advisory = `High-energy solar activity detected: ${details.join(', ')}. Review onboard guide: radiation-spe-shelter.md. Space weather advisory only — does not alter health telemetry levels.`;
    }

    const result: SpaceWeatherResult = {
      available: true,
      cached: false,
      last_updated: new Date().toISOString(),
      has_strong_event: hasStrongEvent,
      advisory,
      flares: flares.slice(0, 10),
      cmes: cmes.slice(0, 10),
    };

    // Store in memory cache
    inMemoryCache = {
      data: result,
      timestamp: Date.now(),
    };

    return result;
  } catch (err) {
    // Graceful degradation: return available: false on any network or parsing failure
    return {
      available: false,
      error: err instanceof Error ? err.message : 'Space weather fetch failed',
    };
  }
}

