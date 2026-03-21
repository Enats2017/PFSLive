import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ActivityIndicator, StatusBar, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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

const safeParseFloat = (value: any): number => {
    if (value === null || value === undefined) return 0;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
};

const LiveTrackingScreen: React.FC<LiveTrackingScreenProps> = ({ route, navigation }) => {
    const { t } = useTranslation(['livetracking', 'common']);
    const { product_app_id, product_option_value_app_id, event_name, sourceScreen, sectionType, sourceTab } = route.params;

    const { followedUsers } = useFollowManager(t);

    const [routeData, setRouteData] = useState<GPXRouteData | null>(null);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [participants, setParticipants] = useState<LiveTrackingParticipant[]>([]);
    const [distances, setDistances] = useState<DistanceOption[]>([]);
    const [selectedDistance, setSelectedDistance] = useState<DistanceOption | null>(null);
    const [apiCheckpoints, setApiCheckpoints] = useState<CheckpointData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [popupState, setPopupState] = useState<PopupState>({ type: null, data: null });
    const [profileCollapsed, setProfileCollapsed] = useState(false);
    const [participantsLoading, setParticipantsLoading] = useState(false);
    const [loadedGpxUrl, setLoadedGpxUrl] = useState<string | null>(null);
    
    const hasLoadedInitialData = useRef(false);

    const participantMarkers: ParticipantMapMarker[] = useMemo(() => {
        return participants.map(p => {
            const firstInitial = p.firstname?.charAt(0).toUpperCase() || '';
            const lastInitial = p.lastname?.charAt(0).toUpperCase() || '';
            const initials = p.source === 'partner_event' 
                ? p.bib_number.toString() 
                : `${firstInitial}${lastInitial}`;

            return {
                id: p.participant_app_id,
                customer_app_id: p.customer_app_id,
                bib: p.bib_number,
                name: `${p.firstname || ''} ${p.lastname || ''}`.trim() || 'Unknown',
                initials,
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
                source: p.source,
            };
        });
    }, [participants]);

    useEffect(() => {
        if (hasLoadedInitialData.current) return;

        const checkAndLoad = () => {
            const usersArray = Array.from(followedUsers);
            console.log('🔍 Checking followed users:', usersArray);

            if (usersArray.length > 0) {
                console.log('✅ Followed users ready:', usersArray);
                hasLoadedInitialData.current = true;
                loadLiveTrackingData();
            }
        };

        const immediateTimer = setTimeout(checkAndLoad, 50);
        const timer1 = setTimeout(checkAndLoad, 150);
        const timer2 = setTimeout(checkAndLoad, 300);
        
        const finalTimer = setTimeout(() => {
            if (!hasLoadedInitialData.current) {
                console.log('⏱️ Timeout reached, loading anyway');
                hasLoadedInitialData.current = true;
                loadLiveTrackingData();
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

        console.log('⏰ Setting up 60-second refresh interval');
        const interval = setInterval(() => {
            console.log('🔄 Auto-refresh triggered');
            loadLiveTrackingData(true);
        }, 60000);

        return () => {
            console.log('🛑 Clearing refresh interval');
            clearInterval(interval);
        };
    }, [hasLoadedInitialData.current, loading, selectedDistance, followedUsers]);

    const loadLiveTrackingData = async (silent = false) => {
        try {
            if (!silent) {
                setLoading(true);
                setError(null);
            }

            setParticipantsLoading(true);
            console.log('📡 Fetching live tracking data...');

            const customerAppIds = Array.from(followedUsers);
            console.log('👥 Followed users:', customerAppIds);

            // ✅ Determine which product_option_value_app_id to use
            let optionValueId: number | undefined;
            
            if (selectedDistance) {
                // Use selected distance
                optionValueId = selectedDistance.product_option_value_app_id;
            } else if (product_option_value_app_id && product_option_value_app_id > 0) {
                // Use route param if valid
                optionValueId = product_option_value_app_id;
            }
            // Otherwise, undefined - API will return first distance by sort order

            console.log('📊 Request params:', {
                product_app_id,
                product_option_value_app_id: optionValueId,
            });

            const response = await liveTrackingService.getLiveTrackingData(
                product_app_id,
                customerAppIds,
                2,
                optionValueId
            );

            console.log('✅ Live tracking data received:', {
                participants: response.data.participants.length,
                distances: response.data.distances.length,
                selected_distance: response.data.selected_distance,
            });

            if (response.data.participants.length > 0) {
                console.log('👤 First participant:', {
                    bib: response.data.participants[0].bib_number,
                    name: `${response.data.participants[0].firstname} ${response.data.participants[0].lastname}`,
                    lat: response.data.participants[0].latitude,
                    lon: response.data.participants[0].longitude,
                    checkpoints: response.data.participants[0].checkpoints?.length || 0,
                });

                // ✅ Extract checkpoint data from first participant
                if (response.data.participants[0].checkpoints) {
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
                    }));
                    
                    console.log('📍 API Checkpoints:', checkpoints.map(c => ({ 
                        name: c.name, 
                        distance: c.distance,
                        segment: c.segment_distance 
                    })));
                    
                    setApiCheckpoints(checkpoints);
                }
            } else {
                console.log('⚠️ No participants in response');
                setApiCheckpoints([]);
            }

            setDistances(response.data.distances);

            // ✅ Set selected distance from API response
            if (!selectedDistance) {
                const apiSelectedDistance = response.data.distances.find(
                    d => d.product_option_value_app_id === response.data.selected_distance.product_option_value_app_id
                );
                
                if (apiSelectedDistance) {
                    console.log('✅ Setting selected distance:', apiSelectedDistance.distance_name);
                    setSelectedDistance(apiSelectedDistance);
                }
            }

            setParticipants(response.data.participants);

            const newGpxUrl = response.data.selected_distance.gpx_url;
            if (loadedGpxUrl !== newGpxUrl) {
                console.log('📂 GPX URL changed, loading new GPX');
                await loadGPX(newGpxUrl);
                setLoadedGpxUrl(newGpxUrl);
            } else {
                console.log('✅ Using cached GPX data');
            }

            setLoading(false);
            
            setTimeout(() => {
                console.log('✅ Participants rendering complete');
                setParticipantsLoading(false);
            }, 200);

        } catch (err) {
            console.error('❌ Error loading live tracking data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load tracking data');
            setLoading(false);
            setParticipantsLoading(false);
            
            if (!silent) {
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
        setSelectedDistance(distance);
        setLoading(true);
        setLoadedGpxUrl(null);
        await loadLiveTrackingData();
    };

    const handleParticipantPress = (participant: ParticipantMapMarker) => {
        setPopupState({ type: 'participant', data: participant });
    };

    const handleAidStationPress = (station: AidStationMapMarker) => {
        setPopupState({ type: 'aidstation', data: station });
    };

    const handleClosePopup = () => {
        setPopupState({ type: null, data: null });
    };

    if (loading) {
        return (
            <View style={commonStyles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={commonStyles.loadingText}>{t('livetracking:loadingData')}</Text>
            </View>
        );
    }

    if (error || !routeData || !selectedDistance) {
        return (
            <View style={commonStyles.centerContainer}>
                <Text style={commonStyles.errorText}>
                    {error || t('livetracking:errorLoadingData')}
                </Text>
                <TouchableOpacity
                    style={commonStyles.primaryButton}
                    onPress={() => loadLiveTrackingData()}
                >
                    <Text style={commonStyles.primaryButtonText}>
                        {t('common:buttons.retry')}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" />

            <AppHeader title={event_name} showLogo={true} />

            <DistanceDropdown
                distances={distances}
                selectedDistance={selectedDistance}
                onSelect={handleDistanceChange}
            />

            <View style={liveTrackingStyles.mapContainer}>
                <LiveRouteMap
                    trackPoints={routeData.trackPoints}
                    aidStations={routeData.aidStations}
                    participants={participantMarkers}
                    apiCheckpoints={apiCheckpoints}
                    onAidStationPress={handleAidStationPress}
                    onParticipantPress={handleParticipantPress}
                    isLoadingParticipants={participantsLoading}
                />
            </View>

            {!profileCollapsed && (
                <View style={liveTrackingStyles.chartContainer}>
                    <LiveElevationProfile
                        chartData={chartData}
                        aidStations={routeData.aidStations}
                        apiCheckpoints={apiCheckpoints}
                        participants={participantMarkers}
                        totalDistance={routeData.totalDistance}
                        minElevation={routeData.minElevation}
                        maxElevation={routeData.maxElevation}
                        onAidStationPress={handleAidStationPress}
                    />
                </View>
            )}

            <TouchableOpacity
                style={liveTrackingStyles.collapseBtn}
                onPress={() => setProfileCollapsed(!profileCollapsed)}
            >
                <Ionicons
                    name={profileCollapsed ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color={colors.gray900}
                />
            </TouchableOpacity>

            {popupState.type === 'participant' && popupState.data && (
                <ParticipantPopup
                    participant={popupState.data as ParticipantMapMarker}
                    onClose={handleClosePopup}
                />
            )}

            {popupState.type === 'aidstation' && popupState.data && (
                <AidStationPopup
                    station={popupState.data as AidStationMapMarker}
                    onClose={handleClosePopup}
                />
            )}

            {sectionType === 'follower' ? (
                <BottomNavigationFollower
                    activeTab="Map"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceTab={sourceTab}
                />
            ) : (
                <BottomNavigation
                    activeTab="Map"
                    product_app_id={product_app_id}
                    event_name={event_name}
                    product_option_value_app_id={product_option_value_app_id}
                    sourceScreen={sourceScreen}
                />
            )}
        </SafeAreaView>
    );
};

export default LiveTrackingScreen;