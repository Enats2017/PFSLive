import React from 'react';
import { View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import { AidStationMapMarker } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

interface AidStationMarkerProps {
    station: AidStationMapMarker;
    onPress: (station: AidStationMapMarker) => void;
}

export const AidStationMarker: React.FC<AidStationMarkerProps> = ({
    station,
    onPress,
}) => {
    return (
        <Mapbox.PointAnnotation
            id={`aidstation-${station.id}`}
            coordinate={[station.lon, station.lat]}
            onSelected={() => onPress(station)}
            anchor={{ x: 0.5, y: 1 }}
        >
            <View style={liveTrackingStyles.aidStationMarker}>
                <View style={liveTrackingStyles.aidStationIcon}>
                    <Ionicons name="restaurant" size={16} color={colors.white} />
                </View>
            </View>
        </Mapbox.PointAnnotation>
    );
};