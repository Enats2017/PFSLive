import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Animated,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, palette, radii, shadows, space, type, withAlpha } from '../styles/common.styles';
import { dialogTone, RING_TINT, useCompactDialog } from './ui';
import { useTranslation } from 'react-i18next';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import ModalScroll from './ui/ModalScroll';

type PurchaseStatus = 'processing' | 'success' | 'error';

interface PurchaseStatusModalProps {
    visible: boolean;
    status: PurchaseStatus;
    errorMessage?: string | null;
    onClose: () => void;
}

const PurchaseStatusModal: React.FC<PurchaseStatusModalProps> = ({
    visible,
    status,
    errorMessage,
    onClose,
}) => {
  const { t } = useTranslation();
    // ✅ Compact in landscape (device test 2026-10-23): no icon in any of the
    // three states, tighter card. Portrait: unchanged.
    const cd = useCompactDialog();
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            scale.setValue(0.85);
            opacity.setValue(0);
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 90,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    const renderContent = () => {
        if (status === 'processing') {
            return (
                <>
                    <View style={[styles.iconHalo, cd.s.hide]}>
                        <ActivityIndicator size="large" color={palette.navy} />
                    </View>
                    {/* the spinner IS the processing state: kept small, inline, when
                        the halo is hidden (device test 2026-10-23) */}
                    {cd.compact && (
                        <ActivityIndicator size="small" color={palette.navy} style={styles.compactSpinner} />
                    )}
                    <Text style={[styles.title, cd.s.title]}>{t('membership:purchase.processingTitle')}</Text>
                    <Text style={styles.description}>
                        {t('membership:purchase.processingBody')}
                    </Text>
                </>
            );
        }

        if (status === 'success') {
            return (
                <>
                    <View style={[styles.iconHalo, cd.s.hide]}>
                        <Ionicons name="checkmark-circle" size={56} color={dialogTone.success.icon} />
                    </View>
                    <Text style={[styles.title, cd.s.title]}>{t('membership:purchase.successTitle')}</Text>
                    <Text style={styles.description}>
                        {t('membership:purchase.successBody')}
                    </Text>
                </>
            );
        }

        return (
            <>
                <View style={[styles.iconHalo, cd.s.hide]}>
                    <Ionicons name="close-circle" size={56} color={dialogTone.danger.icon} />
                </View>
                <Text style={[styles.title, cd.s.title]}>{t('membership:purchase.errorTitle')}</Text>
                <Text style={styles.description}>
                    {errorMessage || t('membership:purchase.errorBody')}
                </Text>
                <TouchableOpacity
                    style={[commonStyles.primaryButton, styles.closeButton, cd.compact && { marginTop: space.lg }]}
                    onPress={onClose}
                    activeOpacity={0.85}
                >
                    <Text style={commonStyles.primaryButtonText}>{t('common:buttons.close')}</Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS}
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={status === 'error' ? onClose : undefined}
            statusBarTranslucent
        >
            <View style={[styles.backdrop, cd.s.wrapper]}>
                {/* ModalScroll: with larger text in landscape the error card (icon +
                    copy + Close) was taller than the screen (audit 2026-10-22) */}
                <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.reserve}>
                    <Animated.View
                        style={[
                            styles.card,
                            cd.s.card,
                            { opacity, transform: [{ scale }] },
                        ]}
                    >
                        <TouchableOpacity style={styles.iconclose} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close" size={20} color={palette.textMuted} />
                        </TouchableOpacity>
                        {/* The padding lives on the body, not the card. Compact: with the
                            icon gone the title is level with the ✕ (right 16, 32 wide), so
                            the body clears it on both sides to keep the copy centred
                            (device test 2026-10-23) */}
                        <View style={[styles.body, cd.compact && styles.bodyCompact]}>
                            {renderContent()}
                        </View>
                    </Animated.View>
                </ModalScroll>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: withAlpha(palette.ink, 0.6),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingVertical: 20, // scrolled card keeps a gap top/bottom (audit 2026-10-22)
    },
    card: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: palette.surface,
        borderRadius: radii.lg,
        overflow: 'hidden',
        ...shadows.overlay,
    },
    body: {
        paddingTop: 32,
        paddingBottom: 28,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    bodyCompact: {
        paddingTop: space.lg,
        paddingBottom: space.lg,
        paddingHorizontal: 52,
    },
    compactSpinner: {
        marginBottom: space.sm,
    },
    // One 90/45 RING_TINT halo for all three states, like every other modal.
    // It used to be a coloured halo wrapping a second coloured core — a lime
    // disc inside a pink one on success, danger-on-danger on error.
    iconHalo: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: RING_TINT,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: space.md,
    },
    title: {
        ...type.h2,
        textAlign: 'center',
        marginBottom: space.sm,
    },
    description: {
        ...type.body,
        color: palette.textBody,
        textAlign: 'center',
    },
    closeButton: {
        marginTop: 24,
        width: '100%',
    },
    iconclose:{
          position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: palette.fill,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

export default PurchaseStatusModal;