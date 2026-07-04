import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, colors } from '../../styles/common.styles';
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
            <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
                <AppHeader title={t('setting:liveTrackingSettings.header')} showLogo={true} />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={commonStyles.loadingText}>{t('setting:liveTrackingSettings.loadingText')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={['top', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor="#F4F6FB" />
            <AppHeader title={t('setting:liveTrackingSettings.header')} showLogo={true} />
            {isLoggedIn ? <UserTrackingSettings /> : <GuestTrackingSettings />}
        </SafeAreaView>
    );
};

export default LiveTrackingSettingsScreen;