import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, StatusBar, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../components/common/AppHeader';
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
import { commonStyles, colors } from '../styles/common.styles';
import { liveTrackingStyles } from '../styles/liveTracking.styles';
import { ChartDataPoint } from '../types';
import ErrorScreen from '../components/ErrorScreen';
import { useScreenError } from '../hooks/useApiError';
import { tokenService } from '../services/tokenService';
import * as Location from 'expo-location';
import { useDimensions } from '../hooks/useDimensions';
import { analyticsService } from '../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../constants/analyticsScreens';

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
    const TAB_BAR_HEIGHT = 87;
    const isGestureNav = insets.bottom > 0;
    const profileBottom = TAB_BAR_HEIGHT + insets.bottom;
    const collapseBtnBottom = profileBottom + 100;
    const isCustomEvent = event_source === 'custom';
    const { followedUsers } = useFollowManager(t);
    const [routeData, setRouteData] = useState<GPXRouteData | null>(null);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [participants, setParticipants] = useState<LiveTrackingParticipant[]>([]);
    const [distances, setDistances] = useState<DistanceOption[]>([]);
    const [selectedDistance, setSelectedDistance] = useState<DistanceOption | null>(null);
    const [apiCheckpoints, setApiCheckpoints] = useState<CheckpointData[]>([]);
    const [loading, setLoading] = useState(true);
    //const [error, setError] = useState<string | null>(null);
    const [popupState, setPopupState] = useState<PopupState>({ type: null, data: null });
    const [profileCollapsed, setProfileCollapsed] = useState(false);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [loadedGpxUrl, setLoadedGpxUrl] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [raceDate, setRaceDate] = useState<string | null>(null);
    const isRrActive = !isCustomEvent && showResults;
    const [trainingFree, setTrainingFree] = useState(false);
    

    // ✅ Follower's own device location — plotted directly from GPS,
    // never stored to DB (follower is watching, not racing).
    const [followerLocation, setFollowerLocation] = useState<{ lat: number; lon: number } | null>(null);

    const hasLoadedInitialData = useRef(false);
    const { error, hasError, handleApiError, clearError } = useScreenError();

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
    const FINISH_APPROACH_KM = 1.0;
    const NORMAL_REFRESH_MS = 60000;
    const FAST_REFRESH_MS = 10000;

    const refreshMs = useMemo(() => {
        const total = routeData?.totalDistance ?? 0;

        const nearFinish = participants.some(p => {
            // Prefer the stored distance-to-finish from the API; fall back to
            // total − covered only when it's absent (e.g. an RR-only partner
            // runner with no stored GPS fix).
            let remaining: number | null =
                p.distance_to_finish_km != null ? safeParseFloat(p.distance_to_finish_km) : null;

            if (remaining == null) {
                // Training: there is no "remaining". total is the reference GPX
                // length and covered is an odometer, so total − covered is
                // meaningless — and lands in the 0-1km fast-refresh band exactly
                // when the session passes the GPX length.
                if (trainingFree) return false;
                if (total <= 0) return false;
                const covered = safeParseFloat(p.distance_covered_km);
                if (covered <= 0) return false;
                remaining = total - covered;
            }

            // 0 < remaining < 1km → final approach. Negative (mid-race overlap on a
            // looping route) and 0 (finished) both correctly stay at normal cadence.
            return remaining > 0 && remaining < FINISH_APPROACH_KM;
        },);

        return nearFinish ? FAST_REFRESH_MS : NORMAL_REFRESH_MS;
    }, [participants, routeData?.totalDistance, trainingFree]);

    // ✅ Follower's own position — watched on mount, never written to DB.
    // Uses Balanced accuracy (battery friendly) since precision isn't critical.
    useEffect(() => {
        let watcher: Location.LocationSubscription | null = null;

        const startFollowerLocation = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
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
            } catch (err) {
                console.log('📍 Follower location error (non-fatal):', err);
            }
        };

        startFollowerLocation();
        return () => { watcher?.remove(); };
    }, []);

    // ✅ Initial load with followed users check
    useEffect(() => {
        if (hasLoadedInitialData.current) return;

        const checkAndLoad = () => {
            const usersArray = Array.from(followedUsers);
            console.log('🔍 Checking followed users:', usersArray);

            if (usersArray.length > 0) {
                console.log('✅ Followed users ready:', usersArray);
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
    }, [followedUsers, product_option_value_app_id]);

    useEffect(() => {
        if (!hasLoadedInitialData.current || loading) return;

        console.log(`⏰ Setting up ${refreshMs / 1000}s refresh interval`);
        const interval = setInterval(() => {
            console.log('🔄 Auto-refresh triggered');
            loadLiveTrackingData(true);
        }, refreshMs);

        return () => {
            console.log('🛑 Clearing refresh interval');
            clearInterval(interval);
        };
    }, [hasLoadedInitialData.current, loading, selectedDistance, followedUsers, refreshMs]);

    const loadLiveTrackingData = async (autoRefresh: boolean, overrideDistance?: DistanceOption | null) => {
        try {
            if (!autoRefresh) {
                setLoading(true);
                clearError();
            }

            setParticipantsLoading(true);
            console.log('📡 Fetching live tracking data...', { autoRefresh });

            // ✅ Include the logged-in user's own customer ID so they can
            // track themselves on the map, in addition to followed users.
            const selfId = await tokenService.getCustomerId();
            const customerAppIds = selfId
                ? Array.from(new Set([selfId, ...Array.from(followedUsers)]))
                : Array.from(followedUsers);

            console.log('👥 Customer IDs (self + followed):', customerAppIds);

            // ✅ Determine which product_option_value_app_id to use
            const activeDistance = overrideDistance !== undefined ? overrideDistance : selectedDistance;

            let optionValueId: number | undefined;

            if (activeDistance) {
                optionValueId = activeDistance.product_option_value_app_id;
            } else if (product_option_value_app_id && product_option_value_app_id > 0) {
                optionValueId = product_option_value_app_id;
            }

            console.log('📊 Request params:', {
                product_app_id,
                product_option_value_app_id: optionValueId,
                auto_refresh: autoRefresh,
                event_source
            });

            const response = await liveTrackingService.getLiveTrackingData(
                product_app_id,
                customerAppIds,
                optionValueId,
                autoRefresh,
                event_source
            );

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

            if (!autoRefresh) {
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
                            }
                            // ✅ Priority 2: API default
                        } else if (response.data.selected_distance) {
                            const apiSelectedDistance = response.data.distances.find(
                                d => d.product_option_value_app_id === response.data.selected_distance!.product_option_value_app_id
                            );
                            if (apiSelectedDistance) {
                                console.log('✅ Setting distance from API:', apiSelectedDistance.distance_name);
                                setSelectedDistance(apiSelectedDistance);
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
                        await loadGPX(newGpxUrl);
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

            console.log("livetrackingscreen",raceDate );
            
            setShowResults(canShowResults);

            setTrainingFree(response?.data?.training_free === true);

            setLoading(false);

            setTimeout(() => {
                console.log('✅ Participants rendering complete');
                setParticipantsLoading(false);
            }, 200);

        } catch (err) {
            console.error('❌ Error loading live tracking data:', err);
            handleApiError(err);
            setLoading(false);
            setParticipantsLoading(false);

            if (!autoRefresh) {
                Alert.alert(
                    t('common:errors.generic'),
                    t('livetracking:errorLoadingData')
                );
            }
        }
    };

    const loadGPX = async (gpxUrl: string) => {
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

            setRouteData(gpxData);
            setChartData(chart);

            console.log('✅ GPX loaded successfully');
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
            { distance_name: distance.distance_name },
        );

        const isSameDistance = selectedDistance?.product_option_value_app_id === distance.product_option_value_app_id;

        if (!isSameDistance) {
            setRouteData(null);
            setChartData([]);
            setLoadedGpxUrl(null);
        }

        setSelectedDistance(distance);
        setLoading(true);
        await loadLiveTrackingData(false, distance);
    };
    const handleParticipantPress = (participant: ParticipantMapMarker) => {
        void analyticsService.logInteraction(
            liveScreenName,
            ANALYTICS_BUTTONS.MAP_PARTICIPANT,
            'tap',
        );
        setPopupState({ type: 'participant', data: participant });
    };

    const handleAidStationPress = (station: AidStationMapMarker) => {
        console.log('🔍 aid station pressed:', station);
        void analyticsService.logInteraction(
            liveScreenName,
            ANALYTICS_BUTTONS.MAP_AID_STATION,
            'tap',
        );
        setPopupState({ type: 'aidstation', data: station });
    };

    const handleClosePopup = () => {
        setPopupState({ type: null, data: null });
    };

    const hasGpx = !!routeData;
    const hasCheckpoints = apiCheckpoints != null && apiCheckpoints.length > 0;
    const showRouteLine = hasGpx;
    const showCheckpoints = hasGpx && hasCheckpoints;
    const showElevationProfile = hasGpx;
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
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={commonStyles.loadingText}>{t('livetracking:loadingData')}</Text>
            </View>
        );
    }

    if (hasError && !loading) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
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
            <SafeAreaView style={commonStyles.container} edges={['top']}>
                <StatusBar barStyle="dark-content" />
                <AppHeader title={event_name} showLogo={true} showBack />
                <ErrorScreen
                    type="empty"
                    onRetry={() => loadLiveTrackingData(false)}
                />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={isLandscape && !isGestureNav ? ['top', 'left', 'right'] : ['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />
            <AppHeader title={event_name} showLogo={true} showBack />
            {showDistanceDropdown && selectedDistance && (
                <DistanceDropdown
                    distances={distances}
                    selectedDistance={selectedDistance}
                    onSelect={handleDistanceChange}
                />
            )}
            <View style={{ flex: 1 }}>

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
                                backgroundColor: 'transparent',
                                elevation: 5,
                            },
                        ]}
                        pointerEvents="box-none"
                    >
                        <LiveElevationProfile
                            chartData={chartData}
                            aidStations={showCheckpoints ? (routeData?.aidStations ?? []) : []}
                            apiCheckpoints={showCheckpoints ? apiCheckpoints : []}
                            participants={showParticipants ? participantMarkers : []}
                            trainingFree={trainingFree}
                            totalDistance={routeData?.totalDistance ?? 0}
                            minElevation={routeData?.minElevation ?? 0}
                            maxElevation={routeData?.maxElevation ?? 0}
                            onAidStationPress={handleAidStationPress}
                            onParticipantPress={handleParticipantPress}
                        />
                    </View>
                )}

                {showElevationProfile && (
                    <TouchableOpacity
                        style={[
                            liveTrackingStyles.collapseBtn,
                            {
                                bottom: collapseBtnBottom,
                                
                                zIndex: 10, elevation: 10
                            },   // follow the bottom:0 profile + sit above the overlay
                        ]}
                        onPress={() => {
                            void analyticsService.logInteraction(
                                liveScreenName,
                                ANALYTICS_BUTTONS.ELEVATION_TOGGLE,
                                profileCollapsed ? 'expand' : 'collapse',
                            );
                            setProfileCollapsed(!profileCollapsed);
                        }}
                    >
                        <Ionicons
                            name={profileCollapsed ? 'chevron-up' : 'chevron-down'}
                            size={24}
                            color={colors.gray900}
                        />
                    </TouchableOpacity>
                )}

                {popupState.type === 'participant' && livePopupParticipant && (
                    <ParticipantPopup
                        participant={livePopupParticipant}
                        event_source={event_source}
                        isRrActive={isRrActive}
                        onClose={handleClosePopup}
                    />
                )}

                {popupState.type === 'aidstation' && popupState.data && (
                    <AidStationPopup
                        station={popupState.data as AidStationMapMarker}
                        onClose={handleClosePopup}
                    />
                )}

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
        </SafeAreaView>
    );
};

export default LiveTrackingScreen;