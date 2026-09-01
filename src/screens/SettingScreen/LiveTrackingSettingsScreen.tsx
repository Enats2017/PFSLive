import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, palette } from '../../styles/common.styles';
import { tokenService } from '../../services/tokenService';
import { GuestTrackingSettings } from './GuestTrackingSettings';
import { UserTrackingSettings } from './UserTrackingSettings';

export const LiveTrackingSettingsScreen: React.FC = () => {
    const { t } = useTranslation(['setting']);
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking auth

    useEffect(() => {
        tokenService.isTokenValid().then(valid => setIsLoggedIn(!!valid));
    }, []);

    if (isLoggedIn === null) {
        return (
            <SafeAreaView style={commonStyles.container} edges={['bottom']}>
                <AppHeader title={t('common:band.trackingSettings')} showLogo={true} showBack />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.navy} />
                    <Text style={commonStyles.loadingText}>{t('setting:liveTrackingSettings.loadingText')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['bottom']}>
            <AppHeader title={t('common:band.trackingSettings')} showLogo={true} showBack />
            {isLoggedIn ? <UserTrackingSettings /> : <GuestTrackingSettings />}
        </SafeAreaView>
    );
};

export default LiveTrackingSettingsScreen;