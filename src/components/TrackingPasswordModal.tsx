// components/TrackingPasswordModal.tsx

import React, { useState, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Animated,
    KeyboardAvoidingView,
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
    const slideAnim = useRef(new Animated.Value(400)).current;

    // Animate in
    React.useEffect(() => {
        if (visible) {
            setPassword('');
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

    const handleSubmit = () => onSubmit(password);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <Animated.View style={[
                    styles.sheet,
                    { paddingBottom: insets.bottom + 24 },
                    { transform: [{ translateY: slideAnim }] },
                ]}>
                    {/* Handle */}
                    <View style={styles.handle} />

                    {/* Close */}
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    >
                        <Text style={styles.closeBtnText}>✕</Text>
                    </TouchableOpacity>

                    {/* Header */}
                    <Text style={commonStyles.title}>
                        {t('setting:passwordModal.title')}
                    </Text>
                    <Text style={commonStyles.subtitle}>
                        {t('setting:passwordModal.subtitle')}
                    </Text>

                    <View style={styles.divider} />

                    {/* Password Input */}
                    <FloatingLabelInput
                        label={t('setting:passwordModal.placeholder')}
                        value={password}
                        onChangeText={setPassword}
                        iconName="lock-closed-outline"
                        isPassword
                        required
                    />

                    {/* Error */}
                    {!!passwordError && (
                        <Text style={styles.errorText}>{passwordError}</Text>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { marginTop: 12 }, isVerifying && { opacity: 0.7 }]}
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
            </KeyboardAvoidingView>
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