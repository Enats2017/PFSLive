import React, { useRef, useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { GPXTrackPoint, GPXAidStation } from '../../services/gpxService';
import { getCheckpointName } from '../../utils/checkpointName';
import { ParticipantMapMarker, AidStationMapMarker, CheckpointData } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';
import { useTranslation } from 'react-i18next';

// ── Map marker colors ────────────────────────────────────────────────────────
// Each marker type has a distinct color so they're easy to tell apart at a glance.
const MARKER_COLORS = {
    start: '#22C55E', // green  — universally understood as start
    finish: '#EF4444', // red    — universally understood as finish
    checkpoint: '#1a1a2e', // dark   — intermediate checkpoints
    participant: '#F97316', // orange — tracked athletes
    follower: '#6366F1', // indigo — "you are here" marker (viewer's own position)
    offline: '#94A3B8', // slate  — frozen "no signal" position (offline)
} as const;

// ── Distance-marker styling ───────────────────────────────────────────────────
const KM_MARKER_COLOR  = '#475569'; // slate — neutral dot anchor (labels tinted per leg)
const MINOR_KM_MIN_ZOOM = 13;       // every-km markers appear once zoomed in past this
                                    // (major 5km markers are always visible)

const ROUTE_OUT_COLOR = '#3B82F6'; // blue   — outbound ("going")
const ROUTE_IN_COLOR  = '#3B82F6'; // purple — inbound ("coming back")

// const INBOUND_OFFSET_M = 15; // metres the inbound lane is shifted sideways from outbound
const LANE_SEPARATION_M = 5;

const END_NUDGE_THRESHOLD_M = 15;  // within 15m of the finish → push the dot aside
const END_NUDGE_M           = 1;  // how far to the side (metres)

// Haversine distance in km between two lat/lon points.
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Cumulative distance (metres) at each route vertex.
const routeCumMeters = (route: [number, number][]): number[] => {
    const cum = [0];
    for (let i = 1; i < route.length; i++) {
        cum.push(cum[i - 1] + haversineKm(route[i - 1][1], route[i - 1][0], route[i][1], route[i][0]) * 1000);
    }
    return cum;
};

// Project (lon,lat) onto the route polyline. Returns the closest point ON the
// line plus the cumulative distance (metres) along the route at that point —
// the distance is used to nudge duplicates ALONG the line so they don't restack.
const projectToRoute = (
    lon: number, lat: number, route: [number, number][], cum: number[],
): { lon: number; lat: number; distM: number } => {
    let best = { d2: Infinity, lon, lat, distM: 0 };
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const X = (lo: number) => lo * 111320 * cosLat;
    const Y = (la: number) => la * 111320;
    const px = X(lon), py = Y(lat);
    for (let i = 1; i < route.length; i++) {
        const ax = X(route[i - 1][0]), ay = Y(route[i - 1][1]);
        const bx = X(route[i][0]),     by = Y(route[i][1]);
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        const d2 = (px - cx) ** 2 + (py - cy) ** 2;
        if (d2 < best.d2) {
            best = {
                d2,
                lon: route[i - 1][0] + t * (route[i][0] - route[i - 1][0]),
                lat: route[i - 1][1] + t * (route[i][1] - route[i - 1][1]),
                distM: cum[i - 1] + t * Math.sqrt(len2),
            };
        }
    }
    return { lon: best.lon, lat: best.lat, distM: best.distM };
};

// Position (lon,lat) at a given cumulative distance (metres) along the route.
const pointAtDistance = (distM: number, route: [number, number][], cum: number[]): [number, number] => {
    if (distM <= 0) return route[0];
    const total = cum[cum.length - 1];
    if (distM >= total) return route[route.length - 1];
    for (let i = 1; i < route.length; i++) {
        if (cum[i] >= distM) {
            const segLen = cum[i] - cum[i - 1] || 1;
            const t = (distM - cum[i - 1]) / segLen;
            return [
                route[i - 1][0] + t * (route[i][0] - route[i - 1][0]),
                route[i - 1][1] + t * (route[i][1] - route[i - 1][1]),
            ];
        }
    }
    return route[route.length - 1];
};

// Ramer–Douglas–Peucker: drop points that lie within `epsilon` of the line
// between their neighbours. Straight stretches collapse to two points; real
// corners are kept. epsilon is in metres.
const simplifyRDP = (pts: [number, number][], epsilonM: number): [number, number][] => {
    if (pts.length < 3) return pts;

    // perpendicular distance (metres) of p from line a→b, in local flat metres
    const perpDist = (p: [number, number], a: [number, number], b: [number, number]): number => {
        const cosLat = Math.cos((a[1] * Math.PI) / 180) || 1e-6;
        const toM = (lon: number, lat: number): [number, number] => [lon * 111320 * cosLat, lat * 111320];
        const [px, py] = toM(p[0], p[1]);
        const [ax, ay] = toM(a[0], a[1]);
        const [bx, by] = toM(b[0], b[1]);
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const cx = ax + t * dx, cy = ay + t * dy;
        return Math.hypot(px - cx, py - cy);
    };

    let maxD = 0, idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
        const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
        if (d > maxD) { maxD = d; idx = i; }
    }

    if (maxD > epsilonM) {
        const left  = simplifyRDP(pts.slice(0, idx + 1), epsilonM);
        const right = simplifyRDP(pts.slice(idx), epsilonM);
        return left.slice(0, -1).concat(right); // drop duplicated joint
    }
    return [pts[0], pts[pts.length - 1]];
};

// Shift a polyline perpendicular to its travel direction by a fixed metre amount.
// Used to draw the inbound leg as a parallel "lane" beside the outbound leg so
// its line, arrows and km markers don't land on top of the outbound geometry.
const offsetPolylineMeters = (coords: [number, number][], offsetM: number): [number, number][] => {
    const n = coords.length;
    if (n < 2 || offsetM === 0) return coords;
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        const a = coords[Math.max(0, i - 1)];
        const b = coords[Math.min(n - 1, i + 1)];
        const lat = coords[i][1];
        const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
        const dE = (b[0] - a[0]) * 111320 * cosLat; // east metres
        const dN = (b[1] - a[1]) * 111320;          // north metres
        const len = Math.sqrt(dE * dE + dN * dN) || 1;
        const ue = dE / len, un = dN / len;          // unit travel vector
        const pe = -un, pn = ue;                     // perpendicular (left of travel)
        const dLon = (pe * offsetM) / (111320 * cosLat);
        const dLat = (pn * offsetM) / 111320;
        out.push([coords[i][0] + dLon, coords[i][1] + dLat]);
    }
    return out;
};

