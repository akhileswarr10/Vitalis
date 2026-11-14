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
/**
 * Clear in-memory space weather cache (useful in tests).
 */
export declare function clearSpaceWeatherCache(): void;
/**
 * Check if a flare class indicates a strong event.
 * X-class = major, M-class = moderate to strong.
 */
export declare function isStrongFlare(classType: string): boolean;
/**
 * Check if a CME has high propagation speed (>= 800 km/s).
 */
export declare function isStrongCme(speed?: number): boolean;
interface FetchOptions {
    forceRefresh?: boolean;
    timeoutMs?: number;
}
/**
 * Fetch space weather telemetry from NASA DONKI with in-memory caching and soft failure.
 */
export declare function getSpaceWeather(config: Config, options?: FetchOptions): Promise<SpaceWeatherResult>;
export {};
//# sourceMappingURL=spaceWeather.d.ts.map