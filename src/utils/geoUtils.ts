import * as turf from '@turf/turf';
import { TrackPoint, Station, ChartDataPoint } from '../types';

export function trackPointsToGeoJSON(points: TrackPoint[]) {
	const coordinates = points.map(pt => [pt.lon, pt.lat]);
	return turf.lineString(coordinates);
}

export function calculateDistances(points: TrackPoint[]): number[] {
	const distances: number[] = [0];
	let totalDistance = 0;

	for (let i = 1; i < points.length; i++) {
		const from = turf.point([points[i - 1].lon, points[i - 1].lat]);
		const to = turf.point([points[i].lon, points[i].lat]);
		const distance = turf.distance(from, to, { units: 'kilometers' });
		totalDistance += distance;
		distances.push(totalDistance);
	}

	return distances;
}

export function calculateStationDistances(
	trackPoints: TrackPoint[],
	stations: Station[],
	trackDistances: number[]
): Station[] {
	const line = trackPointsToGeoJSON(trackPoints);

	return stations.map(station => {
		const stationPoint = turf.point([station.lon, station.lat]);
		const snapped = turf.nearestPointOnLine(line, stationPoint);
		
		// PRODUCTION FIX: Safe fallback for distance property (location OR dist)
		let distanceAlongLine = 
			snapped.properties?.location ?? 
			snapped.properties?.dist ?? 
			0;
		
		// If Turf didn't provide distance, find nearest track point
		if (distanceAlongLine === 0 && snapped.properties) {
			let minDist = Infinity;
			let nearestIndex = 0;
			
			for (let i = 0; i < trackPoints.length; i++) {
				const trackPoint = turf.point([trackPoints[i].lon, trackPoints[i].lat]);
				const dist = turf.distance(trackPoint, snapped, { units: 'meters' });
				if (dist < minDist) {
					minDist = dist;
					nearestIndex = i;
				}
			}
			distanceAlongLine = trackDistances[nearestIndex];
		}

		return {
			...station,
			distance: distanceAlongLine,
		};
	});
}

export function buildChartData(
	trackPoints: TrackPoint[],
	distances: number[]
): ChartDataPoint[] {
	return trackPoints.map((pt, idx) => ({
		x: distances[idx],
		y: pt.ele,
	}));
}

export function findPositionAtDistance(
	trackPoints: TrackPoint[],
	distances: number[],
	targetDistance: number
): { lat: number; lon: number; ele: number } {
	for (let i = 0; i < distances.length - 1; i++) {
		if (targetDistance >= distances[i] && targetDistance <= distances[i + 1]) {
			const segmentLength = distances[i + 1] - distances[i];
			const ratio = segmentLength > 0 
				? (targetDistance - distances[i]) / segmentLength 
				: 0;

			const pt1 = trackPoints[i];
			const pt2 = trackPoints[i + 1];

			return {
				lat: pt1.lat + (pt2.lat - pt1.lat) * ratio,
				lon: pt1.lon + (pt2.lon - pt1.lon) * ratio,
				ele: pt1.ele + (pt2.ele - pt1.ele) * ratio,
			};
		}
	}

	const lastPoint = trackPoints[trackPoints.length - 1];
	return {
		lat: lastPoint.lat,
		lon: lastPoint.lon,
		ele: lastPoint.ele,
	};
}

/**
 * PRODUCTION: Snap a point to the nearest position on the route line
 * Safe distance property fallback
 */
export function snapToRoute(
	routeLine: GeoJSON.Feature<GeoJSON.LineString>,
	point: { lat: number; lon: number }
): { lat: number; lon: number; distanceAlongKm: number } {
	const targetPoint = turf.point([point.lon, point.lat]);
	const snapped = turf.nearestPointOnLine(routeLine, targetPoint);
	
	const [lon, lat] = snapped.geometry.coordinates;
	
	// PRODUCTION FIX: Safe distance extraction with fallbacks
	const distanceAlongKm = 
		snapped.properties?.location ?? 
		snapped.properties?.dist ?? 
		0;

	return {
		lat,
		lon,
		distanceAlongKm,
	};
}

/**
 * PRODUCTION: Calculate bearing (direction) between two points in degrees
 * Returns 0-360 where 0 = North, 90 = East, 180 = South, 270 = West
 */
export function calculateBearing(
	from: { lat: number; lon: number },
	to: { lat: number; lon: number }
): number {
	const fromPoint = turf.point([from.lon, from.lat]);
	const toPoint = turf.point([to.lon, to.lat]);
	
	const bearing = turf.bearing(fromPoint, toPoint);
	
	// Convert to 0-360 range
	return bearing < 0 ? bearing + 360 : bearing;
}

/**
 * Get optimal camera settings for a route
 */
export function getRouteCameraBounds(points: TrackPoint[]): {
	bounds: [[number, number], [number, number]];
	center: [number, number];
	zoom: number;
} {
	let minLat = Infinity, maxLat = -Infinity;
	let minLon = Infinity, maxLon = -Infinity;

	points.forEach(pt => {
		minLat = Math.min(minLat, pt.lat);
		maxLat = Math.max(maxLat, pt.lat);
		minLon = Math.min(minLon, pt.lon);
		maxLon = Math.max(maxLon, pt.lon);
	});

	const bounds: [[number, number], [number, number]] = [
		[minLon, minLat],
		[maxLon, maxLat],
	];

	const center: [number, number] = [
		(minLon + maxLon) / 2,
		(minLat + maxLat) / 2,
	];

	// Calculate appropriate zoom
	const latDiff = maxLat - minLat;
	const lonDiff = maxLon - minLon;
	const maxDiff = Math.max(latDiff, lonDiff);
	
	let zoom = 10;
	if (maxDiff < 0.01) zoom = 15;
	else if (maxDiff < 0.05) zoom = 13;
	else if (maxDiff < 0.1) zoom = 12;
	else if (maxDiff < 0.5) zoom = 10;
	else zoom = 9;

	return { bounds, center, zoom };
}

export function getBounds(points: TrackPoint[]): [[number, number], [number, number]] {
	return getRouteCameraBounds(points).bounds;
}

/**
 * Linear interpolation for smooth animation
 */
export function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

/**
 * Interpolate between two positions
 */
export function lerpPosition(
	start: { lat: number; lon: number; ele: number },
	end: { lat: number; lon: number; ele: number },
	t: number
): { lat: number; lon: number; ele: number } {
	return {
		lat: lerp(start.lat, end.lat, t),
		lon: lerp(start.lon, end.lon, t),
		ele: lerp(start.ele, end.ele, t),
	};
}