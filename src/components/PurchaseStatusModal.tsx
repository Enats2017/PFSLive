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
import { palette, radii, shadows, space, fonts, type, withAlpha } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

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
                    <View style={[styles.iconHalo, { backgroundColor: palette.fill }]}>
                        <ActivityIndicator size="large" color={palette.navy} />
                    </View>
                    <Text style={styles.title}>{t('membership:purchase.processingTitle')}</Text>
                    <Text style={styles.description}>
                        {t('membership:purchase.processingBody')}
                    </Text>
                </>
            );
        }

        if (status === 'success') {
            return (
                <>
                    <View style={[styles.iconHalo, { backgroundColor: palette.noticeBg }]}>
                        <View style={[styles.iconCore, { backgroundColor: palette.lime }]}>
                            <Ionicons name="checkmark-circle" size={34} color={palette.ink} />
                        </View>
                    </View>
                    <Text style={styles.title}>{t('membership:purchase.successTitle')}</Text>
                    <Text style={styles.description}>
                        {t('membership:purchase.successBody')}
                    </Text>
                </>
            );
        }

        return (
            <>
                <View style={[styles.iconHalo, { backgroundColor: palette.dangerBg }]}>
                    <View style={[styles.iconCore, { backgroundColor: palette.dangerBg }]}>
                        <Ionicons name="close-circle" size={34} color={palette.danger} />
                    </View>
                </View>
                <Text style={styles.title}>{t('membership:purchase.errorTitle')}</Text>
                <Text style={styles.description}>
                    {errorMessage || t('membership:purchase.errorBody')}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
                    <Text style={styles.closeButtonText}>{t('common:buttons.close')}</Text>
                </TouchableOpacity>
            </>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={status === 'error' ? onClose : undefined}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                <Animated.View
                    style={[
                        styles.card,
                        { opacity, transform: [{ scale }] },
                    ]}
                >
                    <TouchableOpacity style={styles.iconclose} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="close" size={20} color={palette.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.body}>
                        {renderContent()}
                    </View>
                </Animated.View>
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
    },
    card: {
        width: '100%',
        maxWidth: 360,
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
    iconHalo: {
        width: 84,
        height: 84,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: space.md,
    },
    iconCore: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        ...type.h2,
        textAlign: 'center',
        marginBottom: space.sm,
    },
    description: {
        ...type.body,
        color: palette.textMuted,
        textAlign: 'center',
    },
    closeButton: {
        marginTop: 24,
        width: '100%',
        paddingVertical: 16,
        borderRadius: radii.md,
        backgroundColor: palette.navy,
        alignItems: 'center',
    },
    closeButtonText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.surface,
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