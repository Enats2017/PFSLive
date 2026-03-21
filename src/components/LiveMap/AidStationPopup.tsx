import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AidStationMapMarker } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

interface AidStationPopupProps {
    station: AidStationMapMarker;
    onClose: () => void;
}

export const AidStationPopup: React.FC<AidStationPopupProps> = ({
    station,
    onClose,
}) => {
    const { t } = useTranslation(['livetracking', 'common']);

    const openDirections = async () => {
        const lat = station.lat;
        const lon = station.lon;

        const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;

        if (Platform.OS === 'ios') {
            Alert.alert(
                t('livetracking:openDirections'),
                t('livetracking:chooseMapApp'),
                [
                    {
                        text: 'Apple Maps',
                        onPress: () => Linking.openURL(appleMapsUrl),
                    },
                    {
                        text: 'Google Maps',
                        onPress: () => Linking.openURL(googleMapsUrl),
                    },
                    {
                        text: t('common:buttons.cancel'),
                        style: 'cancel',
                    },
                ]
            );
        } else {
            Linking.openURL(googleMapsUrl);
        }
    };

    return (
        <View style={liveTrackingStyles.popupOverlay}>
            <View style={liveTrackingStyles.popup}>
                <TouchableOpacity style={liveTrackingStyles.popupCloseBtn} onPress={onClose}>
                    <Ionicons name="close" size={24} color={colors.gray600} />
                </TouchableOpacity>

                <View style={liveTrackingStyles.aidStationHeader}>
                    <View style={liveTrackingStyles.aidStationIconCircle}>
                        <Ionicons name="restaurant" size={24} color={colors.white} />
                    </View>
                    <View style={liveTrackingStyles.aidStationHeaderText}>
                        <Text style={liveTrackingStyles.aidStationName}>
                            {station.name || 'Aid Station'}
                        </Text>
                        <Text style={liveTrackingStyles.aidStationSubtitle}>
                            {t('livetracking:aidStation')}
                        </Text>
                    </View>
                </View>

                <View style={liveTrackingStyles.popupSection}>
                    <View style={liveTrackingStyles.aidStationInfoRow}>
                        <Ionicons name="location-outline" size={18} color={colors.gray600} />
                        <Text style={liveTrackingStyles.popupLabel}>
                            {t('livetracking:distance')}:
                        </Text>
                        <Text style={liveTrackingStyles.popupValue}>
                            {station.distance_km?.toFixed(1) || '0.0'} km
                        </Text>
                    </View>
                    <View style={liveTrackingStyles.aidStationInfoRow}>
                        <Ionicons name="trending-up-outline" size={18} color={colors.gray600} />
                        <Text style={liveTrackingStyles.popupLabel}>
                            {t('livetracking:elevation')}:
                        </Text>
                        <Text style={liveTrackingStyles.popupValue}>
                            {station.ele ? Math.round(station.ele) : 0} m
                        </Text>
                    </View>
                </View>

                {!station.accessible_by_car && (
                    <View style={liveTrackingStyles.warningBox}>
                        <Ionicons name="car-outline" size={20} color={colors.warning} />
                        <Text style={liveTrackingStyles.warningText}>
                            {t('livetracking:noCarAccess')}
                        </Text>
                    </View>
                )}

                {station.accessible_by_car && (
                    <TouchableOpacity 
                        style={liveTrackingStyles.directionsBtn} 
                        onPress={openDirections}
                    >
                        <Ionicons name="navigate" size={20} color={colors.white} />
                        <Text style={liveTrackingStyles.directionsBtnText}>
                            {t('livetracking:getDirections')}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};