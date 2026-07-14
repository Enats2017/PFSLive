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
                    <View style={[styles.iconHalo, { backgroundColor: '#EFF6FF' }]}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                    </View>
                    <Text style={styles.title}>Processing Payment</Text>
                    <Text style={styles.description}>
                        Please wait while we confirm your purchase with Apple...
                    </Text>
                </>
            );
        }

        if (status === 'success') {
            return (
                <>
                    <View style={[styles.iconHalo, { backgroundColor: '#EAFAD0' }]}>
                        <View style={[styles.iconCore, { backgroundColor: '#C8F04F33' }]}>
                            <Ionicons name="checkmark-circle" size={34} color="#1A2E35" />
                        </View>
                    </View>
                    <Text style={styles.title}>You're all set!</Text>
                    <Text style={styles.description}>
                        Your membership has been activated successfully. Enjoy tracking your athletes!
                    </Text>
                </>
            );
        }

        return (
            <>
                <View style={[styles.iconHalo, { backgroundColor: '#FEE2E2' }]}>
                    <View style={[styles.iconCore, { backgroundColor: '#FCA5A533' }]}>
                        <Ionicons name="close-circle" size={34} color="#DC2626" />
                    </View>
                </View>
                <Text style={styles.title}>Something went wrong</Text>
                <Text style={styles.description}>
                    {errorMessage || 'We could not verify your purchase. Please try again or contact support.'}
                </Text>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
                    <Text style={styles.closeButtonText}>Close</Text>
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
                        <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                    <View style={[
                        styles.accentBar,
                        {
                            backgroundColor:
                                status === 'processing' ? '#3B82F6' :
                                status === 'success' ? '#C8F04F' : '#DC2626'
                        }
                    ]} />
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
        backgroundColor: 'rgba(15,23,32,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 14,
    },
    accentBar: {
        height: 5,
        width: '100%',
    },
    body: {
        paddingTop: 30,
        paddingBottom: 28,
        paddingHorizontal: 26,
        alignItems: 'center',
    },
    iconHalo: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    iconCore: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.2,
    },
    description: {
        fontSize: 14.5,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 21,
        paddingHorizontal: 4,
    },
    closeButton: {
        marginTop: 22,
        width: '100%',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#1A2E35',
        alignItems: 'center',
    },
    closeButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    iconclose:{
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

    }
});

export default PurchaseStatusModal;