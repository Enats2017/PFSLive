// src/screens/RaceReadyScreen.tsx
//
// ✅ "Get race-ready" — the runner's permission moment, days before the race.
//
// One step at a time, each with one line of WHY, then the OS prompt. Every
// step can be skipped with "Later" — nobody is forced, and nothing here blocks
// anything. Steps already satisfied never show. The start-line gate in
// HomeScreen is unchanged and stays the last safety net.
//
// Button copy is "Continue", never "Allow": Apple 5.1.1 rejects pre-permission
// screens that imitate or pressure the system dialog.
//
// Nothing here starts the tracking engine — see readinessService.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, ScrollView, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/common/AppHeader';
import { commonStyles, palette } from '../styles/common.styles';
import { readinessStyles as s } from '../styles/readiness.styles';
import { RootStackParamList } from '../types/navigation';
import { readinessService, ReadinessItem, ReadinessState } from '../services/readinessService';
import { RACE_READY_ITEMS, stepProgress, raceReadyOutcome, backgroundOpensSettings } from '../services/raceReadyService';
import { notificationPermissionService } from '../services/notificationPermissionService';
import { gpsService } from '../services/gpsService';
import { analyticsService } from '../services/analyticsService';
import { openLocationSettingsFor, requestBatteryOptimizationExemption } from '../utils/deviceSettings';
import { watchForOsPrompt } from '../utils/permissionPrompt';

type Props = NativeStackScreenProps<RootStackParamList, 'RaceReady'>;

const ICONS: Record<ReadinessItem, keyof typeof Ionicons.glyphMap> = {
  notifications: 'notifications-outline',
  location: 'location-outline',
  background: 'phone-portrait-outline',
  locationServices: 'navigate-outline',
  precise: 'locate-outline',
  battery: 'battery-charging-outline',
  powerSaving: 'leaf-outline',
};

type StepName = 'notifications' | 'location' | 'background' | 'locationServices' | 'precise' | 'battery';

const RaceReadyScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation(['readiness', 'common', 'home']);
  const raceName = route.params?.race_name;
  const source = route.params?.source;
  // Partner races only (numeric product_app_id): which race the steps were for.
  const productAppId = route.params?.product_app_id;

  const [state, setState] = useState<ReadinessState | null>(null);
  const [skipped, setSkipped] = useState<Set<ReadinessItem>>(new Set());
  const [busy, setBusy] = useState(false);
  const seenSteps = useRef<Set<string>>(new Set());
  // Android 11+: the background request went to Settings because the OS
  // showed nothing. Next press goes straight back there, labelled as such.
  const backgroundSentToSettings = useRef(false);
  const finishedLogged = useRef(false);
  // ✅ The real double-tap guard: `busy` is state, so two fast taps both saw
  // false in the same render and ran the step (two OS requests / two
  // Settings trips, two events). Claimed synchronously.
  const busyRef = useRef(false);
  // A step was put off with "Later" — the flow ended with a decision.
  const laterLogged = useRef(false);

  const refresh = useCallback(async () => {
    const next = await readinessService.getState();
    setState(next);
  }, []);

  useEffect(() => {
    void refresh();
    // Back from a Settings page / system dialog — re-read, the grant may have
    // landed there (Android background location, battery exemption).
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const remaining = useMemo(
    () => (state ? state.missing.filter((m) => RACE_READY_ITEMS.includes(m) && !skipped.has(m)) : []),
    [state, skipped],
  );
  const current = (remaining[0] ?? null) as StepName | null;
  if (current) seenSteps.current.add(current);
  const { index: stepIndex, total } = stepProgress(seenSteps.current, remaining);

  const skip = useCallback((item: ReadinessItem) => {
    setSkipped((prev) => new Set(prev).add(item));
  }, []);

  // Done: log once.
  useEffect(() => {
    if (!state || current || finishedLogged.current) return;
    finishedLogged.current = true;
    void analyticsService.logRaceReadyStep(raceReadyOutcome(skipped, state.missing), undefined, source, productAppId);
  }, [state, current, skipped, source, productAppId]);

  const onContinue = useCallback(async () => {
    if (!current || !state || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      switch (current) {
        case 'notifications': {
          if (state.notifications !== 'granted' && !state.notificationsCanAskAgain) {
            void analyticsService.logRaceReadyStep('notifications', 'settings', source, productAppId);
            await notificationPermissionService.openSettings();
            skip('notifications'); // can't confirm from here; card keeps it visible
            break;
          }
          const notifWatch = watchForOsPrompt();
          let res;
          let notifShown = false;
          try {
            res = await notificationPermissionService.request();
          } finally {
            notifShown = notifWatch.done();
          }
          void analyticsService.logRaceReadyStep('notifications', res.status === 'granted' ? 'granted' : 'denied', source, productAppId);
          if (res.status !== 'granted' && !notifShown) {
            // Blocked at system level: no dialog — Settings is the only route.
            await notificationPermissionService.openSettings();
          }
          if (res.status !== 'granted') skip('notifications');
          break;
        }
        case 'location': {
          if (!state.locationCanAskAgain) {
            void analyticsService.logRaceReadyStep('location', 'settings', source, productAppId);
            await openLocationSettingsFor('denied');
            break; // AppState resume re-reads
          }
          // Same "did the OS show anything" test as the other steps: a silent
          // refusal (blocked at system level) must not just skip the step.
          const locWatch = watchForOsPrompt();
          let locShown = false;
          let res;
          try {
            res = await readinessService.requestForegroundLocation();
          } finally {
            locShown = locWatch.done();
          }
          if (!res.granted && !locShown) {
            void analyticsService.logRaceReadyStep('location', 'settings', source, productAppId);
            await openLocationSettingsFor('denied');
            break; // AppState resume re-reads
          }
          void analyticsService.logRaceReadyStep('location', res.granted ? 'granted' : 'denied', source, productAppId);
          if (!res.granted) skip('location');
          break;
        }
        case 'background': {
          // Same request + same "did the OS show anything" test as the
          // start-time popup in HomeScreen (utils/permissionPrompt).
          if (backgroundOpensSettings(Platform.OS, state.locationCanAskAgain, backgroundSentToSettings.current)) {
            void analyticsService.logRaceReadyStep('background', 'settings', source, productAppId);
            await openLocationSettingsFor('no_background_perm');
            break;
          }
          const promptWatch = watchForOsPrompt();
          let osShowed = false;
          let perms;
          try {
            perms = await gpsService.requestPermissionsDetailed();
          } finally {
            osShowed = promptWatch.done();
          }
          if (perms.background) {
            void analyticsService.logRaceReadyStep('background', 'granted', source, productAppId);
          } else if (!osShowed) {
            void analyticsService.logRaceReadyStep('background', 'settings', source, productAppId);
            backgroundSentToSettings.current = true;
            await openLocationSettingsFor('no_background_perm');
          } else {
            void analyticsService.logRaceReadyStep('background', 'denied', source, productAppId);
            skip('background');
          }
          break;
        }
        case 'locationServices': {
          void analyticsService.logRaceReadyStep('locationServices', 'settings', source, productAppId);
          await openLocationSettingsFor('location_off');
          break;
        }
        case 'precise': {
          // No OS dialog can switch precise location back on: only the app's
          // location settings page can (Android "Use precise location",
          // iOS "Precise Location").
          void analyticsService.logRaceReadyStep('precise', 'settings', source, productAppId);
          await openLocationSettingsFor('denied');
          skip('precise'); // re-read on return; the card keeps it visible if still off
          break;
        }
        case 'battery': {
          void analyticsService.logRaceReadyStep('battery', 'settings', source, productAppId);
          await requestBatteryOptimizationExemption();
          // If the runner backs out of the system dialog, don't loop on it.
          const exempt = (await readinessService.getState()).batteryExempt;
          if (exempt === false) skip('battery');
          break;
        }
      }
    } finally {
      try { await refresh(); } finally {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [current, state, skip, refresh, source, productAppId]);

  // Left (back / swipe) before the end and without a single "Later": no
  // outcome event fired at all, so the funnel could not tell an abandoned
  // flow from one never opened. Logged once, on unmount.
  useEffect(() => () => {
    if (finishedLogged.current || laterLogged.current) return;
    void analyticsService.logRaceReadyStep('abandoned', undefined, source, productAppId);
  }, []);

  const onLater = useCallback(() => {
    if (!current || busyRef.current) return;
    laterLogged.current = true;
    void analyticsService.logRaceReadyStep(current, 'later', source, productAppId);
    skip(current);
  }, [current, skip, source, productAppId]);

  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'HomeScreen' }] });
  }, [navigation]);

  // Skipped AND still missing — a skip fixed in Settings meanwhile is done.
  const notDone = state ? raceReadyOutcome(skipped, state.missing) === 'skipped' : false;

  const needsSettings =
    (current === 'notifications' && state?.notifications !== 'granted' && state?.notificationsCanAskAgain === false) ||
    (current === 'location' && state?.locationCanAskAgain === false) ||
    (current === 'background' && backgroundOpensSettings(Platform.OS, state?.locationCanAskAgain, backgroundSentToSettings.current)) ||
    current === 'locationServices' ||
    current === 'precise';

  return (
    <SafeAreaView style={commonStyles.container} edges={['bottom']}>
      <AppHeader title={t('readiness:raceReady.band')} showLogo showBack onBack={close} />
      <ScrollView contentContainerStyle={s.screen} showsVerticalScrollIndicator={false}>
        {!state ? (
          <View style={commonStyles.centerContainer}>
            <ActivityIndicator size="large" color={palette.navy} />
          </View>
        ) : current ? (
          <>
            <Text style={s.intro}>
              {raceName
                ? t('readiness:raceReady.introBody', { race: raceName })
                : t('readiness:raceReady.introBodyNoRace')}
            </Text>
            <View style={s.stepCard}>
              <Text style={s.stepCounter}>
                {t('readiness:raceReady.stepOf', { current: stepIndex, total })}
              </Text>
              <View style={s.stepIconPlate}>
                <Ionicons name={ICONS[current]} size={30} color={palette.navy} />
              </View>
              <Text style={s.stepTitle}>{t(`readiness:raceReady.steps.${current}.title`)}</Text>
              <Text style={s.stepBody}>{t(`readiness:raceReady.steps.${current}.body`)}</Text>
              {/* iOS has no deep link to the phone-wide switch — Settings opens
                  Livio's own page, so say where it is (same text as Start). */}
              {Platform.OS === 'ios' && current === 'locationServices' && (
                <Text style={s.stepBody}>{t('home:gpsHealth.stepsLocationOffIos')}</Text>
              )}
            </View>
            <View style={s.actions}>
              <TouchableOpacity
                style={[commonStyles.primaryButton, busy && { opacity: 0.6 }]}
                onPress={onContinue}
                disabled={busy}
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>
                  {needsSettings ? t('readiness:raceReady.openSettings') : t('readiness:raceReady.continue')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.laterButton} onPress={onLater} disabled={busy} accessibilityRole="button">
                <Text style={s.laterText}>{t('readiness:raceReady.later')}</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={s.stepCard}>
              <View style={s.stepIconPlate}>
                <Ionicons
                  name={notDone ? 'time-outline' : 'checkmark-circle'}
                  size={34}
                  color={palette.navy}
                />
              </View>
              <Text style={s.stepTitle}>
                {notDone
                  ? t('readiness:raceReady.notDoneTitle')
                  : raceName
                    ? t('readiness:raceReady.doneTitle', { race: raceName })
                    : t('readiness:raceReady.doneTitleNoRace')}
              </Text>
              <Text style={s.stepBody}>
                {notDone ? t('readiness:raceReady.doneLater') : t('readiness:raceReady.doneBody')}
              </Text>
            </View>
            <TouchableOpacity
              style={commonStyles.limeButton}
              onPress={close}
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={commonStyles.limeButtonText}>{t('readiness:raceReady.close')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default RaceReadyScreen;
