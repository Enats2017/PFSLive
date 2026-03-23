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
    async fetchAndParseGPX(gpxUrl: string): Promise<GPXRouteData> {
        try {
            console.log('📂 Fetching GPX from:', gpxUrl);

            const response = await fetch(gpxUrl);
            
            if (!response.ok) {
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

            console.log('✅ GPX parsed successfully:', {
                totalDistance: `${totalDistance.toFixed(2)}km`,
                trackPoints: parsed.trackPoints.length,
                aidStations: aidStationsWithDistances.length,
                elevationRange: `${minElevation}m - ${maxElevation}m`,
            });

            return {
                name: parsed.name,
                trackPoints: parsed.trackPoints,
                aidStations: aidStationsWithDistances as GPXAidStation[],
                totalDistance,
                minElevation,
                maxElevation,
            };
        } catch (error) {
            console.error('❌ GPX fetch/parse error:', error);
            throw error;
        }
    }
}

export const gpxService = new GPXService();