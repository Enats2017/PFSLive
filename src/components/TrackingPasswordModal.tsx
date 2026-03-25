import React, { useState, useRef, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Animated,
    Keyboard,
    KeyboardEvent,
    Platform,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import FloatingLabelInput from './FloatingLabelInput';
import { commonStyles, colors } from '../styles/common.styles';

interface Props {
    visible: boolean;
    isVerifying: boolean;
    passwordError: string;
    onSubmit: (password: string) => void;
    onClose: () => void;
}

export const TrackingPasswordModal: React.FC<Props> = ({
    visible,
    isVerifying,
    passwordError,
    onSubmit,
    onClose,
}) => {
    const { t } = useTranslation(['setting']);
    const insets = useSafeAreaInsets();
    const [password, setPassword] = useState('');

    // slideAnim     — sheet entrance/exit (400=off-screen, 0=resting)
    // keyboardOffset — additional upward lift when keyboard is visible
    // Same pattern as LiveTrackingSettingsScreen: both values run on
    // the native thread via useNativeDriver:true, so they stay in sync
    // with each other and the system keyboard animation.
    // KeyboardAvoidingView is removed — it can't cooperate with
    // useNativeDriver:true animations.
    const slideAnim      = useRef(new Animated.Value(400)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;

    // ── Sheet entrance / exit ─────────────────────────────────────
    useEffect(() => {
        if (visible) {
            setPassword('');
            keyboardOffset.setValue(0);
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 65,
                friction: 11,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 400,
                duration: 280,
                useNativeDriver: true,
            }).start();
        }
    }, [visible]);

    // ── Keyboard listeners ────────────────────────────────────────
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const onHide = (e: KeyboardEvent) => {
            Animated.timing(keyboardOffset, {
                toValue: 0,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [keyboardOffset]);

    // ── Handlers ──────────────────────────────────────────────────
    const handleSubmit = () => {
        if (!password.trim()) return; // guard against empty submit
        onSubmit(password);
    };

    const handleClose = () => {
        Keyboard.dismiss(); // always dismiss keyboard on close
        onClose();
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                {/* Backdrop outside the animated sheet so it never
                    interferes with the translateY calculation */}
                <TouchableOpacity
                    style={styles.backdrop}
                    onPress={handleClose}
                    activeOpacity={1}
                />

                {/* Sheet position = slideAnim - keyboardOffset.
                    Subtracting keyboardOffset lifts the sheet up by
                    exactly the keyboard height, animated on the native
                    thread so it's smooth and jank-free. */}
                <Animated.View style={[
                    styles.sheet,
                    { paddingBottom: insets.bottom + 24 },
                    {
                        transform: [{
                            translateY: Animated.subtract(slideAnim, keyboardOffset),
                        }],
                    },
                ]}>
                    <View style={styles.handle} />

                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={handleClose}
                        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    >
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>

                    <Text style={commonStyles.title}>
                        {t('setting:passwordModal.title')}
                    </Text>
                    <Text style={commonStyles.subtitle}>
                        {t('setting:passwordModal.subtitle')}
                    </Text>

                    <View style={styles.divider} />

                    <FloatingLabelInput
                        label={t('setting:passwordModal.placeholder')}
                        value={password}
                        onChangeText={setPassword}
                        iconName="lock-closed-outline"
                        isPassword
                        required
                    />

                    {!!passwordError && (
                        <Text style={styles.errorText}>{passwordError}</Text>
                    )}

                    <TouchableOpacity
                        style={[
                            commonStyles.primaryButton,
                            { marginTop: 12 },
                            isVerifying && { opacity: 0.7 },
                        ]}
                        onPress={handleSubmit}
                        disabled={isVerifying}
                        activeOpacity={0.85}
                    >
                        {isVerifying
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={commonStyles.primaryButtonText}>
                                {t('setting:passwordModal.submit')}
                              </Text>
                        }
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay:      { flex: 1, justifyContent: 'flex-end' },
    backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14 },
    handle:       { width: 40, height: 4, backgroundColor: '#E0E4F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    closeBtn:     { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    closeBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
    divider:      { height: 1, backgroundColor: '#F0F2F8', marginVertical: 16 },
    errorText:    { fontSize: 13, color: '#FF3B30', marginBottom: 6, marginTop: 4 },
});