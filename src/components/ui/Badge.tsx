import React from 'react';
import { Text, View, StyleProp, ViewStyle } from 'react-native';
import { ui } from '../../styles/ui.styles';

/**
 * Badge tones carry meaning, per the design system:
 * lime = live or positive · ink = rank · neutral = anything settled ·
 * danger = a true failure (DNF) · warning = pending.
 */
export type BadgeTone = 'ink' | 'lime' | 'neutral' | 'danger' | 'warning';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  /** Draw the label in caps — for status words, not for data like a bib or time. */
  caps?: boolean;
  style?: StyleProp<ViewStyle>;
}

const BOX = {
  ink: ui.badgeInk,
  lime: ui.badgeLime,
  neutral: ui.badgeNeutral,
  danger: ui.badgeDanger,
  warning: ui.badgeWarning,
} as const;

const TEXT = {
  ink: ui.badgeTextInk,
  lime: ui.badgeTextLime,
  neutral: ui.badgeTextNeutral,
  danger: ui.badgeTextDanger,
  warning: ui.badgeTextWarning,
} as const;

export const Badge: React.FC<BadgeProps> = React.memo(({ label, tone = 'neutral', caps = false, style }) => (
  <View style={[ui.badge, BOX[tone], style]}>
    <Text style={[ui.badgeText, caps && ui.badgeTextCaps, TEXT[tone]]} numberOfLines={1}>
      {label}
    </Text>
  </View>
));

Badge.displayName = 'Badge';
