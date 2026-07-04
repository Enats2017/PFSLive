import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LanguageSelector, LANGUAGE_OPTIONS, LanguageOption } from './LanguageSelector';
import { guestSettingsService } from '../../services/guestSettingsService';
import { toastError } from '../../../utils/toast';
import { commonStyles } from '../../styles/common.styles';
import { styles } from '../../styles/liveTrackingSettings.styles';

export const GuestTrackingSettings: React.FC = () => {
    const { t } = useTranslation(['setting']);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => { loadLanguage(); }, []);

    const loadLanguage = async () => {
        try {
            const { languageId } = await guestSettingsService.getLanguage();
            const match = LANGUAGE_OPTIONS.find(o => o.value === languageId);
            if (match) setSelectedLanguage(match);
        } catch (e: any) {
            console.error('❌ [GuestSettings] Load error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorLoad'));
        }
    };

    const handleLanguageChange = async (option: LanguageOption) => {
        const previous = selectedLanguage;
        setSelectedLanguage(option);
        try {
            setIsUpdating(true);
            await guestSettingsService.updateLanguage(option.value);
        } catch (e: any) {
            console.error('❌ [GuestSettings] Update error:', e?.message);
            toastError(t('setting:liveTrackingSettings.toastErrorSave'));
            setSelectedLanguage(previous);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 15 }} showsVerticalScrollIndicator={false}>
            <View style={styles.pageTitleRow}>
                <Text style={commonStyles.title}>{t('setting:liveTrackingSettings.guestTitle')}</Text>
                <Text style={commonStyles.subtitle}>{t('setting:liveTrackingSettings.guestSubtitle')}</Text>
            </View>

            <LanguageSelector
                selectedLanguage={selectedLanguage}
                onSelect={handleLanguageChange}
                disabled={isUpdating}
            />

          
        </ScrollView>
    );
};