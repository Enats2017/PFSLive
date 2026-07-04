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
import { colors, commonStyles, spacing } from '../styles/common.styles';
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
        <Modal transparent visible={internalVisible} animationType="none" onRequestClose={onCancel}>
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onCancel} />

                <Animated.View
                    style={[
                        styles.sheet,
                        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
                    ]}
                >
                    <View style={styles.iconWrap}>
                        <Ionicons name="trash-outline" size={30} color={colors.participantColor ?? '#E53935'} />
                    </View>

                    <Text style={commonStyles.title}>{t('ownProfile:deleteEvent.confirmTitle')}</Text>
                    <Text style={styles.message}>
                        {t('ownProfile:deleteEvent.confirmMessage', { name: event?.name ?? '' })}
                    </Text>

                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={[styles.btn, styles.cancelBtn]}
                            onPress={onCancel}
                            activeOpacity={0.85}
                            disabled={isDeleting}
                        >
                            <Text style={styles.cancelText}>{t('ownProfile:deleteEvent.cancel')}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, styles.deleteBtn, isDeleting && { opacity: 0.7 }]}
                            onPress={onConfirm}
                            activeOpacity={0.85}
                            disabled={isDeleting}
                        >
                            {isDeleting
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={styles.deleteText}>{t('ownProfile:deleteEvent.confirm')}</Text>}
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: spacing.lg,   // NEW — keeps the card off the screen edges
    },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 24,    
                // NEW — all corners rounded now that it's centered
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.lg,
        alignItems: 'center',
    },
    iconWrap: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 10, textAlign: 'center' },
    message: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
    actions: { flexDirection: 'row', width: '100%', gap: 12 },
    btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: '#F2F2F2' },
    cancelText: { color: colors.gray900, fontWeight: '600', fontSize: 15 },
    deleteBtn: { backgroundColor: colors.primary },
    deleteText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});