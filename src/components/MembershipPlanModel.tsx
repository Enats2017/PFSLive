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

export type ModalActionType = 'upgrade' | 'disabled' | 'locked' | 'hidden';

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
    upgrade: { name: 'arrow-up-circle', color: '#1A2E35', bg: '#D9F26A' },
    disabled: { name: 'lock-closed', color: '#9CA3AF', bg: '#F3F4F6' },
    locked: { name: 'time-outline', color: '#F59E0B', bg: '#FEF3C7' },
    hidden: { name: 'information-circle', color: '#3B82F6', bg: '#DBEAFE' },
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
                                <Ionicons name="close" size={20} color="#6B7280" />
                            </TouchableOpacity>

                            <View style={[styles.iconWrapper, { backgroundColor: icon.bg }]}>
                                <Ionicons name={icon.name} size={34} color={icon.color} />
                            </View>

                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.description}>{description}</Text>

                            {showConfirm ? (
                                <View style={styles.buttonRow}>
                                    <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                                        <Text style={styles.secondaryButtonText}>Cancel</Text>
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
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingTop: 28,
        paddingBottom: 22,
        paddingHorizontal: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 1,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
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
        fontSize: 19,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 22,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
    },
    primaryButton: {
        flex: 1,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: '#D9F26A',
        alignItems: 'center',
    },
    primaryButtonFull: {
        width: '100%',
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: '#D9F26A',
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A2E35',
    },
});

export default MembershipPlanModel;