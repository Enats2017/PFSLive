import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  palette,
  fonts,
  shadows,
  radii,
  space,
  withAlpha,
  commonStyles,
} from '../../styles/common.styles';

/**
 * The one dialog chrome.
 *
 * Before this, every modal was a hand-copied `<Modal>` and they had drifted:
 * four different card shadows (0.05 → 0.22 opacity, plus four with none at
 * all), five backdrop dim levels between 0.4 and 0.6, and two title fonts.
 * None of it was caught by `npm run design-check`, which verifies that a token
 * was used but not *which* token — so the drift was invisible.
 *
 * The chrome here is fixed and matches the deck: radius 16 with `shadows.overlay`,
 * the token the design system assigns to "modals, floating panels".
 *
 * What varies is TONE, and only tone: the icon and the ring behind it. A
 * destructive confirm must not look like a success, and a success must not look
 * like a neutral notice. Each tone below is the treatment the redesign had
 * already settled on in at least one modal — this only makes it the rule:
 *
 *   danger   ErrorModal            palette.danger  on dangerBg
 *   warning  DeviceTransferModal   palette.warning on warningBg
 *   success  FeedbackSuccessModal  palette.ink     on solid lime (the deck's check-mark lime)
 *   info     UpdateRequiredModal   palette.navy    on a navy tint
 */
export type DialogTone = 'danger' | 'warning' | 'success' | 'info';

export const dialogTone: Record<DialogTone, { icon: string; ring: string }> = {
  danger: { icon: palette.danger, ring: palette.dangerBg },
  warning: { icon: palette.warning, ring: palette.warningBg },
  // Solid lime, not a tint — lime on a lime tint is too low-contrast to read as
  // a status, and the deck names lime as the check-mark colour.
  success: { icon: palette.ink, ring: palette.lime },
  info: { icon: palette.navy, ring: withAlpha(palette.navy, 0.08) },
};

/**
 * Shared chrome for modals that keep their own body (multi-state ones like
 * PurchaseStatus and Registration). Simple confirms should use `<Dialog>`.
 */
export const dialogStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(palette.ink, 0.6),
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...shadows.overlay,
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: radii.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.md,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 21,
    color: palette.textBody,
    textAlign: 'center',
    marginBottom: space.md,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: space.xxl,
  },
  buttons: {
    width: '100%',
    gap: space.sm + 2,
  },
  fullWidthButton: {
    width: '100%',
  },
});

interface DialogProps {
  tone?: DialogTone;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  /** Quieter line under the message — a caveat or consequence. */
  note?: string;
  /** Rendered under the copy, above the buttons. */
  children?: React.ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
  loading?: boolean;
}

/**
 * The body of a simple confirm dialog — icon, copy, and up to two stacked
 * buttons. It deliberately does NOT render `<Modal>`: the modals own their own
 * visibility, animation and dismissal, which differ (some run a custom
 * `Animated` entrance and so pass `animationType="none"`).
 */
export const Dialog: React.FC<DialogProps> = ({
  tone = 'info',
  icon,
  title,
  message,
  note,
  children,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
  loading = false,
}) => {
  const { icon: iconColor, ring } = dialogTone[tone];

  return (
    <View style={dialogStyles.card}>
      <View style={[dialogStyles.iconWrapper, { backgroundColor: withAlpha(palette.navy, 0.08), }]}>
        <Ionicons name={icon} size={56} color={iconColor} />
      </View>

      <Text style={dialogStyles.title}>{title}</Text>
      {!!message && <Text style={dialogStyles.message}>{message}</Text>}
      {!!note && <Text style={dialogStyles.note}>{note}</Text>}

      {children}

      {(confirmLabel || cancelLabel) && (
        <View style={dialogStyles.buttons}>
          {!!confirmLabel && (
            <TouchableOpacity
              style={[
                commonStyles.primaryButton,
                dialogStyles.fullWidthButton,
                loading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color={palette.surface} size="small" />
              ) : (
                <Text style={commonStyles.primaryButtonText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          )}

          {!!cancelLabel && (
            <TouchableOpacity
              style={commonStyles.secondaryButton}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={commonStyles.secondaryButtonText}>{cancelLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};