// Nudge a point perpendicular to the segment a→b by `metres`, always to the
// SOUTH side. South is deliberate: the Finish checkpoint is nudged north on loop
// courses, so pushing participants south guarantees they never land on it, and
// the Start checkpoint isn't nudged at all, so any sideways move clears it too.
const nudgeAsidePerp = (
    lon: number, lat: number,
    a: [number, number], b: [number, number],
    metres: number,
): [number, number] => {
    const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
    const dE = (b[0] - a[0]) * 111320 * cosLat;   // east metres
    const dN = (b[1] - a[1]) * 111320;            // north metres
    const len = Math.hypot(dE, dN);
    let pe = len > 0 ? -dN / len : 0;             // perpendicular to travel
    let pn = len > 0 ?  dE / len : -1;            // (fallback: due south)
    if (pn > 0) { pe = -pe; pn = -pn; }           // force southern side
    return [
        lon + (pe * metres) / (111320 * cosLat),
        lat + (pn * metres) / 111320,
    ];
};

// Walk a polyline placing a marker at each integer-km boundary. distanceCoords
// drives the km VALUE (true geometry), posCoords drives the placed POSITION
// (may be the offset lane). Both arrays share indices/length. Returns the end km.
const placeKmMarkers = (
    distanceCoords: [number, number][],
    posCoords: [number, number][],
    startKm: number,
    leg: string,
    stopBeforeKm: number,
    features: GeoJSON.Feature<GeoJSON.Point>[],
): number => {
    let cumulative = startKm;
    let nextKm = Math.floor(startKm) + 1;
    for (let i = 1; i < distanceCoords.length; i++) {
        const segKm = haversineKm(
            distanceCoords[i - 1][1], distanceCoords[i - 1][0],
            distanceCoords[i][1], distanceCoords[i][0],
        );
        const segEnd = cumulative + segKm;
        while (nextKm <= segEnd && nextKm < stopBeforeKm) {
            if (segKm > 0) {
                const f = (nextKm - cumulative) / segKm;
                const lon = posCoords[i - 1][0] + (posCoords[i][0] - posCoords[i - 1][0]) * f;
                const lat = posCoords[i - 1][1] + (posCoords[i][1] - posCoords[i - 1][1]) * f;
                features.push({
                    type: 'Feature',
                    properties: { km: nextKm, is_major: nextKm % 5 === 0, label: `${nextKm}k`, leg },
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                });
            }
            nextKm += 1;
        }
        cumulative = segEnd;
    }
    return cumulative;
};

// Fan out any cluster of participant dots sitting on (almost) the same point so
// finishers — or runners physically together — render as separate, tappable dots.
// Clustering is by straight-line metres (not a grid), so a dot NEAR the finish,
// not exactly on it, is still caught. The spread is deliberately SMALL: a cluster
// still reads as "together here" when zoomed out and fans apart as you zoom in;
// the radius grows with crowd size so big groups don't crush together. Pure +
// deterministic (slots keyed by id → stable across refreshes). Counts are tiny,
// so the O(n²) proximity check is free, and the shift is a few metres — below GPS
// accuracy — so distance / speed / next-CP are untouched, only the screen dot.
const fanOutOverlaps = (
    placed: Array<{ p: ParticipantMapMarker; lon: number; lat: number }>,
    routeEnd: [number, number] | null = null,
): Array<{ p: ParticipantMapMarker; lon: number; lat: number }> => {
    if (placed.length < 2) return placed;

    const CLUSTER_EPS_M = 4;   // within ~4m → same spot (covers near-finish neighbours)
    const FAN_MIN_M     = 2;   // small base radius → subtle, reveals on zoom-in
    const FAN_GAP_M     = 3;   // arc gap between neighbours → drives growth with count
    const FINISH_PULL_M = 20;  // a cluster this close to the route end fans AROUND the
                               // end coordinate (finishers gather on the line) instead
                               // of around their own centroid.

    const cosLat = Math.cos((placed[0].lat * Math.PI) / 180) || 1e-6;
    const distM = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
        const dx = (a.lon - b.lon) * 111320 * cosLat;
        const dy = (a.lat - b.lat) * 111320;
        return Math.hypot(dx, dy);
    };

    const N = placed.length;
    const assigned = new Array(N).fill(false);

    for (let s = 0; s < N; s++) {
        if (assigned[s]) continue;

        // Grow a cluster: anything within EPS of ANY member joins (transitive).
        const g = [s];
        assigned[s] = true;
        for (let qi = 0; qi < g.length; qi++) {
            for (let j = 0; j < N; j++) {
                if (!assigned[j] && distM(placed[g[qi]], placed[j]) <= CLUSTER_EPS_M) {
                    assigned[j] = true;
                    g.push(j);
                }
            }
        }
        if (g.length < 2) continue;   // lone dot → leave it exactly where it is

        // Stable slot order so a given runner always gets the same angle.
        g.sort((a, b) => placed[a].p.id - placed[b].p.id);

        // Cluster centre = mean of the stacked points …
        let cLon = 0, cLat = 0;
        for (const i of g) { cLon += placed[i].lon; cLat += placed[i].lat; }
        cLon /= g.length; cLat /= g.length;

        // … but if this cluster is right at the route end, fan AROUND the end
        // coordinate instead, so finishers gather on the finish line rather than
        // a metre or two before it.
        if (routeEnd && distM({ lon: cLon, lat: cLat }, { lon: routeEnd[0], lat: routeEnd[1] }) <= FINISH_PULL_M) {
            cLon = routeEnd[0];
            cLat = routeEnd[1];
        }

        // Radius grows with crowd so dots keep ~FAN_GAP_M of arc between them.
        const radiusM = Math.max(FAN_MIN_M, (FAN_GAP_M * g.length) / (2 * Math.PI));

        g.forEach((i, k) => {
            const angle = (2 * Math.PI * k) / g.length - Math.PI / 2;  // first slot at top
            placed[i].lon = cLon + (radiusM * Math.cos(angle)) / (111320 * cosLat);
            placed[i].lat = cLat + (radiusM * Math.sin(angle)) / 111320;
        });
    }

    return placed;
};

