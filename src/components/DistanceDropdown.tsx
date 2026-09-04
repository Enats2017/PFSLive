import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DistanceOption } from '../services/liveTrackingService';
import { liveTrackingStyles } from '../styles/liveTracking.styles';
import { palette } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

interface DistanceDropdownProps {
    distances: DistanceOption[];
    selectedDistance: DistanceOption;
    onSelect: (distance: DistanceOption) => void;
    /**
     * Which state the race is in. The pill used to be a boolean that showed
     * "LIVE" or nothing at all, so a finished or not-yet-started race said
     * nothing about itself.
     */
    raceState?: 'live' | 'finished' | 'upcoming';
}

export const DistanceDropdown: React.FC<DistanceDropdownProps> = ({
    distances,
    selectedDistance,
    onSelect,
    raceState,
}) => {
    const { t } = useTranslation(['livetracking']);
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (distance: DistanceOption) => {
        onSelect(distance);
        setIsOpen(false);
    };

    return (
        <View style={liveTrackingStyles.dropdownContainer}>
            <View style={liveTrackingStyles.mapHeadRow}>
                <Text style={liveTrackingStyles.mapHeadTitle}>{t('livetracking:liveMap')}</Text>
                {!!raceState && (
                    <View
                        style={[
                            liveTrackingStyles.mapLivePill,
                            raceState === 'finished' && liveTrackingStyles.mapPillFinished,
                            raceState === 'upcoming' && liveTrackingStyles.mapPillUpcoming,
                        ]}
                    >
                        <Text
                            style={[
                                liveTrackingStyles.mapLiveText,
                                raceState !== 'live' && liveTrackingStyles.mapPillMutedText,
                            ]}
                        >
                            {t(`livetracking:raceState_${raceState}`)}
                        </Text>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={liveTrackingStyles.dropdownButton}
                onPress={() => setIsOpen(true)}
                activeOpacity={0.7}
            >
                <Text style={liveTrackingStyles.dropdownButtonText}>
                    {selectedDistance.distance_name}
                </Text>
                <Ionicons name="chevron-down" size={20} color={palette.ink} />
            </TouchableOpacity>

            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsOpen(false)}
            >
                <TouchableOpacity
                    style={liveTrackingStyles.dropdownModalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsOpen(false)}
                >
                    <View style={liveTrackingStyles.dropdownModal}>
                        <FlatList
                            data={distances}
                            keyExtractor={(item) => item.product_option_value_app_id.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        liveTrackingStyles.dropdownItem,
                                        item.product_option_value_app_id === selectedDistance.product_option_value_app_id &&
                                            liveTrackingStyles.dropdownItemActive,
                                    ]}
                                    onPress={() => handleSelect(item)}
                                >
                                    <Text
                                        style={[
                                            liveTrackingStyles.dropdownItemText,
                                            item.product_option_value_app_id === selectedDistance.product_option_value_app_id &&
                                                liveTrackingStyles.dropdownItemTextActive,
                                        ]}
                                    >
                                        {item.distance_name}
                                    </Text>
                                    {item.product_option_value_app_id === selectedDistance.product_option_value_app_id && (
                                        <Ionicons name="checkmark" size={20} color={palette.navy} />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};