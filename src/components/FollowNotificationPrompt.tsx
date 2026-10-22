// src/components/FollowNotificationPrompt.tsx
//
// ✅ The fan's pre-prompt, shown after they follow someone: why first, then
// the OS dialog only if they say yes. Mounted once in AppNavigator; driven by
// useFollowPromptStore. Button copy avoids "Allow" (Apple 5.1.1).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { commonStyles, palette, space } from '../styles/common.styles';
import { readinessStyles as s } from '../styles/readiness.styles';
import { useFollowPromptStore, markFollowPromptDismissed, setFollowPromptAsking } from '../store/useFollowPromptStore';
import { notificationPermissionService } from '../services/notificationPermissionService';
import { analyticsService } from '../services/analyticsService';
import { watchForOsPrompt } from '../utils/permissionPrompt';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import { useModalSideInsets, isShortScreen } from '../hooks/useLandscapeSidePadding';

/** iOS: wait for a closing modal (password modal ~300 ms animation) first. */
export const FOLLOW_SHEET_IOS_DELAY_MS = 600;
/** Presented but onShow never fired by then (UIKit refused it — another modal
 *  was still up): release the store so a later follow can prompt again. */
export const FOLLOW_SHEET_SHOW_TIMEOUT_MS = 2000;

export const FollowNotificationPrompt: React.FC = () => {
  const { t } = useTranslation(['readiness']);
  const insets = useSafeAreaInsets();
  const modalSides = useModalSideInsets();
  const { height: windowHeight } = useWindowDimensions();
  const compact = isShortScreen(windowHeight);
  const visible = useFollowPromptStore((st) => st.visible);
  const hide = useFollowPromptStore((st) => st.hide);

  // iOS presents one modal at a time from the root: when the follow came from
  // another modal (e.g. the tracking-password modal, which closes right after
  // the follow), presenting now is refused by UIKit and the sheet never shows
  // — with the store stuck on visible. Present after that modal has gone.
  const [presented, setPresented] = useState(false);
  const shownRef = useRef(false);
  useEffect(() => {
    if (!visible) { setPresented(false); return; }
    shownRef.current = false;
    const delay = Platform.OS === 'ios' ? FOLLOW_SHEET_IOS_DELAY_MS : 0;
    const timer = setTimeout(() => setPresented(true), delay);
    // Still not on screen: the store would stay `visible` for the session and
    // maybePromptNotificationsAfterFollow would never show the sheet again.
    const giveUp = setTimeout(() => { if (!shownRef.current) hide(); }, delay + FOLLOW_SHEET_SHOW_TIMEOUT_MS);
    return () => { clearTimeout(timer); clearTimeout(giveUp); };
  }, [visible, hide]);

  // 'shown' only once the sheet is really on screen — once per opening.
  const onShow = useCallback(() => {
    if (!shownRef.current) void analyticsService.logNotificationAsk('follow', 'shown');
    shownRef.current = true;
  }, []);

  const onDismiss = useCallback(() => {
    void analyticsService.logNotificationAsk('follow', 'dismissed');
    void markFollowPromptDismissed();
    hide();
  }, [hide]);

  const onAccept = useCallback(async () => {
    void analyticsService.logNotificationAsk('follow', 'accepted');
    hide();
    setFollowPromptAsking(true);
    let res;
    let shown = false;
    const watch = watchForOsPrompt();
    try {
      res = await notificationPermissionService.request();
    } finally {
      shown = watch.done();
      setFollowPromptAsking(false);
    }
    void analyticsService.logNotificationAsk('follow', res.status === 'granted' ? 'granted' : 'denied');
    // Said no to the OS prompt: pause like "Not now" — on Android 13+ the OS
    // still allows asking once more, and the next follow must not spend it.
    if (res.status !== 'granted') void markFollowPromptDismissed();
    // The OS showed nothing (blocked at system level): "Turn on" must still
    // do something — open the settings page that can fix it.
    if (res.status !== 'granted' && !shown) await notificationPermissionService.openSettings();
  }, [hide]);

  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={presented} transparent animationType="slide" onRequestClose={onDismiss} onShow={onShow} statusBarTranslucent>
      {/* landscape: the sheet sits clear of the camera / nav bar (modals are outside any SafeAreaView) */}
      <Pressable style={[s.sheetBackdrop, modalSides]} onPress={onDismiss}>
        {/* Capped to the screen and scrolling (landscape: ~355pt sheet on a ~340-393pt
            screen, icon / title went off the top); max 560 wide, centred; no icon in
            compact mode (device test 2026-10-22). */}
        <Pressable
          style={[s.sheet, { paddingBottom: space.xl + insets.bottom, maxHeight: windowHeight - insets.top - 8, maxWidth: 560, width: '100%', alignSelf: 'center' }]}
          onPress={() => { /* swallow */ }}
        >
          <ScrollView style={{ alignSelf: 'stretch' }} contentContainerStyle={{ alignItems: 'center', gap: space.md }} bounces={false} showsVerticalScrollIndicator={compact}>
          <View style={[s.stepIconPlate, compact && { display: 'none' }]}>
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
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
