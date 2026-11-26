import { parseGPX } from '../utils/gpx'; // ✅ Changed from gpxParser
import { calculateDistances, calculateStationDistances } from '../utils/geoUtils';
import { fetchWithTimeout, FetchTimeoutError } from '../utils/fetchWithTimeout';

// ✅ A route file is fetched once per screen open and can be a few MB on an
// ultra, so it gets more time than an API call — but never unlimited (app
// audit 2026-11-26: Android fetch has no timeout of its own). 90 s for the
// whole download, headers AND body (re-audit: 30 s made a big GPX on slow 3G
// fail every Retry). API calls keep their own 20 s.
export const GPX_FETCH_TIMEOUT_MS = 90000;

/** `p`, or a FetchTimeoutError once `deadline` (epoch ms) has passed. */
function beforeDeadline<T>(p: Promise<T>, deadline: number): Promise<T> {
    const ms = Math.max(0, deadline - Date.now());
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new FetchTimeoutError(ms)), ms);
        p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
}

/**
 * Min / max in one pass. `Math.min(...arr)` passes every point as an argument
 * and throws RangeError ("Maximum call stack size exceeded") once a GPX has
 * ~100k+ points (a 1 s Garmin recording of an ultra), which put the whole map
 * on the error screen (app audit 2026-11-26).
 */
export function minMax(values: number[]): { min: number; max: number } {
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return { min, max };
}

export interface GPXAidStation {
    name: string;
    lat: number;
    lon: number;
    ele: number;
    distance?: number;
    accessible_by_car: boolean;
}

export interface GPXTrackPoint {
    lat: number;
    lon: number;
    ele: number;
}

export interface GPXRouteData {
    name: string;
    trackPoints: GPXTrackPoint[];
    aidStations: GPXAidStation[];
    totalDistance: number;
    minElevation: number;
    maxElevation: number;
    /** Total ascent (D+) in metres — the sum of the positive elevation deltas. */
    elevationGain: number;
}

class GPXService {
    private cache = new Map<string, { etag?: string; lastModified?: string; data: GPXRouteData }>();

    async fetchAndParseGPX(gpxUrl: string): Promise<GPXRouteData> {
        try {
            console.log('📂 Fetching GPX from:', gpxUrl);

            const cached = this.cache.get(gpxUrl);

            // ✅ Build conditional request headers
            const headers: Record<string, string> = {
                'Cache-Control': 'no-cache',  // always revalidate, but use cache if unchanged
            };
            if (cached?.etag) {
                headers['If-None-Match'] = cached.etag;
            } else if (cached?.lastModified) {
                headers['If-Modified-Since'] = cached.lastModified;
            }

            const deadline = Date.now() + GPX_FETCH_TIMEOUT_MS;
            const response = await fetchWithTimeout(gpxUrl, { headers }, GPX_FETCH_TIMEOUT_MS);

            // ✅ 304 = file unchanged → return cached data
            if (response.status === 304 && cached) {
                console.log('✅ GPX unchanged, using cached data');
                return cached.data;
            }

            if (!response.ok) {
                // ✅ If fetch fails but we have cached data, use it as fallback
                if (cached) {
                    console.log('⚠️ GPX fetch failed, using cached data as fallback');
                    return cached.data;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const gpxContent = await beforeDeadline(response.text(), deadline);
            const parsed = await parseGPX(gpxContent);

            const distances = calculateDistances(parsed.trackPoints);
            const totalDistance = distances[distances.length - 1];

            const aidStationsWithDistances = calculateStationDistances(
                parsed.trackPoints,
                parsed.stations,
                distances
            );

            const elevations = parsed.trackPoints.map(pt => pt.ele);
            const { min: minElevation, max: maxElevation } = minMax(elevations);

            let elevationGain = 0;
            for (let i = 1; i < elevations.length; i++) {
                const d = elevations[i] - elevations[i - 1];
                if (d > 1) elevationGain += d;
            }

            const routeData: GPXRouteData = {
                name: parsed.name,
                trackPoints: parsed.trackPoints,
                aidStations: aidStationsWithDistances as GPXAidStation[],
                totalDistance,
                minElevation,
                maxElevation,
                elevationGain: Math.round(elevationGain),
            };

            // ✅ Store in memory cache with ETag/LastModified for next request
            this.cache.set(gpxUrl, {
                etag: response.headers.get('etag') ?? undefined,
                lastModified: response.headers.get('last-modified') ?? undefined,
                data: routeData,
            });

            console.log('✅ GPX parsed successfully:', {
                totalDistance: `${totalDistance.toFixed(2)}km`,
                trackPoints: parsed.trackPoints.length,
                aidStations: aidStationsWithDistances.length,
                elevationRange: `${minElevation}m - ${maxElevation}m`,
            });

            return routeData;

        } catch (error) {
            console.error('❌ GPX fetch/parse error:', error);
            // ✅ Any failure (offline, timeout, a broken download) with a copy
            // of this route already parsed this session: show that copy — the
            // route does not change during a race (re-audit 2026-11-26).
            const fallback = this.cache.get(gpxUrl);
            if (fallback) {
                console.log('⚠️ GPX download failed, using the cached copy');
                return fallback.data;
            }
            throw error;
        }
    }
}

export const gpxService = new GPXService();