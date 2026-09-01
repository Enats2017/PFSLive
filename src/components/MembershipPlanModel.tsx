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
import { palette, fonts, shadows } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

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

const ICON_BY_ACTION: Record<ModalActionType, { name: any; color: string; bg: string }> = {
    disabled: { name: 'lock-closed', color: palette.textMuted, bg: palette.fill },
    locked: { name: 'time-outline', color: palette.warning, bg: palette.warningBg },
    hidden: { name: 'information-circle', color: palette.noticeText, bg: palette.noticeBg },
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
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.backdrop}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <Animated.View
                            style={[
                                styles.card,
                                { opacity, transform: [{ scale }] },
                            ]}
                        >
                            <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Ionicons name="close" size={20} color={palette.textMuted} />
                            </TouchableOpacity>

                            <View style={[styles.iconWrapper, { backgroundColor: icon.bg }]}>
                                <Ionicons name={icon.name} size={34} color={icon.color} />
                            </View>

                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.description}>{description}</Text>

                            {showConfirm ? (
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                                        <Text style={styles.secondaryButtonText}>{t('common:buttons.cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.primaryButton} onPress={onConfirm}>
                                        <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity style={styles.primaryButtonFull} onPress={onClose}>
                                    <Text style={styles.primaryButtonText}>{confirmLabel}</Text>
                                </TouchableOpacity>
                            )}
                        </Animated.View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
    ...shadows.overlay,

        width: '100%',
        maxWidth: 360,
        backgroundColor: palette.surface,
        borderRadius: 16,
        paddingTop: 28,
        paddingBottom: 24,
        paddingHorizontal: 24,
        alignItems: 'center',
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
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: 13,
        color: palette.textMuted,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: palette.fill,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.textBody,
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: palette.navy,
        alignItems: 'center',
    },
    primaryButtonFull: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 14,
       backgroundColor: palette.navy,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.surface,
    },
});

export default MembershipPlanModel;