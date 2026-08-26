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
    event_source?: string;
    /**
     * True only when RaceResult timing is live for this event. A partner event
     * with race_result_status = 0 is tracked from GPS exactly like a custom one:
     * no bib, no positions. event_source alone can't express that, since both
     * kinds of partner event report 'partner'.
     */
    isRrActive?: boolean;
}

export const ParticipantPopup: React.FC<ParticipantPopupProps> = ({
    participant,
    onClose,
    event_source,
    isRrActive,
}) => {
    const { t } = useTranslation(['livetracking', 'common']);

    const formatTime = (seconds: number | null | undefined): string => {
        if (!seconds || seconds === 0) return '00:00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatLastUpdate = (time: number | null | undefined, type: string | null | undefined): string => {
        if (!time || !type) return t('livetracking:justNow');

        switch (type) {
            case 's': return t('livetracking:secondsAgo', { count: time });
            case 'm': return t('livetracking:minutesAgo', { count: time });
            case 'h': return t('livetracking:hoursAgo',   { count: time });
            default:  return t('livetracking:justNow');
        }
    };

    // source === 'race_result' already implies RR data, but gate on isRrActive too
    // so a stale marker from a previous poll can't render a positions block on an
    // event where RR has since been switched off.
    const showPosition = (isRrActive ?? true)
        && participant.source === 'race_result'
        && participant.last_checkpoint_name;
    const showFemalePosition = participant.gender === 'f' && participant.position_gender;

    const LOW_BATTERY_THRESHOLD = 15; // % — warn at/below this

    // Once someone has crossed the line their tracker stops sending, so "offline"
    // and "battery low" describe a phone in a drop bag, not a runner in trouble.
    const hasFinished = participant.connection_status === 'finished';

    const battery = participant.battery_level;
    const showLowBattery = !hasFinished && battery != null && battery <= LOW_BATTERY_THRESHOLD;

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
                        {/* Fall back to the old event_source test for any caller
                            that hasn't been updated to pass isRrActive yet. */}
                        {(isRrActive ?? event_source !== 'custom') && !!participant.bib && (
                            <Text style={liveTrackingStyles.participantBib}>
                                {t('livetracking:bibNumber')} {participant.bib}
                            </Text>
                        )}
                    </View>
                </View>

                {hasFinished ? null : participant.connection_status === 'offline' ? (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1,
                        borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 12,
                    }}>
                        <Ionicons name="cloud-offline-outline" size={16} color="#475569" />
                        <Text style={{ flex: 1, color: '#334155', fontSize: 12 }}>
                            {t('livetracking:offlineNotice', {
                                time: formatLastUpdate(participant.last_update_time, participant.last_update_type),
                            })}
                        </Text>
                    </View>
                ) : participant.is_estimated ? (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: '#FEF3C7', borderRadius: 8,
                        paddingVertical: 6, paddingHorizontal: 10, marginBottom: 10,
                    }}>
                        <Ionicons name="cellular-outline" size={14} color="#B45309" />
                        <Text style={{ flex: 1, color: '#92400E', fontSize: 12 }}>
                            {t('livetracking:estimatedNotice')}
                        </Text>
                    </View>
                ) : null}

                {showLowBattery && (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 1,
                        borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 12,
                    }}>
                        <Ionicons name="battery-dead-outline" size={18} color="#DC2626" />
                        <Text style={{ color: '#B91C1C', fontSize: 13, fontWeight: '600', flex: 1 }}>
                            {t('livetracking:lowBattery', { level: battery })}
                        </Text>
                    </View>
                )}

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
                        {t('livetracking:lastUpdate')}: {formatLastUpdate(participant.last_update_time, participant.last_update_type)}
                    </Text>
                </View>
            </View>
        </View>
    );
};