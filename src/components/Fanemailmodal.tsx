import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, KeyboardEvent, Keyboard, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { spacing, commonStyles, palette, fonts } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import FloatingLabelInput from './FloatingLabelInput';
import ModalScroll from './ui/ModalScroll';
import { fanEmailApi } from '../services/Fanemailservice';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import { isCompactPopup } from '../hooks/useLandscapeSidePadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';



interface FanEmailModalProps {
    visible: boolean;
    onSave: (email: string) => void | Promise<void>;
    onSkip: () => void | Promise<void>;
}



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

export const FanEmailModal: React.FC<FanEmailModalProps> = ({ visible, onSave, onSkip }) => {
    const { t } = useTranslation(['home', 'common']);
    // landscape: compact card, clear of the camera (device test 2026-10-22)
    const popupWindow = useWindowDimensions();
    const compact = isCompactPopup(popupWindow.width, popupWindow.height);
    const insets = useSafeAreaInsets();
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);


    // Keyboard height pads the bottom of the wrapper so the (scrollable) card
    // is laid out in the space ABOVE the keyboard. It used to translate the
    // card up by half the keyboard: in landscape / larger text that pushed the
    // title off the top and left the buttons under the keyboard (audit 2026-10-22).
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = (e: KeyboardEvent) => setKeyboardHeight(e.endCoordinates.height);
        const onHide = () => setKeyboardHeight(0);

        const showSub = Keyboard.addListener(showEvent, onShow);
        const hideSub = Keyboard.addListener(hideEvent, onHide);

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // ✅ Landscape while typing (device test 2026-10-23): ~126pt was left above
    // the keyboard, and the description filled it — the e-mail field being typed
    // in sat out of view. While the keyboard is up in compact mode the
    // description is hidden (title, field and buttons stay), and ModalScroll gets
    // back the home-indicator inset it reserves twice: the keyboard covers it.
    // The status bar (insets.top) is still kept clear.
    const typingCompact = compact && keyboardHeight > 0;
    const keyboardGiveBack = keyboardHeight > 0 ? 2 * (Math.max(insets.top, insets.bottom) - insets.top) : 0;
    const wrapperPad = compact ? spacing.sm : spacing.xl;

    const handleChangeText = useCallback((value: string) => {
        setEmail(value);
        if (errorMessage) setErrorMessage(null);
    }, [errorMessage]);

    const handleSavePress = useCallback(async () => {
        const trimmed = email.trim();

        // Empty field on Save behaves like "Maybe later".
        if (trimmed.length === 0) {
            fanEmailApi.updateEmail(''); // fire-and-forget, don't block UI
            onSkip();
            return;
        }

        if (!isValidEmail(trimmed)) {
            setErrorMessage(t('home:fanEmail.invalidEmail'));
            return;
        }

        setErrorMessage(null);
        setIsSaving(true);

        const result = await fanEmailApi.updateEmail(trimmed);

        setIsSaving(false);

        if (!result.success) {
            setErrorMessage(t('home:fanEmail.saveFailed'));
            return;
        }

        onSave(trimmed);
    }, [email, onSave, onSkip, t]);

    const handleSkipPress = useCallback(() => {
        setErrorMessage(null);
        fanEmailApi.updateEmail(''); // fire-and-forget — skip shouldn't wait on network
        onSkip();
    }, [onSkip]);

    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={handleSkipPress}>
            <View style={homeStyles.notifBackdrop}>
                <View style={[homeStyles.notifWrapper, compact && homeStyles.notifWrapperCompact, keyboardHeight > 0 && { paddingBottom: wrapperPad + keyboardHeight }]}>
                    {/* ModalScroll: the card is taller than a landscape screen —
                        icon / buttons were unreachable (audit 2026-10-22) */}
                    <ModalScroll contentStyle={{ alignItems: 'center' }} style={compact ? homeStyles.notifScrollCompact : undefined} reserve={(compact ? 16 : 40) + keyboardHeight - keyboardGiveBack}>
                        <View style={[homeStyles.notifCard, compact && homeStyles.notifCardCompact]}>

                            <View style={[homeStyles.notifIconWrapper, compact && homeStyles.hideCompact]}>
                                <Ionicons name="mail-outline" size={36} color={palette.navy} />
                            </View>

                            <Text style={homeStyles.notifTitle}>{t('home:fanEmail.title')}</Text>
                            <Text style={[homeStyles.notifBody, { marginBottom: spacing.md, }, compact && homeStyles.notifBodyCompact, typingCompact && homeStyles.hideCompact]}>{t('home:fanEmail.description')}</Text>

                            <View style={styles.inputWrapper}>
                                <FloatingLabelInput
                                    label={t('home:fanEmail.emailPlaceholder')}
                                    value={email}
                                    onChangeText={handleChangeText}
                                    iconName="mail-outline"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    error={!!errorMessage}
                                    errorMessage={errorMessage ?? undefined}
                                    editable={!isSaving}
                                />
                            </View>

                            {/* landscape: the two buttons side by side, like the Home popups */}
                            <View style={[homeStyles.notifButtonContainer, compact && homeStyles.notifButtonRowCompact]}>
                                <TouchableOpacity
                                    style={[commonStyles.primaryButton, homeStyles.notifViewButton, compact && homeStyles.notifButtonCompact, isSaving && { opacity: 0.6 }]}
                                    onPress={handleSavePress}
                                    activeOpacity={0.8}
                                    disabled={isSaving}
                                >
                                    <Text style={commonStyles.primaryButtonText}>
                                        {isSaving ? t('home:fanEmail.saving') : t('home:fanEmail.save')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[commonStyles.secondaryButton, compact && homeStyles.notifButtonCompact]}
                                    onPress={handleSkipPress}
                                    activeOpacity={0.7}
                                    disabled={isSaving}
                                >
                                    <Text style={commonStyles.secondaryButtonText}>{t('home:fanEmail.maybeLater')}</Text>
                                </TouchableOpacity>
                            </View>

                        </View>
                    </ModalScroll>

                </View>
            </View>
        </Modal>
    );
};



const styles = StyleSheet.create({
    inputWrapper: {
        width: '100%',
        marginBottom: spacing.xs,
    },
    inputError: {
        borderColor: palette.danger,
    },
    errorText: {
        marginTop: spacing.xs,
        fontFamily: fonts.body,
        fontSize: 13,
        color: palette.danger,
    },
});

export default FanEmailModal;