import { useEffect, useState } from 'react';
import { XMLParser } from 'fast-xml-parser';
import { getImageUrl } from '../constants/config';

export interface GpxPoint {
    distance: number;
    elevation: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGpxElevation(gpxUrl?: string) {
    const [points, setPoints] = useState<GpxPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // ✅ Use getImageUrl to fix localhost → real IP
        const resolvedUrl = getImageUrl(gpxUrl) ?? undefined;

        console.log('[GPX] Original URL:', gpxUrl);
        console.log('[GPX] Resolved URL:', resolvedUrl);

        if (!resolvedUrl) {
            console.warn('[GPX] No URL — skipping fetch');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        fetch(resolvedUrl)  // ✅ using resolvedUrl not gpxUrl
            .then(res => {
                console.log('[GPX] Fetch status:', res.status, res.ok ? '✅' : '❌');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            })
            .then(xml => {
                if (cancelled) return;

                console.log('[GPX] XML length:', xml.length);
                console.log('[GPX] XML preview:', xml.slice(0, 200));

                const parser = new XMLParser({
                    ignoreAttributes: false,
                    attributeNamePrefix: '@_',
                });
                const result = parser.parse(xml);

                console.log('[GPX] Parsed keys:', Object.keys(result ?? {}));

                const trkpts =
                    result?.gpx?.trk?.trkseg?.trkpt ??
                    result?.gpx?.trk?.[0]?.trkseg?.[0]?.trkpt ??
                    [];

                const ptArray = Array.isArray(trkpts) ? trkpts : [trkpts];

                console.log('[GPX] Track points found:', ptArray.length);

                if (ptArray.length === 0) {
                    console.warn('[GPX] ⚠️ No trkpt found — check GPX structure');
                    setPoints([]);
                    return;
                }

                let cumDist = 0;
                let prevLat: number | null = null;
                let prevLon: number | null = null;

                const parsed: GpxPoint[] = ptArray.map((pt: any) => {
                    const lat = parseFloat(pt['@_lat'] ?? '0');
                    const lon = parseFloat(pt['@_lon'] ?? '0');
                    const ele = parseFloat(pt?.ele ?? '0');

                    if (prevLat !== null && prevLon !== null) {
                        cumDist += haversineKm(prevLat, prevLon, lat, lon);
                    }
                    prevLat = lat;
                    prevLon = lon;

                    return {
                        distance: parseFloat(cumDist.toFixed(3)),
                        elevation: ele,
                    };
                });

                console.log('[GPX] First point:', parsed[0]);
                console.log('[GPX] Last point:', parsed[parsed.length - 1]);
                console.log('[GPX] Total distance:', parsed[parsed.length - 1]?.distance, 'km');

                if (!cancelled) setPoints(parsed);
            })
            .catch(e => {
                console.error('[GPX] ❌ Error:', e.message);
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [gpxUrl]);

    return { points, loading, error };
}