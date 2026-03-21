import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ParticipantMapMarker } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';

interface ParticipantPopupProps {
    participant: ParticipantMapMarker;
    onClose: () => void;
}

export const ParticipantPopup: React.FC<ParticipantPopupProps> = ({
    participant,
    onClose,
}) => {
    const { t } = useTranslation(['livetracking', 'common']);

    const formatTime = (seconds: number | null | undefined): string => {
        if (!seconds || seconds === 0) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatLastUpdate = (timestamp: string | null | undefined): string => {
        if (!timestamp) return t('livetracking:justNow');
        
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return t('livetracking:justNow');
            if (diffMins < 60) return t('livetracking:minutesAgo', { count: diffMins });
            
            const diffHours = Math.floor(diffMins / 60);
            return t('livetracking:hoursAgo', { count: diffHours });
        } catch (error) {
            return t('livetracking:justNow');
        }
    };

    const showPosition = participant.source === 'race_result' && participant.last_checkpoint_name;
    const showFemalePosition = participant.gender === 'f' && participant.position_gender;

    return (
        <View style={liveTrackingStyles.popupOverlay}>
            <View style={liveTrackingStyles.popup}>
                <TouchableOpacity style={liveTrackingStyles.popupCloseBtn} onPress={onClose}>
                    <Ionicons name="close" size={24} color={colors.gray600} />
                </TouchableOpacity>

                <View style={liveTrackingStyles.popupHeader}>
                    {participant.profile_picture ? (
                        <Image
                            source={{ uri: participant.profile_picture }}
                            style={liveTrackingStyles.avatar}
                        />
                    ) : (
                        <View style={liveTrackingStyles.avatarPlaceholder}>
                            <Text style={liveTrackingStyles.initials}>
                                {participant.initials || '?'}
                            </Text>
                        </View>
                    )}
                    <View style={liveTrackingStyles.popupHeaderText}>
                        <Text style={liveTrackingStyles.participantName}>
                            {participant.name || 'Unknown'}
                        </Text>
                        <Text style={liveTrackingStyles.participantBib}>
                            {t('livetracking:bibNumber')} {participant.bib || '—'}
                        </Text>
                    </View>
                </View>

                {showPosition && (
                    <View style={liveTrackingStyles.popupSection}>
                        <Text style={liveTrackingStyles.popupSectionTitle}>
                            {t('livetracking:positionAt')} {participant.last_checkpoint_name}
                        </Text>
                        <View style={liveTrackingStyles.popupRow}>
                            <Text style={liveTrackingStyles.popupLabel}>
                                {t('livetracking:overall')}:
                            </Text>
                            <Text style={liveTrackingStyles.popupValue}>
                                #{participant.position || '—'}
                            </Text>
                        </View>
                        {showFemalePosition && (
                            <View style={liveTrackingStyles.popupRow}>
                                <Text style={liveTrackingStyles.popupLabel}>
                                    {t('livetracking:female')}:
                                </Text>
                                <Text style={liveTrackingStyles.popupValue}>
                                    #{participant.position_gender}
                                </Text>
                            </View>
                        )}
                        {participant.position_category && (
                            <View style={liveTrackingStyles.popupRow}>
                                <Text style={liveTrackingStyles.popupLabel}>
                                    {t('livetracking:category')}:
                                </Text>
                                <Text style={liveTrackingStyles.popupValue}>
                                    #{participant.position_category} ({participant.category || '—'})
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={liveTrackingStyles.popupSection}>
                    <View style={liveTrackingStyles.popupRow}>
                        <Text style={liveTrackingStyles.popupLabel}>
                            {t('livetracking:time')}:
                        </Text>
                        <Text style={liveTrackingStyles.popupValue}>
                            {formatTime(participant.race_time_seconds)}
                        </Text>
                    </View>
                    <View style={liveTrackingStyles.popupRow}>
                        <Text style={liveTrackingStyles.popupLabel}>
                            {t('livetracking:distance')}:
                        </Text>
                        <Text style={liveTrackingStyles.popupValue}>
                            {participant.distance_km?.toFixed(1) || '0.0'} km
                        </Text>
                    </View>
                    <View style={liveTrackingStyles.popupRow}>
                        <Text style={liveTrackingStyles.popupLabel}>
                            {t('livetracking:avgSpeed')}:
                        </Text>
                        <Text style={liveTrackingStyles.popupValue}>
                            {participant.avg_speed_kmh?.toFixed(1) || '0.0'} km/h
                        </Text>
                    </View>
                    {participant.distance_to_next_cp !== null && participant.distance_to_next_cp !== undefined && (
                        <View style={liveTrackingStyles.popupRow}>
                            <Text style={liveTrackingStyles.popupLabel}>
                                {t('livetracking:toNextCheckpoint')}:
                            </Text>
                            <Text style={liveTrackingStyles.popupValue}>
                                {participant.distance_to_next_cp.toFixed(1)} km
                            </Text>
                        </View>
                    )}
                </View>

                <View style={liveTrackingStyles.popupFooter}>
                    <Ionicons name="time-outline" size={14} color={colors.gray500} />
                    <Text style={liveTrackingStyles.lastUpdateText}>
                        {t('livetracking:lastUpdate')}: {formatLastUpdate(participant.last_update)}
                    </Text>
                </View>
            </View>
        </View>
    );
};