interface LiveRouteMapProps {
    trackPoints: GPXTrackPoint[];
    aidStations: GPXAidStation[];
    participants: ParticipantMapMarker[];
    apiCheckpoints: CheckpointData[];
    onAidStationPress: (station: AidStationMapMarker) => void;
    onParticipantPress: (participant: ParticipantMapMarker) => void;
    isLoadingParticipants?: boolean;
    /** Viewer's own GPS position — plotted client-side, never stored to DB. */
    followerLocation?: { lat: number; lon: number } | null;
}

// ── Viewport helper ───────────────────────────────────────────────────────────
// Mapbox getVisibleBounds() returns [[neLon, neLat], [swLon, swLat]].
// Returns true when (lon,lat) sits inside that rectangle, with an optional
// margin (fraction of the viewport span) so a point that's technically
// on-screen but hugging the very edge still counts as "needs recenter".
const isPointInBounds = (
    lon: number,
    lat: number,
    visibleBounds: [[number, number], [number, number]],
    marginFraction = 0.15,
): boolean => {
    const [[neLon, neLat], [swLon, swLat]] = visibleBounds;

    const maxLon = Math.max(neLon, swLon);
    const minLon = Math.min(neLon, swLon);
    const maxLat = Math.max(neLat, swLat);
    const minLat = Math.min(neLat, swLat);

    // Shrink the box inward by marginFraction so points near the edge are
    // treated as out-of-view and trigger a recenter before they fully exit.
    const lonSpan = (maxLon - minLon) * marginFraction;
    const latSpan = (maxLat - minLat) * marginFraction;

    return (
        lon >= minLon + lonSpan &&
        lon <= maxLon - lonSpan &&
        lat >= minLat + latSpan &&
        lat <= maxLat - latSpan
    );
};

