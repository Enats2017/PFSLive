import { parseGPX } from '../utils/gpx'; // ✅ Changed from gpxParser
import { calculateDistances, calculateStationDistances } from '../utils/geoUtils';

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

            const response = await fetch(gpxUrl, { headers });

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

            const gpxContent = await response.text();
            const parsed = await parseGPX(gpxContent);

            const distances = calculateDistances(parsed.trackPoints);
            const totalDistance = distances[distances.length - 1];

            const aidStationsWithDistances = calculateStationDistances(
                parsed.trackPoints,
                parsed.stations,
                distances
            );

            const elevations = parsed.trackPoints.map(pt => pt.ele);
            const minElevation = Math.min(...elevations);
            const maxElevation = Math.max(...elevations);

            const routeData: GPXRouteData = {
                name: parsed.name,
                trackPoints: parsed.trackPoints,
                aidStations: aidStationsWithDistances as GPXAidStation[],
                totalDistance,
                minElevation,
                maxElevation,
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
            throw error;
        }
    }
}

export const gpxService = new GPXService();