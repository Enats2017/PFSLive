import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '../../styles/ui.styles';
import { palette } from '../../styles/common.styles';

export type ButtonVariant = 'primary' | 'accent' | 'secondary';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon side. Trailing suits "continue" actions, leading suits "add"/"search". */
  iconPosition?: 'leading' | 'trailing';
  disabled?: boolean;
  loading?: boolean;
  /** Stretch to the container. Off means the button hugs its label. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LABEL_STYLE = {
  primary: ui.btnLabelPrimary,
  accent: ui.btnLabelAccent,
  secondary: ui.btnLabelSecondary,
} as const;

const CONTENT_COLOR = {
  primary: palette.surface,
  accent: palette.ink,
  secondary: palette.navy,
} as const;

const VARIANT_STYLE = {
  primary: ui.btnPrimary,
  accent: ui.btnAccent,
  secondary: ui.btnSecondary,
} as const;

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'leading',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}) => {
  // A press while loading would fire the action twice — treat it as disabled.
  const inert = disabled || loading;
  const glyph = icon ? (
    <Ionicons name={icon} size={18} color={CONTENT_COLOR[variant]} />
  ) : null;

  return (
    <TouchableOpacity
      style={[
        ui.btn,
        VARIANT_STYLE[variant],
        fullWidth && ui.btnFullWidth,
        inert && ui.btnDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={inert}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={CONTENT_COLOR[variant]} />
      ) : (
        <>
          {iconPosition === 'leading' && glyph}
          <Text style={[ui.btnLabel, LABEL_STYLE[variant]]} numberOfLines={1}>
            {label}
          </Text>
          {iconPosition === 'trailing' && glyph}
        </>
      )}
    </TouchableOpacity>
  );
};
