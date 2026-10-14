// src/components/FollowNotificationPrompt.tsx
//
// ✅ The fan's pre-prompt, shown after they follow someone: why first, then
// the OS dialog only if they say yes. Mounted once in AppNavigator; driven by
// useFollowPromptStore. Button copy avoids "Allow" (Apple 5.1.1).

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commonStyles, palette, space } from '../styles/common.styles';
import { readinessStyles as s } from '../styles/readiness.styles';
import { useFollowPromptStore, markFollowPromptDismissed } from '../store/useFollowPromptStore';
import { notificationPermissionService } from '../services/notificationPermissionService';
import { analyticsService } from '../services/analyticsService';

/** iOS: wait for a closing modal (password modal ~300 ms animation) first. */
export const FOLLOW_SHEET_IOS_DELAY_MS = 600;

export const FollowNotificationPrompt: React.FC = () => {
  const { t } = useTranslation(['readiness']);
  const insets = useSafeAreaInsets();
  const visible = useFollowPromptStore((st) => st.visible);
  const hide = useFollowPromptStore((st) => st.hide);

  // iOS presents one modal at a time from the root: when the follow came from
  // another modal (e.g. the tracking-password modal, which closes right after
  // the follow), presenting now is refused by UIKit and the sheet never shows
  // — with the store stuck on visible. Present after that modal has gone.
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    if (!visible) { setPresented(false); return; }
    const timer = setTimeout(() => setPresented(true), Platform.OS === 'ios' ? FOLLOW_SHEET_IOS_DELAY_MS : 0);
    return () => clearTimeout(timer);
  }, [visible]);

  const onDismiss = useCallback(() => {
    void analyticsService.logNotificationAsk('follow', 'dismissed');
    void markFollowPromptDismissed();
    hide();
  }, [hide]);

  const onAccept = useCallback(async () => {
    void analyticsService.logNotificationAsk('follow', 'accepted');
    hide();
    const res = await notificationPermissionService.request();
    void analyticsService.logNotificationAsk('follow', res.status === 'granted' ? 'granted' : 'denied');
    // Said no to the OS prompt: pause like "Not now" — on Android 13+ the OS
    // still allows asking once more, and the next follow must not spend it.
    if (res.status !== 'granted') void markFollowPromptDismissed();
  }, [hide]);

  return (
    <Modal visible={presented} transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable style={s.sheetBackdrop} onPress={onDismiss}>
        <Pressable style={[s.sheet, { paddingBottom: space.xl + insets.bottom }]} onPress={() => { /* swallow */ }}>
          <View style={s.stepIconPlate}>
            <Ionicons name="notifications-outline" size={30} color={palette.navy} />
          </View>
          <Text style={s.stepTitle}>{t('readiness:followPrompt.title')}</Text>
          <Text style={s.stepBody}>{t('readiness:followPrompt.body')}</Text>
          <View style={[s.actions, { alignSelf: 'stretch' }]}>
            <TouchableOpacity
              style={commonStyles.primaryButton}
              onPress={onAccept}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>{t('readiness:followPrompt.accept')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.laterButton} onPress={onDismiss} accessibilityRole="button">
              <Text style={s.laterText}>{t('readiness:followPrompt.dismiss')}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
