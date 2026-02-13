import { XMLParser } from 'fast-xml-parser';
import { TrackPoint, Station, RouteData } from '../types';

export async function parseGPX(gpxContent: string): Promise<RouteData> {
	try {
		const parser = new XMLParser({
			ignoreAttributes: false,
			attributeNamePrefix: '@_',
		});

		const result = parser.parse(gpxContent);
		const gpx = result.gpx;

		// Extract metadata
		const name = gpx.metadata?.name || gpx.trk?.name || 'Unknown Route';

		// Extract track points
		const trackPoints: TrackPoint[] = [];
		const trkseg = gpx.trk?.trkseg;

		if (trkseg) {
			const trkpts = Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt];
			
			trkpts.forEach((pt: any) => {
				if (pt && pt['@_lat'] && pt['@_lon']) {
					trackPoints.push({
						lat: parseFloat(pt['@_lat']),
						lon: parseFloat(pt['@_lon']),
						ele: pt.ele ? parseFloat(pt.ele) : 0,
					});
				}
			});
		}

		// Extract waypoints (stations)
		const stations: Station[] = [];
		if (gpx.wpt) {
			const wpts = Array.isArray(gpx.wpt) ? gpx.wpt : [gpx.wpt];
			
			wpts.forEach((wpt: any) => {
				if (wpt && wpt['@_lat'] && wpt['@_lon']) {
					stations.push({
						lat: parseFloat(wpt['@_lat']),
						lon: parseFloat(wpt['@_lon']),
						ele: wpt.ele ? parseFloat(wpt.ele) : 0,
						name: wpt.name || 'Station',
					});
				}
			});
		}

		// If no stations, create them from track points (every ~10km)
		if (stations.length === 0 && trackPoints.length > 0) {
			const pointsPerStation = Math.floor(trackPoints.length / 5);
			for (let i = 0; i < trackPoints.length; i += pointsPerStation) {
				const pt = trackPoints[i];
				stations.push({
					lat: pt.lat,
					lon: pt.lon,
					ele: pt.ele,
					name: `Station ${Math.floor(i / pointsPerStation) + 1}`,
				});
			}
		}

		return {
			name,
			trackPoints,
			stations,
			totalDistance: 0, // Will be calculated later
		};
	} catch (error) {
		console.error('Error parsing GPX:', error);
		throw new Error('Failed to parse GPX file');
	}
}