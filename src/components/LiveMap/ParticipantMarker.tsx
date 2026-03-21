import React from 'react';
import { View, Text } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { ParticipantMapMarker } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';

interface ParticipantMarkerProps {
    participant: ParticipantMapMarker;
    zoomLevel: number;
    onPress: (participant: ParticipantMapMarker) => void;
}

export const ParticipantMarker: React.FC<ParticipantMarkerProps> = ({
    participant,
    zoomLevel,
    onPress,
}) => {
    // ✅ Show BIB only when zoomed in (zoom > 13)
    const showBib = zoomLevel > 13;

    return (
        <Mapbox.PointAnnotation
            id={`participant-${participant.id}`}
            coordinate={[participant.lon, participant.lat]}
            onSelected={() => onPress(participant)}
        >
            <View style={liveTrackingStyles.markerContainer}>
                {/* ✅ Green Dot - ALWAYS VISIBLE */}
                <View style={[liveTrackingStyles.dot, liveTrackingStyles.greenDot]} />
                
                {/* ✅ BIB Badge - Only visible when zoomed in */}
                {showBib && (
                    <View style={liveTrackingStyles.bibBadge}>
                        <Text style={liveTrackingStyles.bibText}>{participant.bib}</Text>
                    </View>
                )}
            </View>
        </Mapbox.PointAnnotation>
    );
};