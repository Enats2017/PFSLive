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

		// Extract track points.
		// fast-xml-parser collapses a single <trkseg> to an object but expands
		// multiple <trkseg> (or multiple <trk>) to an array, so we normalise both
		// to arrays and walk every track → every segment → every point. Also skips
		// the duplicate point each segment repeats at the seam (last of prev seg
		// == first of next seg). Falls back to <rte>/<rtept> for route-based GPX.
		const trackPoints: TrackPoint[] = [];

		const toArray = <T>(v: T | T[] | undefined | null): T[] =>
			v == null ? [] : Array.isArray(v) ? v : [v];

		const pushPt = (pt: any) => {
			if (pt && pt['@_lat'] != null && pt['@_lon'] != null) {
				const lat = parseFloat(pt['@_lat']);
				const lon = parseFloat(pt['@_lon']);
				const last = trackPoints[trackPoints.length - 1];
				if (last && last.lat === lat && last.lon === lon) return; // seam dupe
				trackPoints.push({ lat, lon, ele: pt.ele != null ? parseFloat(pt.ele) : 0 });
			}
		};

		for (const trk of toArray(gpx.trk)) {
			for (const seg of toArray(trk?.trkseg)) {
				for (const pt of toArray(seg?.trkpt)) pushPt(pt);
			}
		}

		// Fallback: route-based GPX (<rte><rtept>), mirroring the PHP backend.
		if (trackPoints.length === 0) {
			for (const rte of toArray(gpx.rte)) {
				for (const pt of toArray(rte?.rtept)) pushPt(pt);
			}
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