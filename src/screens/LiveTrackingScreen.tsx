import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/common/AppHeader';
import { RaceStatePill } from '../components/RaceStatePill';
import { BottomNavigation } from '../components/common/BottomNavigation';
import { BottomNavigationFollower } from '../components/common/BottomNavigationFollower';
import { LiveTrackingScreenProps } from '../types/navigation';
import { DistanceDropdown } from '../components/DistanceDropdown';
import { LiveRouteMap } from '../components/LiveMap/LiveRouteMap';
import { LiveElevationProfile } from '../components/ElevationProfile/LiveElevationProfile';
import { ParticipantPopup } from '../components/LiveMap/ParticipantPopup';
import { AidStationPopup } from '../components/LiveMap/AidStationPopup';
import { liveTrackingService, DistanceOption, LiveTrackingParticipant } from '../services/liveTrackingService';
import { gpxService, GPXRouteData } from '../services/gpxService';
import { buildChartData } from '../utils/geoUtils';
import { ParticipantMapMarker, AidStationMapMarker, PopupState, CheckpointData } from '../types/liveTracking';
import { useFollowManager } from '../hooks/useFollowManager';
import { followedBibsForEvent } from '../utils/liveMapBibs';
import {
    isCurrentLiveResponse, dropClearsLoading, ownsError, liveFollowsKey,
    failureShowsErrorScreen, shouldRunAutoRefresh, rateLimitPauseMs, liveRefreshMs, isFullLoad,
} from '../utils/liveMapRequests';
import { isRateLimited } from '../services/api';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { commonStyles, palette, fonts, space } from '../styles/common.styles';
import { liveTrackingStyles, ELEVATION_PANEL_HEIGHT } from '../styles/liveTracking.styles';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../hooks/useLandscapeSidePadding';
import { ChartDataPoint } from '../types';
import ErrorScreen from '../components/ErrorScreen';
import { useScreenError } from '../hooks/useApiError';
import { tokenService } from '../services/tokenService';
import * as Location from 'expo-location';
import { isTracking } from '../services/gpsService';
import { useDimensions } from '../hooks/useDimensions';
import { analyticsService } from '../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../constants/analyticsScreens';

// ✅ Stable empty props for the memoised elevation profile (a `[]` literal is a
// new array on every render, so React.memo always saw a change).
const NO_AID_STATIONS: GPXRouteData['aidStations'] = [];
const NO_CHECKPOINTS: CheckpointData[] = [];
const NO_MARKERS: ParticipantMapMarker[] = [];

const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
};

