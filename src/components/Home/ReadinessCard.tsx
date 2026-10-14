// src/components/Home/ReadinessCard.tsx
//
// ✅ "Ready to race?" — on the home screen while a race is upcoming and the
// runner is not tracking. Lists only what's missing, each with one tap to fix,
// so problems are found days ahead instead of at the start line.
//
// Fixes route into the Get race-ready flow (which skips anything already
// fine) — one place owns the explain-then-ask sequence. Power saving isn't a
// setup step (it's toggled on race morning), so its button opens the battery
// saver page directly.
//
// Read-only otherwise: the Start gate in HomeScreen is unchanged.

import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { palette } from '../../styles/common.styles';
import { readinessStyles as s } from '../../styles/readiness.styles';
import { readinessService, ReadinessItem, ReadinessState } from '../../services/readinessService';

interface Props {
  raceName?: string;
  /** Android battery-saver page — HomeScreen already owns this route. */
  onOpenPowerSaving: () => void;
}

const ICONS: Record<ReadinessItem, keyof typeof Ionicons.glyphMap> = {
  notifications: 'notifications-outline',
  location: 'location-outline',
  background: 'phone-portrait-outline',
  locationServices: 'navigate-outline',
  battery: 'battery-charging-outline',
  powerSaving: 'leaf-outline',
};

export const ReadinessCard: React.FC<Props> = ({ raceName, onOpenPowerSaving }) => {
  const { t } = useTranslation(['readiness']);
  const navigation = useNavigation<any>();
  const [state, setState] = useState<ReadinessState | null>(null);

  const refresh = useCallback(() => {
    readinessService.getState().then(setState).catch(() => { /* keep last */ });
  }, []);

  // Re-read on focus (back from Get race-ready) and on foreground (back from Settings).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (!state) return null;

  const fix = (item: ReadinessItem) => {
    if (item === 'powerSaving') {
      onOpenPowerSaving();
      return;
    }
    navigation.navigate('RaceReady', { race_name: raceName, source: 'card' });
  };

  if (state.missing.length === 0) {
    return (
      <View style={[s.card, s.allSetRow]}>
        <Ionicons name="checkmark-circle" size={20} color={palette.navy} />
        <Text style={s.allSetText}>{t('readiness:card.allSet')}</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{t('readiness:card.title')}</Text>
      <Text style={s.cardSubtitle}>{t('readiness:card.subtitle')}</Text>
      {state.missing.map((item, i) => (
        <View key={item}>
          {i > 0 && <View style={s.rowDivider} />}
          <View style={s.row}>
            <Ionicons name={ICONS[item]} size={20} color={palette.warning} />
            <View style={s.rowText}>
              <Text style={s.rowLabel}>{t(`readiness:items.${item}`)}</Text>
              <Text style={s.rowWhy}>{t(`readiness:items.${item}Why`)}</Text>
            </View>
            {/* iOS has no public deep link to Low Power Mode — the row's
                text is the instruction there. */}
            {!(item === 'powerSaving' && Platform.OS === 'ios') && (
              <TouchableOpacity
                style={s.fixButton}
                onPress={() => fix(item)}
                accessibilityRole="button"
                accessibilityLabel={`${t('readiness:card.fix')} ${t(`readiness:items.${item}`)}`}
              >
                <Text style={s.fixButtonText}>{t('readiness:card.fix')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};
