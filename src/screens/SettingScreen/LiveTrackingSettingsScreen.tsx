import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, palette, space } from '../../styles/common.styles';
import { tokenService } from '../../services/tokenService';
import { GuestTrackingSettings } from './GuestTrackingSettings';
import { UserTrackingSettings } from './UserTrackingSettings';

export const LiveTrackingSettingsScreen: React.FC = () => {
    const { t } = useTranslation(['setting', 'readiness']);
    const navigation = useNavigation<any>();
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
            {/* Notifications — reachable by guests and members alike. Before
                this there was no route back for anyone who had said no. */}
            <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg }}>
                <TouchableOpacity
                    style={[commonStyles.menuCard, { marginBottom: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('NotificationSettings')}
                    accessibilityRole="button"
                >
                    <View style={commonStyles.menuIconPlate}>
                        <Ionicons name="notifications-outline" size={25} color={palette.ink} />
                    </View>
                    <View style={commonStyles.menuText}>
                        <Text style={commonStyles.menuTitle}>{t('readiness:notifications.band')}</Text>
                        <Text style={commonStyles.menuSub}>{t('readiness:notifications.menuSub')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={22} color={palette.textMuted} />
                </TouchableOpacity>
            </View>
            {isLoggedIn ? <UserTrackingSettings /> : <GuestTrackingSettings />}
        </SafeAreaView>
    );
};

export default LiveTrackingSettingsScreen;