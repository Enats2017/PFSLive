import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LanguageSelector, LANGUAGE_OPTIONS, LanguageOption } from './LanguageSelector';
import { guestSettingsService } from '../../services/guestSettingsService';
import { toastError, toastSuccess } from '../../../utils/toast';
import { styles } from '../../styles/liveTrackingSettings.styles';
import { saveLanguage, getLanguageCodeFromId, getCurrentLanguageId } from '../../i18n';
import { useLanguageStore } from '../../store/useLanguageStore';

// The app's own language as a picker option. Shown when the server has no
// language for this device (or can't be reached): the picker otherwise showed
// nothing selected although the app clearly runs in a language.
const appLanguageOption = (): LanguageOption | null =>
    LANGUAGE_OPTIONS.find(o => o.value === getCurrentLanguageId()) ?? null;

export const GuestTrackingSettings: React.FC = () => {
    const { t } = useTranslation(['setting']);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    // Set when the user picks a language: a slow mount load landing AFTER that
    // must not switch the app back to the server's (older) language.
    const userPickedRef = useRef(false);

    useEffect(() => { loadLanguage(); }, []);

    const { changeLanguage } = useLanguageStore();

    const loadLanguage = async () => {
        try {
            const { languageId, found } = await guestSettingsService.getLanguage();
            if (userPickedRef.current) return;
            // Nothing stored for this device: keep the app's own language —
            // applying the server default switched FR/NL users to English.
            const match = found ? LANGUAGE_OPTIONS.find(o => o.value === languageId) : undefined;
            if (!match) setSelectedLanguage(appLanguageOption());
            if (!found) return;
            if (match) {
                setSelectedLanguage(match);
                const langCode = getLanguageCodeFromId(languageId);
                if (langCode) {
                    await saveLanguage(langCode);
                    await changeLanguage(langCode);
                }
            }
        
        } catch (e: any) {
            console.error('❌ [GuestSettings] Load error:', e?.message);
            if (userPickedRef.current) return;
            setSelectedLanguage(appLanguageOption());
            toastError(t('setting:liveTrackingSettings.toastErrorLoad'));

        }
    };

    const handleLanguageChange = async (option: LanguageOption) => {
        userPickedRef.current = true;
        const previous = selectedLanguage;
        setSelectedLanguage(option);
        try {
            setIsUpdating(true);
            await guestSettingsService.updateLanguage(option.value);
             const langCode = getLanguageCodeFromId(option.value);
        if (langCode) {
            await saveLanguage(langCode);
            await changeLanguage(langCode, { userInitiated: true });
        }
        toastSuccess(t('setting:liveTrackingSettings.toastSuccess'));
        } catch (e: any) {
            console.error('❌ [GuestSettings] Update error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorSave'));
            setSelectedLanguage(previous);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
            <View style={styles.pageTitleRow}>
                <Text style={styles.pageTitle}>{t('setting:liveTrackingSettings.guestTitle')}</Text>
                <Text style={styles.pageSubtitle}>{t('setting:liveTrackingSettings.guestSubtitle')}</Text>
            </View>

            <LanguageSelector
                selectedLanguage={selectedLanguage}
                onSelect={handleLanguageChange}
                disabled={isUpdating}
            />

          
        </ScrollView>
    );
};