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

type Props = NativeStackScreenProps<RootStackParamList, 'RaceReady'>;

const ICONS: Record<ReadinessItem, keyof typeof Ionicons.glyphMap> = {
  notifications: 'notifications-outline',
  location: 'location-outline',
  background: 'phone-portrait-outline',
  locationServices: 'navigate-outline',
  battery: 'battery-charging-outline',
  powerSaving: 'leaf-outline',
};

type StepName = 'notifications' | 'location' | 'background' | 'locationServices' | 'battery';

const RaceReadyScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation(['readiness', 'common', 'home']);
  const raceName = route.params?.race_name;
  const source = route.params?.source;

  const [state, setState] = useState<ReadinessState | null>(null);
  const [skipped, setSkipped] = useState<Set<ReadinessItem>>(new Set());
  const [busy, setBusy] = useState(false);
  const seenSteps = useRef<Set<string>>(new Set());
  // Android 11+: the background request went to Settings because the OS
  // showed nothing. Next press goes straight back there, labelled as such.
  const backgroundSentToSettings = useRef(false);
  const finishedLogged = useRef(false);

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
    void analyticsService.logRaceReadyStep(raceReadyOutcome(skipped, state.missing), undefined, source);
  }, [state, current, skipped, source]);

  const onContinue = useCallback(async () => {
    if (!current || !state || busy) return;
    setBusy(true);
    try {
      switch (current) {
        case 'notifications': {
          if (state.notifications !== 'granted' && !state.notificationsCanAskAgain) {
            void analyticsService.logRaceReadyStep('notifications', 'settings', source);
            await notificationPermissionService.openSettings();
            skip('notifications'); // can't confirm from here; card keeps it visible
            break;
          }
          const res = await notificationPermissionService.request();
          void analyticsService.logRaceReadyStep('notifications', res.status === 'granted' ? 'granted' : 'denied', source);
          if (res.status !== 'granted') skip('notifications');
          break;
        }
        case 'location': {
          if (!state.locationCanAskAgain) {
            void analyticsService.logRaceReadyStep('location', 'settings', source);
            await openLocationSettingsFor('denied');
            break; // AppState resume re-reads
          }
          const res = await readinessService.requestForegroundLocation();
          void analyticsService.logRaceReadyStep('location', res.granted ? 'granted' : 'denied', source);
          if (!res.granted) skip('location');
          break;
        }
        case 'background': {
          // Same request + same <700ms "the OS showed nothing" test as the
          // start-time modal in HomeScreen.
          if (backgroundOpensSettings(Platform.OS, state.locationCanAskAgain, backgroundSentToSettings.current)) {
            void analyticsService.logRaceReadyStep('background', 'settings', source);
            await openLocationSettingsFor('no_background_perm');
            break;
          }
          const t0 = Date.now();
          const perms = await gpsService.requestPermissionsDetailed();
          if (perms.background) {
            void analyticsService.logRaceReadyStep('background', 'granted', source);
          } else if (Date.now() - t0 < 700) {
            void analyticsService.logRaceReadyStep('background', 'settings', source);
            backgroundSentToSettings.current = true;
            await openLocationSettingsFor('no_background_perm');
          } else {
            void analyticsService.logRaceReadyStep('background', 'denied', source);
            skip('background');
          }
          break;
        }
        case 'locationServices': {
          void analyticsService.logRaceReadyStep('locationServices', 'settings', source);
          await openLocationSettingsFor('location_off');
          break;
        }
        case 'battery': {
          void analyticsService.logRaceReadyStep('battery', 'settings', source);
          await requestBatteryOptimizationExemption();
          // If the runner backs out of the system dialog, don't loop on it.
          const exempt = (await readinessService.getState()).batteryExempt;
          if (exempt === false) skip('battery');
          break;
        }
      }
    } finally {
      await refresh();
      setBusy(false);
    }
  }, [current, state, busy, skip, refresh, source]);

  const onLater = useCallback(() => {
    if (!current) return;
    void analyticsService.logRaceReadyStep(current, 'later', source);
    skip(current);
  }, [current, skip, source]);

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
    current === 'locationServices';

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
