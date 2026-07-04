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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../styles/common.styles';
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
    const insets = useSafeAreaInsets();
    const slideAnim = useRef(new Animated.Value(400)).current;
    const [internalVisible, setInternalVisible] = useState(visible);

    useEffect(() => {
        if (visible) {
            setInternalVisible(true);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else if (internalVisible) {
            Animated.timing(slideAnim, {
                toValue: 500,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setInternalVisible(false));
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
                        { paddingBottom: insets.bottom + 24, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <View style={styles.handle} />

                    <View style={styles.iconWrap}>
                        <Ionicons name="trash-outline" size={30} color={colors.participantColor ?? '#E53935'} />
                    </View>

                    <Text style={styles.title}>{t('ownProfile:deleteEvent.confirmTitle')}</Text>
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
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        alignItems: 'center',
    },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#E0E0E0', marginBottom: spacing.md },
    iconWrap: {
        width: 60, height: 60, borderRadius: 30,
        backgroundColor: '#FDECEA', alignItems: 'center', justifyContent: 'center',
        marginBottom: spacing.md,
    },
    title: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 6, textAlign: 'center' },
    message: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.sm },
    actions: { flexDirection: 'row', width: '100%', gap: 12 },
    btn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cancelBtn: { backgroundColor: '#F2F2F2' },
    cancelText: { color: colors.gray900, fontWeight: '600', fontSize: 15 },
    deleteBtn: { backgroundColor: '#E53935' },
    deleteText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});