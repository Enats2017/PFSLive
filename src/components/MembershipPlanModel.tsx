import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, palette, fonts, shadows, withAlpha } from '../styles/common.styles';
import { RING_TINT, useCompactDialog } from './ui';
import { useTranslation } from 'react-i18next';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import ModalScroll from './ui/ModalScroll';

export type ModalActionType =  'disabled' | 'locked' | 'hidden';

interface MembershipActionModalProps {
    visible: boolean;
    actionType: ModalActionType | null;
    title: string;
    description: string;
    confirmLabel?: string;
    showConfirm?: boolean;
    onClose: () => void;
    onConfirm?: () => void;
}

// No `bg` here on purpose — the halo is RING_TINT for every action, like every
// other modal. Only the glyph and its colour carry the action.
const ICON_BY_ACTION: Record<ModalActionType, { name: any; color: string }> = {
    disabled: { name: 'lock-closed', color: palette.textMuted },
    locked: { name: 'time-outline', color: palette.warning },
    hidden: { name: 'information-circle', color: palette.noticeText },
};

const MembershipPlanModel: React.FC<MembershipActionModalProps> = ({
    visible,
    actionType,
    title,
    description,
    confirmLabel,
    showConfirm = false,
    onClose,
    onConfirm,
}) => {
  const { t } = useTranslation();
    const scale = useRef(new Animated.Value(0.85)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    // ✅ Landscape: no icon, buttons side by side (device test 2026-10-23).
    // Portrait: unchanged. Called before the early return below (hooks rule).
    const cd = useCompactDialog();

    useEffect(() => {
        if (visible) {
            scale.setValue(0.85);
            opacity.setValue(0);
            Animated.parallel([
                Animated.spring(scale, {
                    toValue: 1,
                    friction: 7,
                    tension: 70,
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

    if (!actionType) return null;

    const icon = ICON_BY_ACTION[actionType];

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} statusBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.backdrop, cd.s.wrapper]}>
                    {/* ModalScroll: in landscape the card was taller than the screen —
                        icon off the top, buttons off the bottom (audit 2026-10-22) */}
                    <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.compact ? 16 : 48}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <Animated.View
                                style={[
                                    styles.card,
                                    cd.s.card,
                                    cd.compact && styles.cardCompact,
                                    { opacity, transform: [{ scale }] },
                                ]}
                            >
                                <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Ionicons name="close" size={20} color={palette.textMuted} />
                                </TouchableOpacity>

                                <View style={[styles.iconWrapper, cd.s.hide]}>
                                    <Ionicons name={icon.name} size={56} color={icon.color} />
                                </View>

                                <Text style={[styles.title, cd.s.title, cd.compact && styles.clearClose]}>{title}</Text>
                                <Text style={[styles.description, cd.s.message]}>{description}</Text>

                                {/* Stacked, primary on top — the shape ErrorModal,
                                    UndoConfirmModal and DeleteEventModal all use. */}
                                <View style={[styles.buttons, cd.s.buttonsRow]}>
                                    <TouchableOpacity
                                        style={[commonStyles.primaryButton, styles.fullWidth, cd.s.button]}
                                        onPress={showConfirm ? onConfirm : onClose}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={commonStyles.primaryButtonText}>{confirmLabel}</Text>
                                    </TouchableOpacity>

                                    {showConfirm && (
                                        <TouchableOpacity
                                            style={[commonStyles.secondaryButton, styles.fullWidth, cd.s.button]}
                                            onPress={onClose}
                                            activeOpacity={0.85}
                                        >
                                            <Text style={commonStyles.secondaryButtonText}>{t('common:buttons.cancel')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </ModalScroll>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: withAlpha(palette.ink, 0.6),
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        // had no vertical padding: a tall card touched the status bar / home
        // indicator (audit 2026-10-22)
        paddingVertical: 24,
    },
    card: {
    ...shadows.overlay,

        width: '100%',
        maxWidth: 400,
        backgroundColor: palette.surface,
        borderRadius: 16,
        paddingTop: 28,
        paddingBottom: 24,
        paddingHorizontal: 24,
        alignItems: 'center',
  },
    // ✅ Compact (device test 2026-10-23): paddingTop/Bottom beat the shared
    // compact paddingVertical (an edge wins over its shorthand), so they are
    // tightened here too.
    cardCompact: {
        paddingTop: 16,
        paddingBottom: 16,
    },
    // ✅ Compact: the icon is hidden, so the title is level with the X — keep a
    // long title out from under it.
    clearClose: {
        paddingHorizontal: 32,
    },
    closeButton: {
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
    },
    iconWrapper: {
        width: 90,
        height: 90,
        borderRadius: 45,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: RING_TINT,
        marginBottom: 16,
    },
    title: {
        fontFamily: fonts.display,
        fontSize: 20,
        color: palette.ink,
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: palette.textBody,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 24,
    },
    // Buttons come from commonStyles now; the local copies were a filled-grey
    // secondary at paddingVertical 12 against the shared outlined navy at
    // height 48, which is the drift Dialog.tsx's header warns about.
    buttons: {
        width: '100%',
        gap: 12,
    },
    fullWidth: {
        width: '100%',
    },
});

export default MembershipPlanModel;