import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Animated,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette, fonts, space, shadows, withAlpha } from '../styles/common.styles';
import { dialogTone, RING_TINT } from './ui';
import { AthleteEvent } from '../services/athleteProfileService';

interface Props {
    visible: boolean;
    event: AthleteEvent | null;
    isDeleting: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export const DeleteEventModal: React.FC<Props> = ({ visible, event, isDeleting, onCancel, onConfirm }) => {
    const { t } = useTranslation(['ownProfile']);
    const scaleAnim = useRef(new Animated.Value(0.85)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const [internalVisible, setInternalVisible] = useState(visible);

    useEffect(() => {
        if (visible) {
            setInternalVisible(true);
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 10,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (internalVisible) {
            Animated.parallel([
                Animated.timing(scaleAnim, {
                    toValue: 0.85,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start(() => setInternalVisible(false));
        }
    }, [visible]);

    if (!internalVisible) return null;

    return (
        <Modal statusBarTranslucent transparent visible={internalVisible} animationType="none" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel} />

                <Animated.View
                    style={[
                        styles.sheet,
                        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <View style={styles.iconWrap}>
                        <Ionicons name="trash-outline" size={56} color={dialogTone.danger.icon} />
                    </View>

                    <Text style={styles.title}>{t('ownProfile:deleteEvent.confirmTitle')}</Text>
                    <Text style={styles.message}>
                        {t('ownProfile:deleteEvent.confirmMessage', { name: event?.name ?? '' })}
                    </Text>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[commonStyles.primaryButton, isDeleting && { opacity: 0.7 }]}
                            onPress={onConfirm}
                            activeOpacity={0.85}
                            disabled={isDeleting}
                        >
                            {isDeleting
                                ? <ActivityIndicator size="small" color={palette.surface} />
                                : <Text style={commonStyles.primaryButtonText}>{t('ownProfile:deleteEvent.confirm')}</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[commonStyles.secondaryButton]}
                            onPress={onCancel}
                            activeOpacity={0.85}
                            disabled={isDeleting}
                        >
                            <Text style={commonStyles.secondaryButtonText}>{t('ownProfile:deleteEvent.cancel')}</Text>
                        </TouchableOpacity>

                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: withAlpha(palette.ink, 0.6),
        paddingHorizontal: spacing.lg,   // NEW — keeps the card off the screen edges
    },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: palette.surface,
        borderRadius: 16,    
                // NEW — all corners rounded now that it's centered
        paddingHorizontal: 24,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        alignItems: 'center',
        ...shadows.overlay,
    },
    iconWrap: {
        width: 90, height: 90, borderRadius: 45,
        backgroundColor: RING_TINT, alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    // fonts.display at 20, same as ErrorModal / Dialog / MembershipPlanModel
    // and commonStyles.title. bodySemi here was the last thing making this
    // modal read as a different component.
    title: { fontFamily: fonts.display,
        fontSize: 20, color: palette.ink, marginBottom: space.sm, textAlign: 'center' },
    message: { fontFamily: fonts.body,
        fontSize: 13, color: palette.textBody, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
    actions: { width: '100%', gap: 12 },
});