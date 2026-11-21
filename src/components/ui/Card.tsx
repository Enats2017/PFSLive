import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { ui } from '../../styles/ui.styles';

/**
 * `elevated` is the default surface. `flat` is for cards sitting on white,
 * where a shadow reads as dirt — they take a hairline border instead.
 * `raised` is for the one card on a screen that must come forward.
 */
export type CardVariant = 'elevated' | 'flat' | 'raised';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

const VARIANT = {
  elevated: ui.card,
  flat: ui.cardFlat,
  raised: ui.cardRaised,
} as const;

export const Card: React.FC<CardProps> = ({ children, variant = 'elevated', style }) => (
  <View style={[VARIANT[variant], style]}>{children}</View>
);
