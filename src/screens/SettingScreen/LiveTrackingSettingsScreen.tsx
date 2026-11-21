import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppHeader } from '../../components/common/AppHeader';
import { commonStyles, palette, space } from '../../styles/common.styles';
import { tokenService } from '../../services/tokenService';
import { GuestTrackingSettings } from './GuestTrackingSettings';
import { UserTrackingSettings } from './UserTrackingSettings';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';

export const LiveTrackingSettingsScreen: React.FC = () => {
    const { t } = useTranslation(['setting', 'readiness']);
    const navigation = useNavigation<any>();
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking auth
    // ✅ Notch side padding for the Notifications card (SafeAreaView pads the
    // bottom only). The settings below pad themselves.
    const sidePadding = useLandscapeSidePadding();
    const safeEdges = useSafeAreaEdges();   // + Android 3-button landscape sides

    useEffect(() => {
        tokenService.isTokenValid().then(valid => setIsLoggedIn(!!valid));
    }, []);

    if (isLoggedIn === null) {
        return (
            <SafeAreaView style={commonStyles.container} edges={safeEdges}>
                <AppHeader title={t('common:band.trackingSettings')} showLogo={true} showBack />
                <View style={commonStyles.centerContainer}>
                    <ActivityIndicator size="large" color={palette.navy} />
                    <Text style={commonStyles.loadingText}>{t('setting:liveTrackingSettings.loadingText')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={commonStyles.container} edges={safeEdges}>
            <AppHeader title={t('common:band.trackingSettings')} showLogo={true} showBack />
            {/* ✅ One scroll for the Notifications card AND the settings (layout
                audit 2026-10-22): the card sat fixed above the settings' own
                ScrollView, so in landscape (~320-430pt tall) it took most of the
                little height left. The settings' ScrollView now sizes to its
                content inside this one; order and behaviour are unchanged. */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
            {/* Notifications — reachable by guests and members alike. Before
                this there was no route back for anyone who had said no. */}
            <View style={{
                paddingTop: space.lg,
                paddingLeft: space.xl + sidePadding.paddingLeft,
                paddingRight: space.xl + sidePadding.paddingRight,
            }}>
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
            </ScrollView>
        </SafeAreaView>
    );
};

export default LiveTrackingSettingsScreen;