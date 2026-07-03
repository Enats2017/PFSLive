import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, commonStyles } from '../styles/common.styles';
import { homeStyles } from '../styles/home.styles';
import FloatingLabelInput from './FloatingLabelInput';
import { fanEmailApi } from '../services/Fanemailservice';



interface FanEmailModalProps {
  visible: boolean;
  onSave: (email: string) => void | Promise<void>;
  onSkip: () => void | Promise<void>;
}



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value.trim());

export const FanEmailModal: React.FC<FanEmailModalProps> = ({ visible, onSave, onSkip }) => {
    const { t } = useTranslation(['home', 'common']);
    const [email, setEmail] = useState('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={handleSkipPress}>
            <View style={homeStyles.notifBackdrop}>
                <View style={homeStyles.notifWrapper}>
                    <View style={homeStyles.notifCard}>
                        <View style={homeStyles.notifIconWrapper}>
                            <Ionicons name="mail-outline" size={36} color={colors.primary} />
                        </View>

                        <Text style={homeStyles.notifTitle}>{t('home:fanEmail.title')}</Text>
                        <Text style={[homeStyles.notifBody,{marginBottom: spacing.md,}]}>{t('home:fanEmail.description')}</Text>

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

                        <View style={homeStyles.notifButtonContainer}>
                            <TouchableOpacity
                                style={[commonStyles.primaryButton, homeStyles.notifViewButton, isSaving && { opacity: 0.6 }]}
                                onPress={handleSavePress}
                                activeOpacity={0.8}
                                disabled={isSaving}
                            >
                                <Text style={commonStyles.primaryButtonText}>
                                    {isSaving ? t('common:buttons.saving') : t('home:fanEmail.save')}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={commonStyles.secondaryButton}
                                onPress={handleSkipPress}
                                activeOpacity={0.7}
                                disabled={isSaving}
                            >
                                <Text style={commonStyles.secondaryButtonText}>{t('home:fanEmail.maybeLater')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
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
        borderColor: colors.error,
    },
    errorText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: colors.error,
    },
});

export default FanEmailModal;