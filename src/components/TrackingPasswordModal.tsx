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
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import FloatingLabelInput from './FloatingLabelInput';
import { commonStyles, palette, fonts, space, shadows, withAlpha } from '../styles/common.styles';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import { useModalSideInsets } from '../hooks/useLandscapeSidePadding';

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
    const { height: windowHeight } = useWindowDimensions();
    // a Modal is outside any SafeAreaView: pad by the side insets in landscape on every
    // platform (the screen rule returned 0 on Android 3-button — sheet under the nav bar)
    const side = useModalSideInsets();
    // Mirrors keyboardOffset as plain state, only to cap the sheet height: the
    // sheet is lifted by the full keyboard height, so in landscape (~320-430pt
    // tall) the title, ✕ and even the input went off the top with nothing to
    // scroll. Now the sheet is at most (window − keyboard − top inset) and its
    // body scrolls (audit 2026-10-22).
    const [keyboardHeight, setKeyboardHeight] = useState(0);

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
            setKeyboardHeight(0);
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
            setKeyboardHeight(e.endCoordinates.height);
            Animated.timing(keyboardOffset, {
                toValue: e.endCoordinates.height,
                duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 200,
                useNativeDriver: true,
            }).start();
        };

        const onHide = (e: KeyboardEvent) => {
            setKeyboardHeight(0);
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
        <Modal supportedOrientations={MODAL_ORIENTATIONS} statusBarTranslucent
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
                    {
                        paddingBottom: (keyboardHeight > 0 ? 0 : insets.bottom) + 24,   // home-indicator inset is behind the keyboard while typing
                        maxHeight: windowHeight - keyboardHeight - insets.top - 8,
                        // landscape: keep the input clear of the notch
                        paddingLeft: 24 + side.paddingLeft,
                        paddingRight: 24 + side.paddingRight,
                    },
                    {
                        transform: [{
                            translateY: Animated.subtract(slideAnim, keyboardOffset),
                        }],
                    },
                ]}>
                    <View style={styles.handle} />

                    <TouchableOpacity
                        style={[styles.closeBtn, { right: 14 + side.paddingRight }]}
                        onPress={handleClose}
                        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    >
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>

                    <ScrollView
                        style={styles.body}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
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
                                ? <ActivityIndicator size="small" color={palette.surface} />
                                : <Text style={commonStyles.primaryButtonText}>
                                    {t('setting:passwordModal.submit')}
                                  </Text>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay:      { flex: 1, justifyContent: 'flex-end' },
    backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(palette.ink, 0.6) },
    sheet:        { backgroundColor: palette.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 24, paddingTop: 16, ...shadows.overlay },
    handle:       { width: 40, height: 4, backgroundColor: palette.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    closeBtn:     { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: palette.navy, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    closeBtnText: { fontFamily: fonts.bodySemi,
        fontSize: 14, color: palette.surface },
    // flexGrow 0: content height until the sheet hits maxHeight, then scrolls
    body:         { flexGrow: 0, flexShrink: 1 },
    divider:      { height: 1, backgroundColor: palette.border, marginVertical: 16 },
    errorText:    { fontFamily: fonts.body,
        fontSize: 14, color: palette.danger, marginBottom: space.md, marginTop: 4 },
});