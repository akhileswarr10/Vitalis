let inMemoryCache = null;
/**
 * Clear in-memory space weather cache (useful in tests).
 */
export function clearSpaceWeatherCache() {
    inMemoryCache = null;
}
/**
 * Check if a flare class indicates a strong event.
 * X-class = major, M-class = moderate to strong.
 */
export function isStrongFlare(classType) {
    if (!classType)
        return false;
    const upper = classType.trim().toUpperCase();
    return upper.startsWith('X') || upper.startsWith('M');
}
/**
 * Check if a CME has high propagation speed (>= 800 km/s).
 */
export function isStrongCme(speed) {
    return typeof speed === 'number' && speed >= 800;
}
/**
 * Format YYYY-MM-DD for date range queries.
 */
function getDateRange(daysBack = 7) {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return {
        startDate: format(past),
        endDate: format(now),
    };
}
/**
 * Fetch space weather telemetry from NASA DONKI with in-memory caching and soft failure.
 */
export async function getSpaceWeather(config, options = {}) {
    const now = Date.now();
    const cacheTtlMs = config.SPACE_WEATHER_CACHE_MINUTES * 60 * 1000;
    // 1. Check in-memory cache
    if (!options.forceRefresh &&
        inMemoryCache &&
        now - inMemoryCache.timestamp < cacheTtlMs &&
        inMemoryCache.data.available) {
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
        const flrData = (await flrRes.json());
        const cmeData = (await cmeRes.json());
        if (!Array.isArray(flrData) || !Array.isArray(cmeData)) {
            return {
                available: false,
                error: 'Invalid response format from NASA DONKI',
            };
        }
        // Parse flares
        const flares = [];
        for (const item of flrData) {
            if (item && typeof item === 'object') {
                const raw = item;
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
        const cmes = [];
        for (const item of cmeData) {
            if (item && typeof item === 'object') {
                const raw = item;
                if (typeof raw.activityID === 'string') {
                    let speed;
                    let type;
                    if (Array.isArray(raw.cmeAnalyses) && raw.cmeAnalyses.length > 0) {
                        const firstAnalysis = raw.cmeAnalyses[0];
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
        let advisory = null;
        if (hasStrongEvent) {
            const details = [];
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
        const result = {
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
    }
    catch (err) {
        // Graceful degradation: return available: false on any network or parsing failure
        return {
            available: false,
            error: err instanceof Error ? err.message : 'Space weather fetch failed',
        };
    }
}
//# sourceMappingURL=spaceWeather.js.map