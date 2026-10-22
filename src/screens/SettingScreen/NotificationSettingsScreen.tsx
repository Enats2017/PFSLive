// src/screens/SettingScreen/NotificationSettingsScreen.tsx
//
// ✅ Where a user can see whether notifications are on, and get back to them.
//
// Before this there was no notifications screen at all, so anyone who said no
// (~45% of users, mostly to a cold first-launch prompt) had no route back.
//
// What's possible, honestly: the OS shows its prompt ONCE per install. If the
// user hasn't been asked yet we ask here; once they've said no, the only way
// back is the phone's Settings page — one tap from here. We can't re-enable
// notifications from inside the app and this screen doesn't pretend to.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../components/common/AppHeader';
import { useLandscapeSidePadding, useSafeAreaEdges } from '../../hooks/useLandscapeSidePadding';
import { commonStyles, palette, space } from '../../styles/common.styles';
import { readinessStyles as s } from '../../styles/readiness.styles';
import {
  notificationPermissionService,
  NotificationPermissionState,
} from '../../services/notificationPermissionService';
import { analyticsService } from '../../services/analyticsService';
import { watchForOsPrompt } from '../../utils/permissionPrompt';

const NotificationSettingsScreen: React.FC = () => {
  const { t } = useTranslation(['readiness']);
  const sidePadding = useLandscapeSidePadding();   // landscape: body clear of the notch (audit 2026-10-22)
  const safeEdges = useSafeAreaEdges();
  const [perm, setPerm] = useState<NotificationPermissionState | null>(null);

  const refresh = useCallback(async () => {
    setPerm(await notificationPermissionService.getState());
  }, []);

  useEffect(() => {
    void refresh();
    // Returning from the phone's Settings — show the new state immediately.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const isOn = perm?.status === 'granted';
  // Android 13+ allows a second prompt after one "no"; iOS never does
  // (canAskAgain false). Ask whenever the OS still will, otherwise Settings.
  const canAsk = !!perm && perm.status !== 'granted' && perm.canAskAgain;

  // A double tap must not fire two OS requests (or request + Settings).
  const busyRef = useRef(false);
  const onPress = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      if (canAsk) {
        void analyticsService.logNotificationAsk('settings_screen', 'accepted');
        const watch = watchForOsPrompt();
        let res;
        let shown = false;
        try {
          res = await notificationPermissionService.request();
        } finally {
          shown = watch.done();
        }
        void analyticsService.logNotificationAsk('settings_screen', res.status === 'granted' ? 'granted' : 'denied');
        setPerm(res);
        // The OS showed nothing (blocked at system level): the button must
        // still do something — open the settings page that can fix it.
        if (res.status !== 'granted' && !shown) await notificationPermissionService.openSettings();
        return;
      }
      void analyticsService.logNotificationAsk('settings_screen', 'settings');
      await notificationPermissionService.openSettings();
    } finally {
      busyRef.current = false;
    }
  }, [canAsk]);

  const title = !perm
    ? ''
    : isOn
      ? t('readiness:notifications.statusOn')
      : perm.status === 'undetermined'
        ? t('readiness:notifications.statusNotAsked')
        : t('readiness:notifications.statusOff');

  const body = !perm
    ? ''
    : isOn
      ? t('readiness:notifications.bodyOn')
      // canAsk (Android 13+ after one "no"): the button asks again, so the
      // body must not say "only in your phone's settings".
      : perm.status === 'undetermined' || canAsk
        ? t('readiness:notifications.bodyNotAsked')
        : t('readiness:notifications.bodyOff');

  return (
    <SafeAreaView style={commonStyles.container} edges={safeEdges}>
      <AppHeader title={t('readiness:notifications.band')} showLogo showBack />
      {/* notch inset ADDED to the 20pt padding (paddingLeft/Right beat padding) */}
      <ScrollView
        contentContainerStyle={[s.screen, { paddingLeft: space.xl + sidePadding.paddingLeft, paddingRight: space.xl + sidePadding.paddingRight }]}
        showsVerticalScrollIndicator={false}
      >
        {perm && (
          <View style={s.card}>
            <View style={s.statusRow}>
              <Ionicons
                name={isOn ? 'notifications' : 'notifications-off-outline'}
                size={24}
                color={isOn ? palette.navy : palette.textMuted}
              />
              <Text style={s.statusTitle}>{title}</Text>
            </View>
            <Text style={s.statusBody}>{body}</Text>
            {/* Shown even when ON — it's also how you switch them OFF. */}
            <TouchableOpacity
              style={[isOn ? commonStyles.outlineButton : commonStyles.primaryButton, { marginTop: space.lg }]}
              onPress={onPress}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={isOn ? commonStyles.outlineButtonText : commonStyles.primaryButtonText}>
                {canAsk ? t('readiness:notifications.turnOn') : t('readiness:notifications.openSettings')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsScreen;