export const LiveRouteMap: React.FC<LiveRouteMapProps> = ({
    trackPoints,
    aidStations,
    participants,
    apiCheckpoints,
    onAidStationPress,
    onParticipantPress,
    isLoadingParticipants = false,
    followerLocation = null,
}) => {
    const cameraRef = useRef<Mapbox.Camera>(null);
    // ✅ NEW — ref to the MapView so we can read the current viewport
    // (getVisibleBounds) during auto-refresh and decide whether the tracked
    // participant has drifted off-screen.
    const mapViewRef = useRef<Mapbox.MapView>(null);
    const [mapReady, setMapReady] = useState(false);
    const mapReadyRef = useRef(false);
    const { t } = useTranslation(['livetracking', 'common']);

    // ✅ camera fit-once tracking.
    //
    //   hasFitCameraRef
    //     Becomes true after the FIRST successful auto-fit for the currently
    //     loaded route. While true, the route-bounds effect short-circuits so
    //     subsequent renders don't clobber the fan's manual zoom / pan. The
    //     participants effect no longer hard short-circuits — instead it does
    //     a "follow if off-screen" check (see below).
    //
    //   prevTrackPointsLengthRef
    //     Lets us detect a fresh route load (0 → N) to re-arm the auto-fit.
    const hasFitCameraRef          = useRef(false);
    const prevTrackPointsLengthRef = useRef(0);

    console.log('👥 Map received participants:', {
        count: participants.length,
        firstParticipant: participants[0] ? { lat: participants[0].lat, lon: participants[0].lon } : null,
    });

    const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> = React.useMemo(() => ({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'LineString',
            coordinates: trackPoints.map(pt => [pt.lon, pt.lat]),
        },
    }), [trackPoints]);

    // Single source of truth for the simplified route geometry. BOTH the drawn
    // route line (routeSplit) and the participant snap use this exact polyline,
    // so a snapped dot always sits on the line you see — at every zoom level.
    // (Snapping to the full trackPoints instead made dots drift off the drawn
    // line when zoomed in, because the drawn line is the simplified one.)
    const ROUTE_SIMPLIFY_M = 0;
    const simplifiedCoords = React.useMemo<[number, number][]>(() => {
        if (trackPoints.length < 2) return [];
        return simplifyRDP(trackPoints.map(pt => [pt.lon, pt.lat] as [number, number]), ROUTE_SIMPLIFY_M);
    }, [trackPoints]);

    const mapCenter = React.useMemo(() => {
        if (trackPoints.length === 0) return [4.4699, 50.5039];
        const lons = trackPoints.map(pt => pt.lon);
        const lats = trackPoints.map(pt => pt.lat);
        return [(Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2];
    }, [trackPoints]);

    const bounds = React.useMemo(() => {
        // Priority 1: GPX track
        if (trackPoints.length > 0) {
            const lons = trackPoints.map(pt => pt.lon);
            const lats = trackPoints.map(pt => pt.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        // Priority 2: participant positions
        const validParticipants = participants.filter(p => p.lat !== 0 && p.lon !== 0);
        if (validParticipants.length > 0) {
            const lons = validParticipants.map(p => p.lon);
            const lats = validParticipants.map(p => p.lat);
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        // Priority 3: API checkpoints
        const validCheckpoints = apiCheckpoints.filter(cp => {
            const lat = parseFloat(String(cp.latitude));
            const lon = parseFloat(String(cp.longitude));
            return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
        });
        if (validCheckpoints.length > 0) {
            const lons = validCheckpoints.map(cp => parseFloat(String(cp.longitude)));
            const lats = validCheckpoints.map(cp => parseFloat(String(cp.latitude)));
            console.log('📍 Bounds from checkpoints:', { lons, lats });
            return {
                ne: [Math.max(...lons), Math.max(...lats)] as [number, number],
                sw: [Math.min(...lons), Math.min(...lats)] as [number, number],
            };
        }

        return null;
    }, [trackPoints, participants, apiCheckpoints]);

    console.log('🗺️ Bounds source:', {
        hasTrackPoints: trackPoints.length > 0,
        hasValidParticipants: participants.filter(p => p.lat !== 0 && p.lon !== 0).length,
        hasValidCheckpoints: apiCheckpoints.filter(cp => cp.latitude && cp.longitude).length,
        bounds,
    });

    // ✅ detect "fresh route loaded" and re-arm the auto-fit.
    // When trackPoints transitions 0 → N (initial load or distance switch),
    // clear the "already fit" flag so the next render fits the new route.
    useEffect(() => {
        const prev = prevTrackPointsLengthRef.current;
        const curr = trackPoints.length;
        if (prev === 0 && curr > 0) {
            console.log('🆕 Fresh route loaded — re-arming auto-fit');
            hasFitCameraRef.current = false;
        }
        prevTrackPointsLengthRef.current = curr;
    }, [trackPoints]);

    // Route-bounds fit: fit ONCE per route load. The route never moves, so
    // after the first fit we leave the camera entirely to the user / to the
    // participants follow-effect below.
    useEffect(() => {
        if (!bounds) return;

        if (hasFitCameraRef.current) {
            console.log('🔒 Skipping bounds fit — camera already positioned (preserving user view)');
            return;
        }

        const tryFocus = () => {
            if (!cameraRef.current) {
                console.log('❌ cameraRef null, retrying...');
                setTimeout(tryFocus, 300);
                return;
            }
            const isSinglePoint = bounds.ne[0] === bounds.sw[0] && bounds.ne[1] === bounds.sw[1];
            console.log('📍 Focusing map | isSinglePoint:', isSinglePoint, '| coords:', bounds.ne);
            if (isSinglePoint) {
                cameraRef.current.setCamera({
                    centerCoordinate: bounds.ne,
                    zoomLevel: 15,
                    animationDuration: 100,
                    animationMode: 'flyTo',
                });
            } else {
                cameraRef.current.fitBounds(bounds.ne, bounds.sw, [50, 50, 50, 50], 1000);
            }
            hasFitCameraRef.current = true;
        };
        const timer = setTimeout(tryFocus, 300);
        return () => clearTimeout(timer);
    }, [bounds]);

    // ── Participants follow effect ─────────────────────────────────────────
    // BEFORE the first fit: behaves like before (fit to participant bounds).
    // AFTER the first fit: no longer hard short-circuits. Instead it preserves
    // the fan's current ZOOM and only PANS when the tracked position has
    // drifted off-screen (outside getVisibleBounds, minus a small margin).
    // If the tracked position is still comfortably on-screen, the camera is
    // left untouched so manual zoom / pan is preserved.
    useEffect(() => {
        if (!mapReadyRef.current) return;
        if (participants.length === 0) return;

        const valid = participants.filter(p => p.lat !== 0 && p.lon !== 0);
        if (valid.length === 0) return;
        if (!cameraRef.current) return;

        // ── Case 1: initial fit not done yet → original fit-to-bounds behaviour.
        if (!hasFitCameraRef.current) {
            const timer = setTimeout(() => {
                if (!cameraRef.current) return;

                if (valid.length === 1) {
                    cameraRef.current.setCamera({
                        centerCoordinate: [valid[0].lon, valid[0].lat],
                        zoomLevel: 15,
                        animationDuration: 800,
                        animationMode: 'flyTo',
                    });
                } else {
                    const lons = valid.map(p => p.lon);
                    const lats = valid.map(p => p.lat);
                    cameraRef.current.fitBounds(
                        [Math.max(...lons), Math.max(...lats)],
                        [Math.min(...lons), Math.min(...lats)],
                        [80, 80, 80, 80],
                        800
                    );
                }
                hasFitCameraRef.current = true;
            }, 500);

            return () => clearTimeout(timer);
        }

        // ── Case 2: already fit (auto-refresh) → follow only if off-screen,
        //    preserving the fan's current zoom level.
        let cancelled = false;

        const followIfOffScreen = async () => {
            if (!mapViewRef.current || !cameraRef.current) return;

            let visibleBounds: [[number, number], [number, number]] | null = null;
            try {
                // getVisibleBounds → [[neLon, neLat], [swLon, swLat]]
                visibleBounds = await mapViewRef.current.getVisibleBounds() as any;
            } catch (e) {
                console.log('⚠️ getVisibleBounds failed, skipping follow:', e);
                return;
            }
            if (cancelled || !visibleBounds) return;

            // Track the centroid of all valid participants (for a single
            // self-tracked user this is just their position).
            const lons = valid.map(p => p.lon);
            const lats = valid.map(p => p.lat);
            const centerLon = (Math.max(...lons) + Math.min(...lons)) / 2;
            const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;

            // If EVERY tracked point is still on-screen, leave the camera as
            // the fan set it. Otherwise recenter on the centroid, keeping zoom.
            const allOnScreen = valid.every(p =>
                isPointInBounds(p.lon, p.lat, visibleBounds!),
            );

            if (allOnScreen) {
                console.log('✅ Tracked position still on-screen — preserving fan view');
                return;
            }

            console.log('📍 Tracked position off-screen — panning to follow (zoom preserved)');
            // setCamera with ONLY centerCoordinate keeps the current zoomLevel.
            cameraRef.current!.setCamera({
                centerCoordinate: [centerLon, centerLat],
                animationDuration: 800,
                animationMode: 'easeTo',
            });
        };

        const timer = setTimeout(followIfOffScreen, 500);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [participants, mapReady]);

    // ── Shared route split (outbound / offset inbound) ──────────────────────────
    // Computed once; both the colored legs and the km markers derive from it.
    // Only loop / out-and-back routes (start ≈ end) are split at the cumulative-
    // distance midpoint (the turnaround on an out-and-back, first-half/second-half
    // on a loop). Point-to-point routes (start far from end) stay a single line.
    // The inbound leg's GEOMETRY is offset sideways so its line, arrows and km
    // markers form a parallel lane instead of stacking on the outbound geometry.
    const routeSplit = React.useMemo(() => {
        const coords = simplifiedCoords;
        if (coords.length < 2) {
            return { isLoop: false, outCoords: [] as [number, number][], inCoordsTrue: [] as [number, number][], inCoords: [] as [number, number][], totalKm: 0 };
        }

        const startEndKm = haversineKm(
            coords[0][1], coords[0][0],
            coords[coords.length - 1][1], coords[coords.length - 1][0],
        );
        const isLoop = startEndKm <= 0.1;

        let totalKm = 0;
        for (let i = 1; i < coords.length; i++) {
            totalKm += haversineKm(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
        }

        // Point-to-point (start far from end): one faithful on-road line, like RaceResult.
        if (!isLoop) {
            return { isLoop: false, outCoords: coords, inCoordsTrue: [] as [number, number][], inCoords: [] as [number, number][], totalKm };
        }

        // Real turnaround = point geographically farthest from the start.
        let turnIdx = 1, maxD = -1;
        for (let i = 1; i < coords.length; i++) {
            const d = haversineKm(coords[0][1], coords[0][0], coords[i][1], coords[i][0]);
            if (d > maxD) { maxD = d; turnIdx = i; }
        }
        if (turnIdx < 1) turnIdx = 1;
        if (turnIdx > coords.length - 2) turnIdx = coords.length - 2;

        const outCoords    = coords.slice(0, turnIdx + 1);   // TRUE path → on the road like RR
        const inCoordsTrue = coords.slice(turnIdx);          // TRUE → accurate km values

        // Does the return RETRACE the outbound (out-and-back) or use different
        // roads (true loop)? Sample inbound points; mostly within 30 m of the
        // outbound → retrace → offset it aside for the gap. Otherwise it's a real
        // loop already on separate streets → leave it on its true road.
        let retrace = false;
        {
            const sampleN = Math.min(8, inCoordsTrue.length);
            let close = 0, tested = 0;
            for (let s = 0; s < sampleN; s++) {
                const p = inCoordsTrue[Math.floor((s / sampleN) * inCoordsTrue.length)];
                let minM = Infinity;
                for (const q of outCoords) {
                    const d = haversineKm(p[1], p[0], q[1], q[0]) * 1000;
                    if (d < minM) minM = d;
                }
                tested++;
                if (minM < 30) close++;
            }
            retrace = tested > 0 && (close / tested) >= 0.6;
        }

        const inCoords = retrace
            ? offsetPolylineMeters(inCoordsTrue, LANE_SEPARATION_M)  // out-and-back → visible gap
            : inCoordsTrue;                                          // true loop → stay on road

        return { isLoop: true, outCoords, inCoords, inCoordsTrue, totalKm };
    }, [simplifiedCoords]);

    const participantsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        const valid = participants.filter(p => p.lat !== 0 || p.lon !== 0);

        // Snap to the DRAWN geometry (outbound + offset inbound legs), not the
        // true centerline. On loop/out-and-back courses the return leg is drawn
        // shifted sideways by INBOUND_OFFSET_M; snapping to the centerline left
        // dots floating that many metres off the purple lane when zoomed in.
        // Concatenating the legs makes each dot land on whichever lane is drawn
        // nearest it. (outCoords already === full simplified line on point-to-point.)
        const route = (routeSplit.isLoop && routeSplit.inCoords.length >= 2)
            ? routeSplit.outCoords.concat(routeSplit.inCoords)
            : routeSplit.outCoords;
        const canSnap = route.length >= 2;

        let placed: Array<{ p: ParticipantMapMarker; lon: number; lat: number }>;

        if (canSnap) {
            const cum = routeCumMeters(route);
            const snapped = valid.map(p => ({ p, distM: projectToRoute(p.lon, p.lat, route, cum).distM }));

            // Enforce a minimum gap between markers measured ALONG the route.
            const SPACING_M = 8;
            snapped.sort((a, b) => a.distM - b.distM);
            for (let i = 1; i < snapped.length; i++) {
                if (snapped[i].distM < snapped[i - 1].distM + SPACING_M) {
                    snapped[i].distM = snapped[i - 1].distM + SPACING_M;
                }
            }

            const total = cum[cum.length - 1];

            placed = snapped.map(({ p, distM }) => {
                let [lon, lat] = pointAtDistance(distM, route, cum);

                if (route.length >= 2) {
                    if (total - distM <= END_NUDGE_THRESHOLD_M) {
                        // Near the FINISH → nudge aside from the last segment.
                        [lon, lat] = nudgeAsidePerp(
                            lon, lat, route[route.length - 2], route[route.length - 1], END_NUDGE_M,
                        );
                    } else if (distM <= END_NUDGE_THRESHOLD_M) {
                        // Near the START → nudge aside from the first segment.
                        [lon, lat] = nudgeAsidePerp(lon, lat, route[0], route[1], END_NUDGE_M);
                    }
                }

                return { p, lon, lat };
            });
        } else {
            placed = valid.map(p => ({ p, lon: p.lon, lat: p.lat }));
        }

        // De-overlap: fan out participants that resolved to the same point
        // (several finishers at the line, or runners physically together) so each
        // dot stays visible + tappable. Pass the route end so a finish cluster
        // gathers ON the end coordinate. Runs for both the snapped and raw paths.
        const routeEnd: [number, number] | null = route.length >= 2 ? route[route.length - 1] : null;
        placed = fanOutOverlaps(placed, routeEnd);

        return {
            type: 'FeatureCollection',
            features: placed.map(({ p, lon, lat }) => ({
                type: 'Feature',
                properties: {
                    id: p.id,
                    bib: p.bib,
                    name: p.name,
                    customer_app_id: p.customer_app_id,
                    gender: p.gender,
                    position: p.position,
                    position_gender: p.position_gender,
                    position_category: p.position_category,
                    category: p.category,
                    race_time: p.race_time,
                    race_time_seconds: p.race_time_seconds,
                    distance_km: p.distance_km,
                    avg_speed_kmh: p.avg_speed_kmh,
                    last_checkpoint_name: p.last_checkpoint_name,
                    distance_to_next_cp: p.distance_to_next_cp,
                    last_update: p.last_update,
                    last_update_time: p.last_update_time,
                    last_update_type: p.last_update_type,
                    profile_picture: p.profile_picture,
                    source: p.source,
                    initials: p.initials,
                    battery_level: p.battery_level ?? null,
                    is_estimated: p.is_estimated ?? false,
                    connection_status: p.connection_status ?? 'live',
                },
                geometry: { type: 'Point', coordinates: [lon, lat] },
            })),
        };
    }, [participants, routeSplit]);

    // ── Distance (km) markers ───────────────────────────────────────────────────
    // Placed by cumulative distance. Outbound markers sit on the true path;
    // inbound markers use the TRUE inbound geometry for the km value but the
    // OFFSET geometry for position, so they sit on the purple lane while the
    // labels stay accurate. Loop/out-and-back numbers continue across the
    // turnaround (… 8k going, 9k coming back). We never place a marker at total
    // distance (the Finish). Each marker is tagged `leg` so labels can be tinted.
    const distanceMarkersGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        const { isLoop, outCoords, inCoordsTrue, inCoords, totalKm } = routeSplit;
        if (outCoords.length < 2 || totalKm <= 0) {
            return { type: 'FeatureCollection', features: [] };
        }
        const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

        if (!isLoop) {
            placeKmMarkers(outCoords, outCoords, 0, 'out', totalKm, features);
        } else {
            const outEnd = placeKmMarkers(outCoords, outCoords, 0, 'out', totalKm, features);
            placeKmMarkers(inCoordsTrue, inCoords, outEnd, 'in', totalKm, features);
        }

        console.log(`📏 Route km markers: ${features.length} placed (total ${totalKm.toFixed(2)}km, loop=${isLoop})`);
        return { type: 'FeatureCollection', features };
    }, [routeSplit]);

    // ── Route legs (outbound / inbound) ─────────────────────────────────────────
    // Loop/out-and-back routes draw an outbound leg (true path) and an inbound
    // leg (offset lane); point-to-point routes have only the outbound leg → a
    // single line. Derived from routeSplit so geometry, arrows and km markers all
    // agree on where each lane is.
    const routeLegsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => {
        const { isLoop, outCoords, inCoords } = routeSplit;
        if (outCoords.length < 2) return { type: 'FeatureCollection', features: [] };

        const features: GeoJSON.Feature<GeoJSON.LineString>[] = [
            { type: 'Feature', properties: { leg: 'out' }, geometry: { type: 'LineString', coordinates: outCoords } },
        ];
        if (isLoop && inCoords.length >= 2) {
            features.push({ type: 'Feature', properties: { leg: 'in' }, geometry: { type: 'LineString', coordinates: inCoords } });
        }
        return { type: 'FeatureCollection', features };
    }, [routeSplit]);

    const aidStationsGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
        if (apiCheckpoints.length > 0) {
            const validCheckpoints = apiCheckpoints.filter(cp => {
                const lat = parseFloat(String(cp.latitude));
                const lon = parseFloat(String(cp.longitude));
                const valid = !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
                if (!valid) {
                    console.log(`⚠️ Skipping checkpoint "${cp.name}" — invalid coords:`, cp.latitude, cp.longitude);
                }
                return valid;
            });

            console.log(`🗺️ Checkpoints: ${apiCheckpoints.length} total, ${validCheckpoints.length} with valid coords`);

            // ── Start/Finish overlap handling ──────────────────────────────
            // On LOOP courses start ≈ finish, so the S and F markers would
            // render on top of each other. We nudge the finish marker a tiny
            // amount ONLY in that case. On point-to-point courses (start far
            // from finish) the finish keeps its TRUE coordinate, so zooming in
            // shows it exactly on the route end instead of floating ~33m aside.
            const startCp  = validCheckpoints.find(cp => cp.is_start);
            const finishCp = validCheckpoints.find(cp => cp.is_finish);

            let finishNudgeLat = 0;
            if (startCp && finishCp) {
                const sLat = parseFloat(String(startCp.latitude));
                const sLon = parseFloat(String(startCp.longitude));
                const fLat = parseFloat(String(finishCp.latitude));
                const fLon = parseFloat(String(finishCp.longitude));
                // Cheap equirectangular metres (exact enough under ~100m).
                const dLatM = (fLat - sLat) * 111320;
                const dLonM = (fLon - sLon) * 111320 * Math.cos((sLat * Math.PI) / 180);
                const startFinishMeters = Math.sqrt(dLatM * dLatM + dLonM * dLonM);

                // Within ~25m → effectively the same point (loop). A ~6.7m
                // nudge keeps both circles visible while the finish stays
                // essentially on the route end at any zoom.
                if (startFinishMeters <= 25) {
                    finishNudgeLat = 0.00006; // ≈ 6.7m north
                }
            }

            return {
                type: 'FeatureCollection',
                features: validCheckpoints.map((checkpoint, idx) => {
                    const lat = parseFloat(String(checkpoint.latitude));
                    const lon = parseFloat(String(checkpoint.longitude));

                    // Only loop-course finishes get a small nudge; everything
                    // else (and all non-finish CPs) sits on its true coordinate.
                    const useLat = checkpoint.is_finish ? lat + finishNudgeLat : lat;
                    const useLon = lon;

                    return {
                        type: 'Feature' as const,
                        properties: {
                            id: `checkpoint-${idx}`,
                            name: getCheckpointName(t, checkpoint.name, checkpoint.is_start, checkpoint.is_finish),
                            distance_km: checkpoint.distance,
                            ele: checkpoint.elevation,
                            accessible_by_car: checkpoint.accessible_by_car,
                            is_start: checkpoint.is_start,
                            is_finish: checkpoint.is_finish,
                            features: JSON.stringify(checkpoint.features ?? []),
                            description: checkpoint.description ?? '',
                        },
                        geometry: {
                            type: 'Point' as const,
                            coordinates: [useLon, useLat],
                        },
                    };
                }),
            };
        }

        return {
            type: 'FeatureCollection',
            features: aidStations.map((station, idx) => ({
                type: 'Feature' as const,
                properties: {
                    id: `aid-${idx}`,
                    name: station.name,
                    distance_km: station.distance || 0,
                    ele: station.ele,
                    accessible_by_car: station.accessible_by_car,
                    is_start: false,
                    is_finish: false,
                },
                geometry: {
                    type: 'Point' as const,
                    coordinates: [station.lon, station.lat],
                },
            })),
        };
    }, [aidStations, apiCheckpoints]);

    const followerGeoJSON = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => ({
        type: 'FeatureCollection',
        features: followerLocation
            ? [{
                type: 'Feature',
                properties: { type: 'follower' },
                geometry: { type: 'Point', coordinates: [followerLocation.lon, followerLocation.lat] },
            }]
            : [],
    }), [followerLocation]);

    const handleParticipantPress = (event: any) => {
        console.log('👆 Participant tapped:', event.features?.length);
        const feature = event.features[0];

        if (feature && feature.properties) {
            const props = feature.properties;
            const participant: ParticipantMapMarker = {
                id: props.id,
                customer_app_id: props.customer_app_id,
                bib: props.bib,
                name: props.name,
                initials: props.initials,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                ele: 0,
                gender: props.gender,
                position: props.position,
                position_gender: props.position_gender,
                position_category: props.position_category,
                category: props.category,
                race_time: props.race_time,
                race_time_seconds: props.race_time_seconds,
                distance_km: props.distance_km,
                avg_speed_kmh: props.avg_speed_kmh,
                last_checkpoint_name: props.last_checkpoint_name,
                distance_to_next_cp: props.distance_to_next_cp,
                last_update: props.last_update,
                last_update_time: props.last_update_time,
                last_update_type: props.last_update_type,
                profile_picture: props.profile_picture,
                source: props.source,
                battery_level: props.battery_level ?? null,
                is_estimated: props.is_estimated ?? false,
                connection_status: props.connection_status ?? 'live',
            };
            onParticipantPress(participant);
        }
    };

    const handleAidStationPress = (event: any) => {
        const feature = event.features[0];
        if (feature && feature.properties) {
            const props = feature.properties;
            const station: AidStationMapMarker = {
                id: props.id,
                name: props.name,
                lat: feature.geometry.coordinates[1],
                lon: feature.geometry.coordinates[0],
                ele: props.ele,
                distance_km: props.distance_km,
                accessible_by_car: props.accessible_by_car,
                features: typeof props.features === 'string'
                    ? JSON.parse(props.features)
                    : props.features ?? [],
                description: props.description ?? '',
            };

            onAidStationPress(station);
        }
    };

    return (
        <View style={liveTrackingStyles.mapContainer}>
            <Mapbox.MapView
                ref={mapViewRef}
                style={{ flex: 1 }}
                styleURL={Mapbox.StyleURL.Outdoors}
                compassEnabled={true}
                scaleBarEnabled={false}
                logoEnabled={false}
                attributionEnabled={false}
                onDidFinishLoadingMap={() => {
                    console.log('🗺️ Map finished loading');
                    mapReadyRef.current = true;
                    setMapReady(true);
                }}
            >
                <Mapbox.Camera
                    ref={cameraRef}
                    centerCoordinate={mapCenter as [number, number]}
                    zoomLevel={12}
                    animationMode="flyTo"
                    animationDuration={1000}
                />

                {/* ── Route legs + direction arrows ───────────────────────────
                    Loop/out-and-back routes draw the outbound leg blue on the
                    true path and the inbound leg purple on a parallel lane
                    (its GEOMETRY is offset, so line + arrows + km all line up).
                    Point-to-point routes have only the 'out' feature → single
                    blue line. Arrows use allowOverlap so BOTH directions always
                    render — that's what fixes the missing return chevrons. */}
                <Mapbox.ShapeSource id="route-source" shape={routeLegsGeoJSON}>
                    {/* ── Casing (border) layers — drawn first so they sit UNDER
                        the colored lines, creating a slick outline. Wider than
                        the line on top. */}
                    <Mapbox.LineLayer
                        id="route-line-out-casing"
                        filter={['==', ['get', 'leg'], 'out'] as any}
                        style={{
                            lineColor: '#1E293B',
                            lineWidth: 7,            // wider than the 4px line on top
                            lineCap: 'round',
                            lineJoin: 'round',
                            lineOpacity: 0.9,
                        }}
                    />
                    <Mapbox.LineLayer
                        id="route-line-in-casing"
                        filter={['==', ['get', 'leg'], 'in'] as any}
                        style={{
                            lineColor: '#1E293B',
                            lineWidth: 7,
                            lineCap: 'round',
                            lineJoin: 'round',
                            lineOpacity: 0.9,
                        }}
                    />

                    {/* Outbound line (going) */}
                    <Mapbox.LineLayer
                        id="route-line-out"
                        filter={['==', ['get', 'leg'], 'out'] as any}
                        style={{
                            lineColor: ROUTE_OUT_COLOR,
                            lineWidth: 4,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                    {/* Inbound line (coming back) — geometry already offset into
                        a parallel lane, so no lineOffset here */}
                    <Mapbox.LineLayer
                        id="route-line-in"
                        filter={['==', ['get', 'leg'], 'in'] as any}
                        style={{
                            lineColor: ROUTE_IN_COLOR,
                            lineWidth: 4,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />

                    {/* Outbound arrows (blue halo) */}
                    <Mapbox.SymbolLayer
                        id="route-arrows-out"
                        filter={['==', ['get', 'leg'], 'out'] as any}
                        minZoomLevel={12}
                        style={{
                            symbolPlacement: 'line',
                            symbolSpacing: 140,
                            textField: '▶',                 // swap to '>' if blank
                            textSize: 14,
                            textColor: '#FFFFFF',
                            textHaloColor: ROUTE_OUT_COLOR,
                            textHaloWidth: 1.5,
                            textKeepUpright: false,
                            textRotationAlignment: 'map',
                            textPitchAlignment: 'map',
                            textAllowOverlap: true,         // ✅ always render
                            textIgnorePlacement: true,
                        }}
                    />
                    {/* Inbound arrows (purple halo) */}
                    <Mapbox.SymbolLayer
                        id="route-arrows-in"
                        filter={['==', ['get', 'leg'], 'in'] as any}
                        minZoomLevel={12}
                        style={{
                            symbolPlacement: 'line',
                            symbolSpacing: 140,
                            textField: '▶',
                            textSize: 14,
                            textColor: '#FFFFFF',
                            textHaloColor: ROUTE_IN_COLOR,
                            textHaloWidth: 1.5,
                            textKeepUpright: false,
                            textRotationAlignment: 'map',
                            textPitchAlignment: 'map',
                            textAllowOverlap: true,
                            textIgnorePlacement: true,
                        }}
                    />
                </Mapbox.ShapeSource>

                {/* ── Distance (km) markers ───────────────────────────────────
                    Points on km-markers-source. Dots stay slate (neutral
                    anchor); labels are tinted blue (outbound) / purple (inbound)
                    so they match their lane. Major (every 5km) always visible
                    and grow when zoomed out; minor (every km) only appears once
                    zoomed in past MINOR_KM_MIN_ZOOM. */}
                {trackPoints.length > 1 && (
                    <Mapbox.ShapeSource id="km-markers-source" shape={distanceMarkersGeoJSON}>
                        {/* Major dots (5,10,15 …) — always visible, grow when zoomed out */}
                        <Mapbox.CircleLayer
                            id="km-dots-major"
                            filter={['==', ['get', 'is_major'], true] as any}
                            style={{
                                circleColor: KM_MARKER_COLOR,
                                circleRadius: [
                                    'interpolate', ['linear'], ['zoom'],
                                    10, 9,   // zoomed out → bigger
                                    13, 6,
                                    16, 5,   // zoomed in → normal
                                ] as any,
                                circleStrokeWidth: 2,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                                // Estimated (weak signal) → translucent so it reads as provisional.
                                circleOpacity: ['case', ['==', ['get', 'is_estimated'], true], 0.55, 1] as any,
                            }}
                        />
                        <Mapbox.SymbolLayer
                            id="km-labels-major"
                            filter={['==', ['get', 'is_major'], true] as any}
                            style={{
                                textField: ['get', 'label'] as any,
                                textSize: [
                                    'interpolate', ['linear'], ['zoom'],
                                    10, 14,
                                    13, 12,
                                    16, 11,
                                ] as any,
                                textColor: ['case', ['==', ['get', 'leg'], 'in'], ROUTE_IN_COLOR, ROUTE_OUT_COLOR] as any,
                                textHaloColor: '#FFFFFF',
                                textHaloWidth: 2,
                                textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                                textOffset: [0, -0.9],
                                textAnchor: 'bottom',
                                textAllowOverlap: false,
                                textIgnorePlacement: false,
                            }}
                        />

                        {/* Minor dots (1,2,3 …) — only when zoomed in */}
                        <Mapbox.CircleLayer
                            id="km-dots-minor"
                            minZoomLevel={MINOR_KM_MIN_ZOOM}
                            filter={['!=', ['get', 'is_major'], true] as any}
                            style={{
                                circleColor: KM_MARKER_COLOR,
                                circleRadius: 4,
                                circleStrokeWidth: 2,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                                circleOpacity: 0.9,
                            }}
                        />
                        <Mapbox.SymbolLayer
                            id="km-labels-minor"
                            minZoomLevel={MINOR_KM_MIN_ZOOM}
                            filter={['!=', ['get', 'is_major'], true] as any}
                            style={{
                                textField: ['get', 'label'] as any,
                                textSize: 10,
                                textColor: ['case', ['==', ['get', 'leg'], 'in'], ROUTE_IN_COLOR, ROUTE_OUT_COLOR] as any,
                                textHaloColor: '#FFFFFF',
                                textHaloWidth: 2,
                                textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                                textOffset: [0, -0.9],
                                textAnchor: 'bottom',
                                textAllowOverlap: false,
                                textIgnorePlacement: false,
                            }}
                        />
                    </Mapbox.ShapeSource>
                )}

                {/* ── Checkpoints / Aid Stations ─────────────────────────── */}
                <Mapbox.ShapeSource
                    id="aidstations-source"
                    shape={aidStationsGeoJSON}
                    onPress={handleAidStationPress}
                >
                    <Mapbox.CircleLayer
                        id="aidstation-circles"
                        style={{
                            circleColor: [
                                'case',
                                ['==', ['get', 'is_start'], true], MARKER_COLORS.start,
                                ['==', ['get', 'is_finish'], true], MARKER_COLORS.finish,
                                MARKER_COLORS.checkpoint,
                            ] as any,
                            circleRadius: 14,
                            circleStrokeWidth: 3,
                            circleStrokeColor: '#FFFFFF',
                            circlePitchAlignment: 'map',
                            circleOpacity: 1,
                        }}
                    />

                    <Mapbox.SymbolLayer
                        id="aidstation-fork-icons"
                        filter={['all',
                            ['!=', ['get', 'is_start'], true],
                            ['!=', ['get', 'is_finish'], true],
                        ] as any}
                        style={{
                            iconImage: 'restaurant-15',
                            iconSize: 1.2,
                            iconColor: '#FFFFFF',
                            iconAllowOverlap: true,
                            iconIgnorePlacement: true,
                        }}
                    />

                    <Mapbox.SymbolLayer
                        id="aidstation-sf-labels"
                        filter={['any',
                            ['==', ['get', 'is_start'], true],
                            ['==', ['get', 'is_finish'], true],
                        ] as any}
                        style={{
                            textField: ['case',
                                ['==', ['get', 'is_start'], true], 'S',
                                'F',
                            ] as any,
                            textSize: 14,
                            textColor: '#FFFFFF',
                            textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                            textAllowOverlap: true,
                            iconAllowOverlap: true,
                            textIgnorePlacement: true,
                        }}
                    />
                </Mapbox.ShapeSource>

                {/* ── Participants ───────────────────────────────────────── */}
                {participants.length > 0 && (
                    <Mapbox.ShapeSource
                        id="participants-source"
                        shape={participantsGeoJSON}
                        onPress={handleParticipantPress}
                    >
                        <Mapbox.CircleLayer
                            id="participant-dots"
                            style={{
                                // Offline → slate grey: no live signal, dot is frozen on the
                                // last received position. Everything else → orange.
                                circleColor: [
                                    'case',
                                    ['==', ['get', 'connection_status'], 'offline'], MARKER_COLORS.offline,
                                    MARKER_COLORS.participant,
                                ] as any,
                                circleRadius: 13,
                                circleStrokeWidth: 4,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                                // Translucent ONLY when the dot is an actual dead-reckoned
                                // estimate. A merely-stale fix still showing the real last
                                // position stays solid — it's real, just a bit old (the popup
                                // conveys "last seen X ago"). offline → solid grey.
                                circleOpacity: [
                                    'case',
                                    ['==', ['get', 'is_estimated'], true], 0.55,
                                    1,
                                ] as any,
                            }}
                        />
                        <Mapbox.SymbolLayer
                            id="participant-bibs"
                            style={{
                                textField: ['get', 'initials'],
                                textSize: 11,
                                textColor: '#FFFFFF',          // white text on the orange dot
                                textFont: ['Open Sans Bold', 'Arial Unicode MS Bold'],
                                textAllowOverlap: true,
                                textIgnorePlacement: true,
                                // no textOffset / no textAnchor → text centers on the point
                                // no minZoomLevel → label shows at every zoom
                            }}
                        />
                    </Mapbox.ShapeSource>
                )}

                {/* ── Follower "You are here" marker ──────────────────────── */}
                {followerLocation && (
                    <Mapbox.ShapeSource id="follower-source" shape={followerGeoJSON}>
                        <Mapbox.CircleLayer
                            id="follower-dot"
                            style={{
                                circleColor: MARKER_COLORS.follower,
                                circleRadius: 10,
                                circleStrokeWidth: 3,
                                circleStrokeColor: '#FFFFFF',
                                circlePitchAlignment: 'map',
                            }}
                        />
                        <Mapbox.SymbolLayer
                            id="follower-label"
                            style={{
                                textField: 'YOU',
                                textSize: 10,
                                textColor: MARKER_COLORS.follower,
                                textHaloColor: '#FFFFFF',
                                textHaloWidth: 2,
                                textOffset: [0, 1.8],
                                textAnchor: 'top',
                                textAllowOverlap: true,
                                textIgnorePlacement: true,
                            }}
                        />
                    </Mapbox.ShapeSource>
                )}
            </Mapbox.MapView>

            {isLoadingParticipants && (
                <View style={liveTrackingStyles.mapLoadingOverlay}>
                    <View style={liveTrackingStyles.mapLoadingBox}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={liveTrackingStyles.mapLoadingText}>
                            Loading participants...
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
};