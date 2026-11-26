import { useEffect, useState } from 'react';
import { getImageUrl } from '../constants/config';
import { gpxService } from '../services/gpxService';

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

// ✅ Through gpxService (app audit 2026-11-26) instead of its own fetch + parser:
//   - the route is downloaded once per URL per app session (in-memory cache
//     with ETag revalidation) — every Result Details opened downloaded the
//     whole file again;
//   - the request has a deadline (Android fetch has none of its own);
//   - utils/gpx reads EVERY <trk>/<trkseg> (and <rte> files): the old
//     `trk.trkseg.trkpt ?? trk[0].trkseg[0].trkpt` found no points when one
//     <trk> held several <trkseg>, so those routes had no elevation chart.
export function useGpxElevation(gpxUrl?: string) {
    const [points, setPoints] = useState<GpxPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // ✅ Use getImageUrl to fix localhost → real IP
        const resolvedUrl = getImageUrl(gpxUrl) ?? undefined;

        if (!resolvedUrl) {
            console.warn('[GPX] No URL — skipping fetch');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        gpxService.fetchAndParseGPX(resolvedUrl)
            .then((route) => {
                if (cancelled) return;
                const pts = route.trackPoints;
                if (pts.length === 0) {
                    console.warn('[GPX] ⚠️ No trkpt found — check GPX structure');
                    setPoints([]);
                    return;
                }
                let cumDist = 0;
                const parsed: GpxPoint[] = pts.map((pt, i) => {
                    if (i > 0) cumDist += haversineKm(pts[i - 1].lat, pts[i - 1].lon, pt.lat, pt.lon);
                    return {
                        distance: parseFloat(cumDist.toFixed(3)),
                        elevation: Number.isFinite(pt.ele) ? pt.ele : 0,
                    };
                });
                setPoints(parsed);
            })
            .catch(e => {
                console.error('[GPX] ❌ Error:', e?.message);
                if (!cancelled) setError(e?.message ?? 'gpx_failed');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [gpxUrl]);

    return { points, loading, error };
}
