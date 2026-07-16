import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Easing,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles, spacing } from '../styles/common.styles';

interface FeedbackSuccessModalProps {
    visible: boolean;
    title?: string;
    subtitle?: string;
    buttonLabel?: string;
    onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);

const FeedbackSuccessModal: React.FC<FeedbackSuccessModalProps> = ({
    visible,
    title = 'Thanks, we got it',
    subtitle = "You'll get a confirmation email, and we'll reply if it needs one.",
    buttonLabel = 'Back to profile',
    onClose,
}) => {

    const cardScale = useRef(new Animated.Value(0.85)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;

    const iconScale = useRef(new Animated.Value(0)).current;

    // Checkmark "draw" (stroke reveal via scale-x + fade, cheap but effective without SVG)
    const checkScale = useRef(new Animated.Value(0)).current;
    const checkOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!visible) return;

        // Reset on every open so re-triggering feels fresh
        cardScale.setValue(0.85);
        cardOpacity.setValue(0);
        iconScale.setValue(0);
        checkScale.setValue(0);
        checkOpacity.setValue(0);

        Animated.parallel([
            Animated.timing(cardOpacity, {
                toValue: 1,
                duration: 220,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.spring(cardScale, {
                toValue: 1,
                friction: 8,
                tension: 90,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.delay(120),
                Animated.spring(iconScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 140,
                    useNativeDriver: true,
                }),
            ]),
            Animated.sequence([
                Animated.delay(260),
                Animated.parallel([
                    Animated.timing(checkOpacity, {
                        toValue: 1,
                        duration: 150,
                        useNativeDriver: true,
                    }),
                    Animated.spring(checkScale, {
                        toValue: 1,
                        friction: 4,
                        tension: 160,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        ]).start();
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.backdrop}>
                <Animated.View
                    style={[
                        styles.card,
                        { opacity: cardOpacity, transform: [{ scale: cardScale }] },
                    ]}
                >
                    <View style={styles.iconWrapper}>
                        <Animated.View
                            style={[
                                styles.iconCircle,
                                { transform: [{ scale: iconScale }] },
                            ]}
                        >
                            <Animated.View
                                style={{
                                    opacity: checkOpacity,
                                    transform: [{ scale: checkScale }],
                                }}
                            >
                                <Ionicons name="checkmark" size={38} color={colors.primaryDark} />
                            </Animated.View>
                        </Animated.View>
                    </View>

                    <Text style={[commonStyles.title, { textAlign: 'center' }]}>{title}</Text>
                    <Text style={styles.subtitle}>{subtitle}</Text>

                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { minWidth: '100%' }]}
                        activeOpacity={0.9}
                        onPress={onClose}
                    >
                        <Text style={commonStyles.primaryButtonText}>{buttonLabel}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: CARD_WIDTH,
        backgroundColor: colors.white,
        borderRadius: 28,
        paddingTop: 36,
        paddingBottom: 24,
        paddingHorizontal: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 12,
    },
    iconWrapper: {
        width: 84,
        height: 84,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: colors.themeiColor,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 7,
        elevation: 6,
    },
    title: {
        fontSize: 19,
        fontWeight: '700',
        color: colors.gray900,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        lineHeight: 20,
        color: colors.gray400,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        width: '100%',
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: colors.white,
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
});

export default FeedbackSuccessModal;