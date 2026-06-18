import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AidStationMapMarker } from '../../types/liveTracking';
import { liveTrackingStyles } from '../../styles/liveTracking.styles';
import { colors } from '../../styles/common.styles';
import { getFeatureIcon } from '../../utils/featureIcons';

// GPX <wpt> descriptions arrive as HTML (RouteYou exports use <br/>, <p>, <ul>/<li>,
// <a href>, &#13;, &amp;, …). React Native <Text> can't render markup, so we flatten
// it to readable plain text: block tags become line breaks / bullets, every other tag
// is stripped, and the handful of entities GPX uses are decoded. Defensive against
// both real tags (already entity-decoded server-side) and any leftover &lt; encoding.
const stripHtml = (raw?: string | null): string => {
    if (!raw) return '';
    let s = String(raw);
    s = s.replace(/<\s*br\s*\/?>/gi, '\n');                       // <br> → newline
    s = s.replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|tr)\s*>/gi, '\n'); // block close → newline
    s = s.replace(/<\s*li[^>]*>/gi, '\u2022 ');                   // <li> → bullet
    s = s.replace(/<[^>]+>/g, '');                                // strip remaining tags
    s = s.replace(/&lt;/g, '<')
         .replace(/&gt;/g, '>')
         .replace(/&quot;/g, '"')
         .replace(/&#39;/g, "'")
         .replace(/&nbsp;/g, ' ')
         .replace(/&#13;/g, '')
         .replace(/&amp;/g, '&');                                 // decode &amp; last
    s = s.replace(/[ \t]+/g, ' ')
         .replace(/ *\n */g, '\n')
         .replace(/\n{3,}/g, '\n\n')
         .trim();
    return s;
};

// Show the Read more / less toggle only when the text is long enough to be clipped.
const LONG_DESC_CHARS = 140;

interface AidStationPopupProps {
    station: AidStationMapMarker;

    onClose: () => void;
}

export const AidStationPopup: React.FC<AidStationPopupProps> = ({
    station,
    onClose,
}) => {
    const { t } = useTranslation(['livetracking', 'common']);
    const features = station.features ?? [];

    // Clean the HTML description once per station, and gate the expand toggle.
    const description = useMemo(() => stripHtml(station.description), [station.description]);
    const isLongDesc = description.length > LONG_DESC_CHARS;
    const [descExpanded, setDescExpanded] = useState(false);

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

                {/* ── Description (from GPX <wpt> <desc>) ─────────────────────
                    Sits right under the name. Collapsed to a few lines by
                    default; long text expands into a bounded, scrollable area so
                    the popup never grows past the screen. Hidden when empty
                    (e.g. Start/Finish or checkpoints without a description). */}
                {description.length > 0 && (
                    <View style={{ paddingTop: 15, paddingBottom: 15 }}>
                        {descExpanded ? (
                            <ScrollView
                                style={{ maxHeight: 180 }}
                                nestedScrollEnabled
                                showsVerticalScrollIndicator
                            >
                                <Text style={{ fontSize: 13, lineHeight: 19, color: '#374151' }}>
                                    {description}
                                </Text>
                            </ScrollView>
                        ) : (
                            <Text
                                style={{ fontSize: 13, lineHeight: 19, color: '#374151' }}
                                numberOfLines={4}
                            >
                                {description}
                            </Text>
                        )}

                        {isLongDesc && (
                            <TouchableOpacity
                                onPress={() => setDescExpanded(v => !v)}
                                style={{ marginTop: 6 }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                                    {descExpanded ? t('livetracking:readLess') : t('livetracking:readMore')}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

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
                    {features.length > 0 && (
                        <View style={{ paddingTop: 10 }}>
                            <Text style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: colors.gray500,
                                letterSpacing: 0.6,
                                textTransform: 'uppercase',
                                marginBottom: 7,
                            }}>
                                {t('livetracking:availableServices')}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                                {features.map(feature => (
                                    <View key={feature}>
                                        <Ionicons
                                            name={getFeatureIcon(feature)}
                                            size={18}
                                            color={colors.gray600}
                                        />
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
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
                <View style={{
                    paddingTop: 12,
                    alignItems: 'flex-end',
                }}>
                    <Text style={{ fontSize: 12, color: colors.gray600 }}>
                        {t('livetracking:poweredBy')}{' '}
                        <Text style={{ fontWeight: '700', color: colors.gray900 }}> {t('livetracking:livio')}</Text>
                    </Text>
                </View>
            </View>
        </View>
    );
};