const LiveTrackingScreen: React.FC<LiveTrackingScreenProps> = ({ route, navigation }) => {
    const { t } = useTranslation(['livetracking', 'common']);
    const { product_app_id, product_option_value_app_id, event_name, event_image, sourceScreen, sectionType, sourceTab, event_source, selectedDistanceLabel } = route.params;

    // Same runtime split ResultList uses: the follower and participant sections
    // reach this screen by different routes, and collapsing them into one
    // ui_screen value would make it impossible to tell which section drives
    // live-map usage.
    const liveScreenName = sectionType === 'follower'
        ? ANALYTICS_SCREENS.FOLLOWER_LIVE_TRACKING
        : ANALYTICS_SCREENS.LIVE_TRACKING;
    const { width, height } = useDimensions(); // make sure height is destructured
    const isLandscape = width > height;
    const insets = useSafeAreaInsets();
    const isGestureNav = insets.bottom > 0;
    // ✅ Notch side padding for the body below AppHeader (edges are ['bottom']
    // on a notched iPhone in landscape, so nothing else pads the sides).
    const sidePadding = useLandscapeSidePadding();
    const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides
    // ✅ Measured height of the map area (layout audit 2026-10-22). The 224pt
    // elevation panel is pinned to its bottom; in landscape the area is only
    // ~96-130pt, so the panel covered the whole map, overflowed up over the
    // distance selector (taking its taps), and the collapse button - placed
    // with tab-bar + inset maths at 187pt+ - sat above the container where
    // Android could not tap it. In portrait Android 3-button (inset 0) that
    // same button covered the panel's ELEVATION / D+ header.
    const [mapAreaHeight, setMapAreaHeight] = useState(0);
    const isCustomEvent = event_source === 'custom';
    const { followedUsers, followedBibs, refreshFollowedUsers } = useFollowManager(t);
    // ✅ [#MAP-BIB-FOLLOWS] Runners followed BY BIB on this event (feedback #31:
    // a fan who followed bib 450 saw them on Result Details but an empty map).
    // The joined key is the effect dependency — followedBibs is a new Map on
    // every reload even when nothing changed.
    const eventBibs = useMemo(
        () => followedBibsForEvent(followedBibs, product_app_id, event_source),
        [followedBibs, product_app_id, event_source],
    );
    const eventBibsKey = eventBibs.join(',');
    // Accounts + bibs as one stable key: a follow or unfollow of either kind
    // (also one made on another screen, picked up on focus below) refreshes the map.
    const followsKey = useMemo(() => liveFollowsKey(followedUsers, eventBibs), [followedUsers, eventBibs]);
    const [routeData, setRouteData] = useState<GPXRouteData | null>(null);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [participants, setParticipants] = useState<LiveTrackingParticipant[]>([]);
    const [distances, setDistances] = useState<DistanceOption[]>([]);
    const [selectedDistance, setSelectedDistance] = useState<DistanceOption | null>(null);
    const [apiCheckpoints, setApiCheckpoints] = useState<CheckpointData[]>([]);
    const [loading, setLoading] = useState(true);
    //const [error, setError] = useState<string | null>(null);
    const [popupState, setPopupState] = useState<PopupState>({ type: null, data: null });
    // Not forced collapsed in landscape (verify pass): on a phone the panel is
    // hidden there anyway (panelHeight < MIN_PANEL), a tablet gets the 60% cap,
    // and back in portrait the panel is as the user left it.
    const [profileCollapsed, setProfileCollapsed] = useState(false);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [loadedGpxUrl, setLoadedGpxUrl] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [raceDate, setRaceDate] = useState<string | null>(null);
    const [countdownStatus, setCountdownStatus] =
        useState<'not_started' | 'in_progress' | 'finished' | null>(null);
    const isRrActive = !isCustomEvent && showResults;

    /**
     * What the map's status pill says. `sourceTab` is the list the user came
     * from and is the only status the screen is handed, so it leads. When it is
     * absent, fall back to the event's own date: a race whose day has passed is
     * finished, one still ahead is upcoming, and today's is live.
     */
    const raceState: 'live' | 'finished' | 'upcoming' = useMemo(() => {
        // The API's countdown leads. It is computed from the per-distance
        // race_date + start_time + end_time in the event's own timezone, so it
        // is right for multi-day events and midnight-crossing starts.
        if (countdownStatus === 'finished') return 'finished';
        if (countdownStatus === 'not_started') return 'upcoming';
        if (countdownStatus === 'in_progress') return 'live';

        // `sourceTab` is only a hint, and a weak one: BottomNavigation,
        // HomeScreen, EventCardLive and the participant DistanceTab all pass a
        // hardcoded 'live'. Trust it only to say "not live".
        if (sourceTab === 'past') return 'finished';
        if (sourceTab === 'upcoming') return 'upcoming';
        const day = (raceDate ?? '').slice(0, 10);
        if (!day) return isRrActive ? 'live' : 'upcoming';
        // LOCAL calendar date, not toISOString(): that returns UTC, and the race
        // date is a plain local day. In Belgium (UTC+1/+2) the UTC date is still
        // yesterday until 01:00-02:00 local, so a 04:00 trail start would have
        // read as "Upcoming" on its own race morning.
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (day < today) return 'finished';
        if (day > today) return 'upcoming';
        return 'live';
    }, [countdownStatus, sourceTab, raceDate, isRrActive]);
    const [trainingFree, setTrainingFree] = useState(false);
    

    // ✅ Follower's own device location — plotted directly from GPS,
    // never stored to DB (follower is watching, not racing).
    const [followerLocation, setFollowerLocation] = useState<{ lat: number; lon: number } | null>(null);

    const hasLoadedInitialData = useRef(false);
    // followsKey of the last live-tracking request (see the follow refresh effect).
    const sentFollowsKey = useRef('');
    // Which answer may still be applied — see utils/liveMapRequests.
    const requestSeq = useRef(0);
    const lastAppliedSeq = useRef(0);
    const wantedDistanceId = useRef<number | null>(null);
    // Running requests: seq → the distance each asks for (null until known).
    const inFlightDistance = useRef(new Map<number, number | null>());
    const { error, hasError, handleApiError, clearError } = useScreenError();
    // ✅ (app audit 2026-11-26) Polling only while the map is the screen on top.
    // The native stack keeps this screen mounted under Result Details / the
    // tab bar's other screens, and its 60 s / 10 s refresh, location watcher
    // and requests used to keep running there unseen.
    const isFocused = useIsFocused();
    // A map has been drawn from a successful answer: a later failed auto
    // refresh keeps it (failureShowsErrorScreen) instead of hiding it.
    const hasShownData = useRef(false);
    // Auto / follow refreshes still waiting — the next tick waits for them.
    const autoInFlight = useRef(0);
    // 429 Retry-After: no auto refresh before this instant (epoch ms).
    const pausedUntil = useRef(0);
    // When the last answer was applied, to refresh at once on refocus if stale.
    const lastAppliedAt = useRef(0);
    // The last auto refresh failed; the map shows the previous positions.
    const [refreshFailed, setRefreshFailed] = useState(false);

    const participantMarkers: ParticipantMapMarker[] = useMemo(() => {
        return participants
            .filter(p => {
                // ✅ Skip participants with null/zero coordinates.
                // safeParseFloat returns 0 for null, and (0,0) plots in the
                // Gulf of Guinea — means participant has no GPS fix yet.
                // Use || not && so a single zero axis is still valid.
                const lat = safeParseFloat(p.latitude);
                const lon = safeParseFloat(p.longitude);
                return lat !== 0 || lon !== 0;
            })
            .map(p => {
                const firstInitial = p.firstname?.charAt(0).toUpperCase() || '';
                const lastInitial = p.lastname?.charAt(0).toUpperCase() || '';
                // Bib is only meaningful when RaceResult is active. Custom events and
                // partner events with RR off have no bib to show, so fall back to
                // initials. Per-participant check too, in case a bib is missing on an
                // otherwise RR-active event.
                const bib = String(p.bib_number ?? '').trim();
                const initials = (isRrActive && bib !== '')
                    ? bib
                    : `${firstInitial}${lastInitial}`;

                return {
                    id: p.participant_app_id,
                    customer_app_id: p.customer_app_id,
                    bib: p.bib_number,
                    name: `${p.firstname || ''} ${p.lastname || ''}`.trim() || 'Unknown',
                    initials,
                    source: p.source,
                    lat: safeParseFloat(p.latitude),
                    lon: safeParseFloat(p.longitude),
                    ele: safeParseFloat(p.altitude),
                    gender: p.gender,
                    position: p.position || '',
                    position_gender: p.position_gender || '',
                    position_category: p.position_category || '',
                    category: p.category || '',
                    race_time: p.race_time_display || '00:00:00',
                    race_time_seconds: p.race_time_seconds || 0,
                    distance_km: safeParseFloat(p.distance_covered_km),
                    avg_speed_kmh: safeParseFloat(p.avg_speed_kmh),
                    last_checkpoint_name: p.last_checkpoint_name || '',
                    distance_to_next_cp: p.distance_to_next_cp !== null ? safeParseFloat(p.distance_to_next_cp) : null,
                    last_update: p.last_update || new Date().toISOString(),
                    profile_picture: p.profile_picture,
                    last_update_time: p.last_update_time,
                    last_update_type: p.last_update_type,
                    battery_level: p.battery_level ?? null,
                    is_estimated: p.is_estimated ?? (p.location_source === 'estimated'),
                    connection_status: p.connection_status ?? null,
                };
            });
    }, [participants, isRrActive]);

    // ✅ The poll replaces `participants` wholesale, so participantMarkers above is
    // rebuilt with brand-new object identities every cycle. popupState.data is the
    // object captured at tap time and is orphaned the moment the next poll lands —
    // which is why an open popup used to freeze on its tap-time race time, distance
    // and last-update. Resolve the tapped participant against the CURRENT markers on
    // every render instead, so popupState.data now only carries the identity.
    // Resolves to null when the runner drops out of the feed (the memo above filters
    // anyone whose coordinates go to 0,0), which closes the popup rather than leaving
    // a card of indefinitely stale numbers on screen.
    const livePopupParticipant = useMemo(() => {
        if (popupState.type !== 'participant' || !popupState.data) return null;
        // Mapbox round-trips feature properties through the native bridge, which can
        // hand back a numeric string, so compare numerically rather than with ===.
        const tappedId = Number((popupState.data as ParticipantMapMarker).id);
        if (Number.isNaN(tappedId)) return null;
        return participantMarkers.find(m => Number(m.id) === tappedId) ?? null;
    }, [popupState, participantMarkers]);

    // Refresh cadence: speed up to 10s when any tracked runner is within 1km of
    // the finish, so the finish moment is caught promptly; otherwise 60s.
    // ✅ The rule lives in utils/liveMapRequests.liveRefreshMs (tested), which
    // also ignores runners who are offline, finished or silent for 10 min — a
    // runner stopped 500 m from the line held every viewer at 10 s for good
    // (app audit 2026-11-26).
    const refreshMs = useMemo(
        () => liveRefreshMs(participants, routeData?.totalDistance ?? 0, trainingFree),
        [participants, routeData?.totalDistance, trainingFree],
    );

    // ✅ Follower's own position — watched on mount, never written to DB.
    // Uses Balanced accuracy (battery friendly) since precision isn't critical.
    //
    // CHECK, never REQUEST. This used to cold-prompt every map viewer for
    // location just to draw their own "YOU" dot — most viewers are fans, and a
    // fan who said no was later blocked when they raced themselves (the OS asks
    // only once; recovery then needs Settings). The dot still shows for anyone
    // who has already granted location.
    //
    // Also skipped while this phone is tracking a race: Option B (gpsService
    // header) — a second location stream next to Transistor's is exactly what
    // destabilised Hermes under the New Architecture.
    //
    // ✅ Only while the map is on top (app audit 2026-11-26): the watcher kept
    // running under every other screen — one per stacked map.
    useEffect(() => {
        if (!isFocused) return;
        let watcher: Location.LocationSubscription | null = null;
        let cancelled = false;

        const startFollowerLocation = async () => {
            try {
                const { status } = await Location.getForegroundPermissionsAsync();
                if (status !== 'granted') return;
                if (await isTracking()) return;
                if (cancelled) return;
                watcher = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.Balanced,
                        timeInterval: 15000,  // every 15s
                        distanceInterval: 20, // or every 20m moved
                    },
                    (loc) => {
                        setFollowerLocation({
                            lat: loc.coords.latitude,
                            lon: loc.coords.longitude,
                        });
                    }
                );
                // Unmounted while the watcher was being created.
                if (cancelled) watcher.remove();
            } catch (err) {
                console.log('📍 Follower location error (non-fatal):', err);
            }
        };

        startFollowerLocation();
        return () => { cancelled = true; watcher?.remove(); };
    }, [isFocused]);

    // ✅ Initial load with followed users check
    useEffect(() => {
        if (hasLoadedInitialData.current) return;

        const checkAndLoad = () => {
            const usersArray = Array.from(followedUsers);
            console.log('🔍 Checking followed users:', usersArray);

            if (usersArray.length > 0 || eventBibs.length > 0) {
                console.log('✅ Followed users ready:', usersArray, 'bibs:', eventBibs);
                hasLoadedInitialData.current = true;
                loadLiveTrackingData(false);
            }
        };

        const immediateTimer = setTimeout(checkAndLoad, 50);
        const timer1 = setTimeout(checkAndLoad, 150);
        const timer2 = setTimeout(checkAndLoad, 300);

        const finalTimer = setTimeout(() => {
            if (!hasLoadedInitialData.current) {
                console.log('⏱️ Timeout reached, loading anyway');
                hasLoadedInitialData.current = true;
                loadLiveTrackingData(false);
            }
        }, 500);

        return () => {
            clearTimeout(immediateTimer);
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(finalTimer);
        };
    }, [followedUsers, eventBibsKey, product_option_value_app_id]);

    // A runner followed or unfollowed after the first load — by bib or by
    // account, here or on another screen (focus below), or follows that loaded
    // late — shows on the map now instead of at the next 60 s refresh.
    // `loading` is a dep and sentFollowsKey remembers what the last request
    // carried: follows that arrive WHILE a load is in flight are sent as soon as
    // it ends (the effect used to return on `loading` and never re-run).
    // ✅ Only while the map is on top and not inside a 429 pause (second audit
    // 2026-11-26) — like the timer. The next refresh carries the follows anyway.
    useEffect(() => {
        if (!hasLoadedInitialData.current || loading) return;
        if (!isFocused || Date.now() < pausedUntil.current) return;
        if (sentFollowsKey.current === followsKey) return;
        loadLiveTrackingData(true);
    }, [followsKey, loading, isFocused]);

    // Back on this screen (e.g. from Result Details, where a runner was just
    // followed): re-read the follows. useFollowManager only loads them on
    // mount, so the map kept the list it opened with (2026-10-28 review). The
    // first focus is the mount itself, which already loads them.
    const focusedOnce = useRef(false);
    useFocusEffect(
        useCallback(() => {
            if (!focusedOnce.current) { focusedOnce.current = true; return; }
            void refreshFollowedUsers();
        }, [refreshFollowedUsers])
    );

    useEffect(() => {
        if (!hasLoadedInitialData.current || loading) return;
        // ✅ No polling under another screen (app audit 2026-11-26).
        if (!isFocused) return;

        // Back on the map after longer than one refresh period: refresh now
        // rather than showing positions up to 60 s older than the clock says.
        if (lastAppliedAt.current > 0 && Date.now() - lastAppliedAt.current >= refreshMs
            && shouldRunAutoRefresh({ focused: true, autoInFlight: autoInFlight.current, pausedUntil: pausedUntil.current, now: Date.now() })) {
            loadLiveTrackingData(true);
        }

        console.log(`⏰ Setting up ${refreshMs / 1000}s refresh interval`);
        const interval = setInterval(() => {
            // ✅ Skip a tick while the previous auto refresh is still out or a
            // 429 asked us to wait — they used to pile up at the 10 s cadence.
            if (!shouldRunAutoRefresh({ focused: true, autoInFlight: autoInFlight.current, pausedUntil: pausedUntil.current, now: Date.now() })) {
                console.log('⏭️ Auto-refresh skipped (previous still running, or rate limited)');
                return;
            }
            console.log('🔄 Auto-refresh triggered');
            loadLiveTrackingData(true);
        }, refreshMs);

        return () => {
            console.log('🛑 Clearing refresh interval');
            clearInterval(interval);
        };
    // followsKey, not the followedUsers Set: the focus reload makes a new Set every
    // time, which would restart the 60 s countdown on each return to the screen.
    }, [hasLoadedInitialData.current, loading, selectedDistance, followsKey, refreshMs, isFocused]);

    const loadLiveTrackingData = async (autoRefresh: boolean, overrideDistance?: DistanceOption | null) => {
        // Tag this request (utils/liveMapRequests): its answer is only applied
        // when it is still for the distance on screen and nothing newer is shown.
        const seq = ++requestSeq.current;
        let requestedDistanceId: number | null = null;
        const isCurrent = () => isCurrentLiveResponse(
            { seq, distanceId: requestedDistanceId },
            { lastAppliedSeq: lastAppliedSeq.current, wantedDistanceId: wantedDistanceId.current },
        );
        // A dropped answer still clears the spinners when nothing else is loading.
        const dropStale = () => {
            console.log('⏭️ Live tracking answer dropped (older or for another distance)', { seq, requestedDistanceId });
            if (dropClearsLoading(inFlightDistance.current.size - 1)) {
                setLoading(false);
                setParticipantsLoading(false);
            }
        };
        inFlightDistance.current.set(seq, null);
        if (autoRefresh) autoInFlight.current++;
        // ✅ A refresh is FULL (distances, route, elevation) while nothing has
        // been shown yet (second audit 2026-11-26): after a failed first load
        // the auto refresh that succeeded cleared the error but skipped the
        // distances and the GPX — a map with no route, profile or picker.
        const full = isFullLoad(autoRefresh, hasShownData.current);
        try {
            if (!autoRefresh) {
                setLoading(true);
                clearError();
            }

            setParticipantsLoading(true);
            console.log('📡 Fetching live tracking data...', { autoRefresh });

            // ✅ Determine which product_option_value_app_id to use. Before the
            // first await, so a request that fails early is still judged by the
            // distance it was for (catch below).
            const activeDistance = overrideDistance !== undefined ? overrideDistance : selectedDistance;

            let optionValueId: number | undefined;

            if (activeDistance) {
                optionValueId = activeDistance.product_option_value_app_id;
            } else if (product_option_value_app_id && product_option_value_app_id > 0) {
                optionValueId = product_option_value_app_id;
            }
            requestedDistanceId = optionValueId ?? null;
            inFlightDistance.current.set(seq, requestedDistanceId);

            // ✅ Include the logged-in user's own customer ID so they can
            // track themselves on the map, in addition to followed users.
            const selfId = await tokenService.getCustomerId();
            const customerAppIds = selfId
                ? Array.from(new Set([selfId, ...Array.from(followedUsers)]))
                : Array.from(followedUsers);

            console.log('👥 Customer IDs (self + followed):', customerAppIds);

            console.log('📊 Request params:', {
                product_app_id,
                product_option_value_app_id: optionValueId,
                auto_refresh: autoRefresh,
                event_source
            });

            sentFollowsKey.current = followsKey;
            const response = await liveTrackingService.getLiveTrackingData(
                product_app_id,
                customerAppIds,
                optionValueId,
                autoRefresh,
                event_source,
                eventBibs
            );
            if (!isCurrent()) { dropStale(); return; }
            lastAppliedSeq.current = seq;

            console.log('✅ Live tracking data received:', {
                participants: response.data.participants.length,
                distances: response.data.distances?.length || 0,
                selected_distance: response.data.selected_distance || 'N/A',
                separate_checkpoints: response.data.checkpoints?.length || 0,
            });
            if (response.data.participants.length > 0 && response.data.participants[0].checkpoints?.length > 0) {
                console.log('📍 Getting checkpoints from participant');
                const checkpoints: CheckpointData[] = response.data.participants[0].checkpoints.map(cp => ({
                    name: cp.name,
                    distance: safeParseFloat(cp.distance),
                    segment_distance: safeParseFloat(cp.segment_distance),
                    elevation: safeParseFloat(cp.elevation),
                    latitude: cp.latitude,
                    longitude: cp.longitude,
                    accessible_by_car: cp.accessible_by_car,
                    is_start: cp.is_start,
                    is_finish: cp.is_finish,
                    features: cp.features ?? [],
                    description: cp.description ?? '',
                }));
                console.log('📍 Checkpoints from participant:', checkpoints.length);
                setApiCheckpoints(checkpoints);

            } else if (response.data.checkpoints && response.data.checkpoints.length > 0) {
                console.log('📍 Getting checkpoints from separate array (no participants)');
                const checkpoints: CheckpointData[] = response.data.checkpoints.map(cp => ({
                    name: cp.name,
                    distance: safeParseFloat(cp.distance),
                    segment_distance: safeParseFloat(cp.segment_distance),
                    elevation: safeParseFloat(cp.elevation),
                    latitude: cp.latitude,
                    longitude: cp.longitude,
                    accessible_by_car: cp.accessible_by_car,
                    is_start: cp.is_start,
                    is_finish: cp.is_finish,
                    features: cp.features ?? [],
                    description: cp.description ?? '',

                }));
                console.log('📍 Checkpoints from separate array:', checkpoints.length);
                setApiCheckpoints(checkpoints);

            } else {
                console.log('⚠️ No checkpoints found anywhere');
            }
            setParticipants(response.data.participants);

            if (full) {
                console.log('📋 Processing full response (distances + GPX)');

                if (response.data.distances && response.data.distances.length > 0) {
                    setDistances(response.data.distances);

                    if (!activeDistance) {
                        // ✅ Priority 1: match from route params
                        if (selectedDistanceLabel) {
                            const matchedDistance = response.data.distances.find(
                                d => d.distance_name === selectedDistanceLabel
                            );
                            if (matchedDistance) {
                                console.log('✅ Setting distance from route params:', matchedDistance.distance_name);
                                setSelectedDistance(matchedDistance);
                                wantedDistanceId.current = matchedDistance.product_option_value_app_id;
                                // Which distance did this answer really carry? The
                                // bottom tab bar sends id 0 + the label, so the API
                                // answers with ITS default — possibly another
                                // distance than the label's (2026-10-28 review: the
                                // default's runners and route were drawn under the
                                // label's name until a manual switch).
                                const answeredId = response.data.selected_distance?.product_option_value_app_id ?? requestedDistanceId;
                                if (answeredId !== null && answeredId !== matchedDistance.product_option_value_app_id) {
                                    console.log('🔁 Answer was for another distance — loading the labelled one');
                                    void loadLiveTrackingData(false, matchedDistance);
                                    dropStale();   // that load is in flight, so the spinner stays
                                    return;
                                }
                                // This answer IS for that distance: its GPX check
                                // below must not drop it.
                                requestedDistanceId = matchedDistance.product_option_value_app_id;
                                inFlightDistance.current.set(seq, requestedDistanceId);
                            }
                            // ✅ Priority 2: API default
                        } else if (response.data.selected_distance) {
                            const apiSelectedDistance = response.data.distances.find(
                                d => d.product_option_value_app_id === response.data.selected_distance!.product_option_value_app_id
                            );
                            if (apiSelectedDistance) {
                                console.log('✅ Setting distance from API:', apiSelectedDistance.distance_name);
                                setSelectedDistance(apiSelectedDistance);
                                wantedDistanceId.current = apiSelectedDistance.product_option_value_app_id;
                                requestedDistanceId = apiSelectedDistance.product_option_value_app_id;
                                inFlightDistance.current.set(seq, requestedDistanceId);
                            }
                        }
                    }
                }

                console.log('🔍 GPX URL check:', {
                    gpx_url: response.data.selected_distance?.gpx_url,
                    loadedGpxUrl,
                    willLoad: response.data.selected_distance?.gpx_url && loadedGpxUrl !== response.data.selected_distance?.gpx_url
                })
                if (response.data.selected_distance?.gpx_url) {
                    const newGpxUrl = response.data.selected_distance.gpx_url;
                    console.log('✅ Using cached GPX data', newGpxUrl);
                    if (loadedGpxUrl !== newGpxUrl) {
                        console.log('📂 GPX URL changed, loading new GPX');
                        // The GPX download is a second wait: a newer answer
                        // (another distance) may have been shown meanwhile.
                        const applied = await loadGPX(newGpxUrl, isCurrent);
                        if (!applied) { dropStale(); return; }
                        setLoadedGpxUrl(newGpxUrl);
                    } else {
                        console.log('✅ Using cached GPX data');
                    }
                }
            } else {
                console.log('🔄 Auto-refresh: Skipping distances and GPX (using cached data)');
            }

            const canShowResults =
                response?.data?.show_results === 1;

            setRaceDate(response?.data?.product_race_date ?? null);
            setCountdownStatus(response?.data?.countdown?.status ?? null);

            console.log("livetrackingscreen",raceDate );
            
            setShowResults(canShowResults);

            setTrainingFree(response?.data?.training_free === true);

            setLoading(false);
            // ✅ A good answer is on screen: a later failed poll keeps it, and
            // an error screen left by an earlier failure goes (app audit
            // 2026-11-26 — a success used to leave that error up for good).
            hasShownData.current = true;
            lastAppliedAt.current = Date.now();
            setRefreshFailed(false);
            clearError();

            setTimeout(() => {
                console.log('✅ Participants rendering complete');
                // Not while another request (e.g. a follow refresh) still loads:
                // that one ends the spinner itself.
                if (inFlightDistance.current.size === 0) setParticipantsLoading(false);
            }, 200);

        } catch (err) {
            console.error('❌ Error loading live tracking data:', err);
            const others = [...inFlightDistance.current.entries()]
                .filter(([s]) => s !== seq)
                .map(([s, d]) => ({ seq: s, distanceId: d }));
            // Overtaken (a newer answer is on screen) or for a distance the user
            // left: its failure says nothing about the map shown now — never put
            // the error screen over it. Otherwise a newer request still under
            // way owns the screen (and its error).
            if (!isCurrent() || !ownsError(seq, others, wantedDistanceId.current)) {
                if (dropClearsLoading(others.length)) { setLoading(false); setParticipantsLoading(false); }
                return;
            }
            // ✅ 429: wait the server's Retry-After before the next auto refresh.
            if (isRateLimited(err)) pausedUntil.current = Date.now() + rateLimitPauseMs(err);
            // ✅ A failed auto refresh over a map that is already drawn keeps the
            // map (last positions + a "connection problem" banner); the next
            // success clears it. It used to replace the map with the error
            // screen for good (app audit 2026-11-26).
            if (!failureShowsErrorScreen(autoRefresh, hasShownData.current)) {
                setRefreshFailed(true);
                if (dropClearsLoading(others.length)) { setLoading(false); setParticipantsLoading(false); }
                return;
            }
            handleApiError(err);
            setLoading(false);
            setParticipantsLoading(false);

            if (!autoRefresh) {
                Alert.alert(
                    t('common:errors.generic'),
                    t('livetracking:errorLoadingData')
                );
            }
        } finally {
            inFlightDistance.current.delete(seq);
            if (autoRefresh) autoInFlight.current = Math.max(0, autoInFlight.current - 1);
        }
    };

    // Returns false (and changes nothing) when stillCurrent() says the answer
    // that asked for this route is no longer the one on screen.
    const loadGPX = async (gpxUrl: string, stillCurrent: () => boolean = () => true): Promise<boolean> => {
        try {
            console.log('📂 Loading GPX from:', gpxUrl);
            const gpxData = await gpxService.fetchAndParseGPX(gpxUrl);
            console.log('📊 GPX Data loaded:', {
                trackPoints: gpxData.trackPoints.length,
                aidStations: gpxData.aidStations.length,
                totalDistance: gpxData.totalDistance,
                elevation: `${gpxData.minElevation}m - ${gpxData.maxElevation}m`,
            });

            const distances = gpxData.trackPoints.map((_, idx, arr) => {
                if (idx === 0) return 0;
                const prev = arr[idx - 1];
                const curr = arr[idx];
                const R = 6371;
                const dLat = (curr.lat - prev.lat) * Math.PI / 180;
                const dLon = (curr.lon - prev.lon) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(prev.lat * Math.PI / 180) * Math.cos(curr.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            });

            const cumulativeDistances = distances.reduce((acc: number[], dist, idx) => {
                acc.push(idx === 0 ? 0 : acc[idx - 1] + dist);
                return acc;
            }, []);

            const chart = buildChartData(gpxData.trackPoints, cumulativeDistances);

            console.log('📈 Chart data built:', {
                chartDataPoints: chart.length,
                firstPoint: chart[0],
                lastPoint: chart[chart.length - 1],
            });

            if (!stillCurrent()) {
                console.log('⏭️ GPX dropped: another distance is on screen now');
                return false;
            }
            setRouteData(gpxData);
            setChartData(chart);

            console.log('✅ GPX loaded successfully');
            return true;
        } catch (err) {
            console.error('❌ Error loading GPX:', err);
            throw err;
        }
    };

    const handleDistanceChange = async (distance: DistanceOption) => {
        console.log('📊 Distance changed to:', distance.distance_name);

        // Distance name is the RACE distance label ('10K', 'Marathon') — a small
        // fixed set per event, not free text, so it is safe as a parameter.
        void analyticsService.logInteraction(
            liveScreenName,
            ANALYTICS_BUTTONS.DISTANCE_SELECT,
            'select',
            {
                [ANALYTICS_PARAMS.DISTANCE_NAME]: distance.distance_name,
                [ANALYTICS_PARAMS.EVENT_NAME]: event_name,
            },
        );

        const isSameDistance = selectedDistance?.product_option_value_app_id === distance.product_option_value_app_id;

        if (!isSameDistance) {
            setRouteData(null);
            setChartData([]);
            setLoadedGpxUrl(null);
        }

        setSelectedDistance(distance);
        // Synchronously, before any request: an auto refresh still holding the
        // old distance in its closure is dropped from here on.
        wantedDistanceId.current = distance.product_option_value_app_id;
        setLoading(true);
        await loadLiveTrackingData(false, distance);
    };
    // ✅ useCallback (app audit 2026-11-26): LiveElevationProfile is React.memo,
    // but fresh handlers on every render defeated it, so the Victory chart with
    // every GPX point was rebuilt on each location update / spinner toggle.
    const handleParticipantPress = useCallback((participant: ParticipantMapMarker) => {
        void analyticsService.logInteraction(
            liveScreenName,
            ANALYTICS_BUTTONS.MAP_PARTICIPANT,
            'tap',
            { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
        );
        setPopupState({ type: 'participant', data: participant });
    }, [liveScreenName, event_name]);

    const handleAidStationPress = useCallback((station: AidStationMapMarker) => {
        console.log('🔍 aid station pressed:', station);
        void analyticsService.logInteraction(
            liveScreenName,
            ANALYTICS_BUTTONS.MAP_AID_STATION,
            'tap',
            { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
        );
        setPopupState({ type: 'aidstation', data: station });
    }, [liveScreenName, event_name]);

    const handleClosePopup = () => {
        setPopupState({ type: null, data: null });
    };

    // ✅ The tab bar can bring this map back (pop) with another distance label
    // (re-audit 2026-11-26): Map → Results → pick another distance → Map. The
    // label was only read on the first load, so the map kept the old distance.
    // React to a CHANGE of the param only — a distance picked here in the map
    // (dropdown) must not be undone by the unchanged param.
    const lastLabelParam = useRef(selectedDistanceLabel);
    useEffect(() => {
        if (lastLabelParam.current === selectedDistanceLabel) return;
        lastLabelParam.current = selectedDistanceLabel;
        if (!selectedDistanceLabel || distances.length === 0) return;
        const wanted = distances.find(d => d.distance_name === selectedDistanceLabel);
        if (wanted && wanted.product_option_value_app_id !== selectedDistance?.product_option_value_app_id) {
            void handleDistanceChange(wanted);
        }
    }, [selectedDistanceLabel, distances]);

    // ✅ The route param follows the distance SHOWN (second audit 2026-11-26):
    // the tab bar decides whether to switch the map by comparing the distance
    // the list asks for with this param — it used to be the label the map was
    // OPENED with, not the one picked here in the map since.
    useEffect(() => {
        const shown = selectedDistance?.distance_name;
        if (!shown || shown === selectedDistanceLabel) return;
        lastLabelParam.current = shown;   // our own update: the effect above ignores it
        navigation.setParams({ selectedDistanceLabel: shown });
    }, [selectedDistance?.distance_name]);

    // ✅ Opened again for ANOTHER event while this map is on top (a push tap, a
    // popup "View" — navigate() then only replaces the params of this route;
    // pre-existing, second audit 2026-11-26): its state belongs to the old
    // event, so a fresh map replaces it. The same event with another distance
    // id switches distance here.
    const openedFor = useRef({ product_app_id, event_source, product_option_value_app_id });
    useEffect(() => {
        const o = openedFor.current;
        if (String(o.product_app_id) !== String(product_app_id) || (o.event_source ?? 'partner') !== (event_source ?? 'partner')) {
            openedFor.current = { product_app_id, event_source, product_option_value_app_id };
            navigation.replace('LiveTracking', route.params);
            return;
        }
        if (Number(o.product_option_value_app_id || 0) !== Number(product_option_value_app_id || 0)) {
            openedFor.current = { ...o, product_option_value_app_id };
            const wanted = distances.find(d => d.product_option_value_app_id === Number(product_option_value_app_id));
            if (wanted && wanted.product_option_value_app_id !== selectedDistance?.product_option_value_app_id) {
                void handleDistanceChange(wanted);
            }
        }
    }, [product_app_id, event_source, product_option_value_app_id]);

    const hasGpx = !!routeData;
    const hasCheckpoints = apiCheckpoints != null && apiCheckpoints.length > 0;
    const showRouteLine = hasGpx;
    const showCheckpoints = hasGpx && hasCheckpoints;
    // ✅ Panel geometry from the measured map area (see mapAreaHeight): never
    // taller than the area minus room for the collapse button above it, and
    // at most 60% of it in landscape. Below MIN_PANEL there is no useful chart,
    // so the panel and its toggle are hidden (landscape on a phone) - the
    // profile comes back in portrait.
    const MIN_PANEL = 72;
    const COLLAPSE_BTN_ROOM = 56;   // 40pt button + 8 gap + 8 margin
    const panelHeight = mapAreaHeight > 0
        ? Math.floor(Math.min(
            ELEVATION_PANEL_HEIGHT,
            mapAreaHeight - COLLAPSE_BTN_ROOM,
            isLandscape ? mapAreaHeight * 0.6 : ELEVATION_PANEL_HEIGHT,
        ))
        : ELEVATION_PANEL_HEIGHT;
    const showElevationProfile = hasGpx && panelHeight >= MIN_PANEL;
    const popupOpen = popupState.type !== null;
    // Relative to the panel's top, always inside the map container.
    const collapseBtnBottom = profileCollapsed ? 16 : panelHeight + 8;
    const hasValidCoords = participantMarkers.some(p => p.lat !== 0 && p.lon !== 0);
    // GPS-tracked events (custom, or partner with RR off) show the map as soon as a
    // route exists, even before anyone has a fix — there's no results view to fall
    // back to. RR events wait for coordinates.
    const showParticipants = !isRrActive ? (hasGpx || hasValidCoords) : hasValidCoords;
    // Distances come from oc_product_option_value_app, which partner events have
    // regardless of RR status — so this stays keyed on isCustomEvent.
    const showDistanceDropdown = !isCustomEvent;
    const showBottomNav = !isCustomEvent;

    console.log('🔍 Visibility flags:', {
        isCustomEvent, hasGpx, hasCheckpoints,
        showRouteLine, showCheckpoints, showElevationProfile, showParticipants,
    });

    console.log('🔍 Map props:', {
        showCheckpoints,
        aidStationsLength: routeData?.aidStations?.length ?? 0,
        apiCheckpointsLength: apiCheckpoints.length,
        trackPointsLength: routeData?.trackPoints?.length ?? 0,
    });

    if (loading) {
        return (
            <View style={commonStyles.centerContainer}>
                <ActivityIndicator size="large" color={palette.navy} />
                <Text style={commonStyles.loadingText}>{t('livetracking:loadingData')}</Text>
            </View>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={safeEdges}>
                <AppHeader title={event_name} showLogo={true} showBack />
                <ErrorScreen
                    type={error!.type}
                    title={error!.title}
                    message={error!.message}
                    onRetry={() => { clearError(); loadLiveTrackingData(false); }}
                />
            </SafeAreaView>
        );
    }

    // Handle no data separately — no error object needed
    if (isRrActive && !selectedDistance && !hasValidCoords) {
        return (
            <SafeAreaView style={commonStyles.container} edges={safeEdges}>
                <AppHeader title={event_name} showLogo={true} showBack />
                <ErrorScreen
                    type="empty"
                    onRetry={() => loadLiveTrackingData(false)}
                />
            </SafeAreaView>
        );
    }

    // ✅ Landscape (device test 2026-10-23): the popups sat inside the map area,
    // ~170pt under the header, distance selector and bottom bar — the card was
    // a thin scrolling strip with the close button at its edge. In landscape they
    // cover the whole screen (centred, clear of the notch / status bar / home
    // indicator); in portrait they stay over the map, as before.
    const mapPopups = (
        <>
            {popupState.type === 'participant' && livePopupParticipant && (
                <ParticipantPopup
                    participant={livePopupParticipant}
                    event_source={event_source}
                    isRrActive={isRrActive}
                    onClose={handleClosePopup}
                    fullScreen={isLandscape}
                />
            )}

            {popupState.type === 'aidstation' && popupState.data && (
                <AidStationPopup
                    station={popupState.data as AidStationMapMarker}
                    onClose={handleClosePopup}
                    fullScreen={isLandscape}
                />
            )}
        </>
    );

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['left', 'right'] : ['bottom']}>
            <AppHeader title={event_name} showLogo={true} showBack />
            <View style={[{ flex: 1 }, sidePadding]}>
            {/* A custom event has no distances, so no dropdown to carry the
                status pill - it gets the same header row on its own. */}
            {!showDistanceDropdown && (
                <View style={liveTrackingStyles.dropdownContainer}>
                    <View style={liveTrackingStyles.mapHeadRow}>
                        <Text style={liveTrackingStyles.mapHeadTitle}>
                            {t('livetracking:liveMap')}
                        </Text>
                        <RaceStatePill raceState={raceState} />
                    </View>
                </View>
            )}

            {showDistanceDropdown && selectedDistance && (
                <DistanceDropdown
                    distances={distances}
                    selectedDistance={selectedDistance}
                    onSelect={handleDistanceChange}
                    raceState={raceState}
                />
            )}
            {/* ✅ A failed auto refresh keeps the map (app audit 2026-11-26):
                say the positions are the last known ones instead of hiding
                the whole map behind the error screen. Cleared by the next
                good answer.
                ✅ A strip ABOVE the map, not floating on it (UI check
                2026-11-26): as an overlay (top 8, 56pt sides, elevation 20) it
                was painted over the open runner / checkpoint popup on Android
                portrait (elevation beats the popup's zIndex), covered the top
                of the elevation panel on a short map, and its 2-line cap cut
                the text ("…") at 320-393pt in fr / nl and at larger text. Here
                the map area shrinks by its height (panelHeight follows via
                onLayout) and it sits inside sidePadding, clear of the notch. */}
            {refreshFailed && (
                <View
                    pointerEvents="none"
                    style={{
                        backgroundColor: palette.ink, borderRadius: 8,
                        paddingVertical: 4, paddingHorizontal: 10,
                        marginHorizontal: space.xl, marginVertical: 6,   // the head row's 20pt gutter
                    }}
                >
                    <Text style={{ color: palette.surface, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, textAlign: 'center' }} numberOfLines={3}>
                        {t('livetracking:refreshFailed')}
                    </Text>
                </View>
            )}
            <View
                style={{ flex: 1 }}
                onLayout={(e) => setMapAreaHeight(Math.round(e.nativeEvent.layout.height))}
            >

                <View style={liveTrackingStyles.mapContainer}>
                    <LiveRouteMap
                        trackPoints={showRouteLine ? (routeData?.trackPoints ?? []) : []}
                        aidStations={showCheckpoints ? (routeData?.aidStations ?? []) : []}
                        participants={showParticipants ? participantMarkers : []}
                        apiCheckpoints={showCheckpoints ? apiCheckpoints : []}
                        onAidStationPress={handleAidStationPress}
                        onParticipantPress={handleParticipantPress}
                        isLoadingParticipants={participantsLoading}
                        followerLocation={followerLocation}
                    />
                </View>

                {showElevationProfile && !profileCollapsed && (
                    <View
                        style={[
                            liveTrackingStyles.chartContainer,
                            {
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: panelHeight,   // capped to the map area (see panelHeight)
                                backgroundColor: 'transparent',
                                // 0 while a popup is open: Android draws by elevation
                                // before zIndex, so the panel (5) and the chevron (10)
                                // were painted over the portrait popup (audit 2026-10-23).
                                elevation: popupOpen ? 0 : 5,
                            },
                        ]}
                        pointerEvents="box-none"
                    >
                        <LiveElevationProfile
                            chartData={chartData}
                            aidStations={showCheckpoints ? (routeData?.aidStations ?? NO_AID_STATIONS) : NO_AID_STATIONS}
                            apiCheckpoints={showCheckpoints ? apiCheckpoints : NO_CHECKPOINTS}
                            participants={showParticipants ? participantMarkers : NO_MARKERS}
                            trainingFree={trainingFree}
                            totalDistance={routeData?.totalDistance ?? 0}
                            minElevation={routeData?.minElevation ?? 0}
                            maxElevation={routeData?.maxElevation ?? 0}
                            elevationGain={routeData?.elevationGain ?? 0}
                            onAidStationPress={handleAidStationPress}
                            onParticipantPress={handleParticipantPress}
                            panelHeight={panelHeight}
                        />
                    </View>
                )}

                {showElevationProfile && (
                    <TouchableOpacity
                        style={[
                            liveTrackingStyles.collapseBtn,
                            {
                                bottom: collapseBtnBottom,
                                
                                zIndex: 10, elevation: popupOpen ? 0 : 10
                            },   // just above the panel's top (or near the bottom when collapsed)
                        ]}
                        onPress={() => {
                            void analyticsService.logInteraction(
                                liveScreenName,
                                ANALYTICS_BUTTONS.ELEVATION_TOGGLE,
                                profileCollapsed ? 'expand' : 'collapse',
                                { [ANALYTICS_PARAMS.EVENT_NAME]: event_name },
                            );
                            setProfileCollapsed(!profileCollapsed);
                        }}
                    >
                        <Ionicons
                            name={profileCollapsed ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color={palette.ink}
                        />
                    </TouchableOpacity>
                )}

                {!isLandscape && mapPopups}

            </View>
            </View>

            {showBottomNav && (
                sectionType === 'follower' ? (
                    <BottomNavigationFollower
                        activeTab="Map"
                        product_app_id={product_app_id}
                        event_name={event_name}
                        event_image={event_image}
                        product_option_value_app_id={product_option_value_app_id}
                        sourceTab={sourceTab}
                        showResults={showResults}
                        race_date={raceDate}
                    />
                ) : (
                    <BottomNavigation
                        activeTab="Map"
                        product_app_id={product_app_id}
                        event_name={event_name}
                        event_image={event_image}
                        product_option_value_app_id={product_option_value_app_id}
                        sourceScreen={sourceScreen}
                        showResults={showResults}
                        race_date={raceDate}
                    />
                )
            )}

            {/* last child: above the header and the bottom bar */}
            {isLandscape && mapPopups}
        </SafeAreaView>
    );
};

export default LiveTrackingScreen;