import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ModalScroll from './ModalScroll';
import { isCompactPopup } from '../../hooks/useLandscapeSidePadding';
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
 * What varies is TONE, and as of the Sep 2026 consistency pass tone lives in
 * the ICON ALONE — the ring behind it is one neutral navy tint on every modal.
 * It used to vary too (danger on dangerBg, warning on warningBg, success on
 * solid lime); that pass replaced each of those with this tint, modal by modal.
 *
 * Change the tint HERE, never at a call site. The first attempt at this pass
 * hardcoded withAlpha(palette.navy, 0.08) into each modal and left these tokens
 * still holding the old colours, so `ring` became a live trap: any modal that
 * read it silently got the pre-pass look back.
 */
export type DialogTone = 'danger' | 'warning' | 'success' | 'info';

/** The one halo colour behind every modal icon, whatever the tone. */
export const RING_TINT = withAlpha(palette.navy, 0.08);

export const dialogTone: Record<DialogTone, { icon: string; ring: string }> = {
  danger: { icon: palette.danger, ring: RING_TINT },
  warning: { icon: palette.warning, ring: RING_TINT },
  success: { icon: palette.ink, ring: RING_TINT },
  info: { icon: palette.navy, ring: RING_TINT },
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
    // The wrapper is a full-screen SIBLING drawn over the backdrop touchable,
    // so it swallowed every tap outside the card — tap-to-close never fired.
    // box-none lets those taps fall through to the backdrop (audit 2026-10-22).
    pointerEvents: 'box-none',
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
    fontSize: 14,
    lineHeight: 22,
    color: palette.textBody,
    textAlign: 'center',
    marginBottom: space.md,
  },
  note: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
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

/**
 * ✅ Compact popups in landscape (device test 2026-10-23, event Distance screen:
 * the Undo registration card was taller than a landscape phone — icon on top,
 * the buttons cut off at the bottom). The same rule as the Home popups
 * (isCompactPopup: any landscape window, or under 500pt tall): no icon, a
 * wider card with tighter gaps, buttons side by side (a third wraps), the
 * wrapper's padding 8 not 20 (ModalScroll reserve 16). Portrait: unchanged.
 *
 *   const cd = useCompactDialog();
 *   <View style={[wrapper, cd.s.wrapper]}>
 *     <ModalScroll style={cd.s.scroll} reserve={cd.reserve}>
 *       <View style={[card, cd.s.card]}>
 *         <View style={[icon, cd.s.hide]} />
 *         <View style={[buttons, cd.s.buttonsRow]}>
 *           <TouchableOpacity style={[button, cd.s.button]} />
 *
 * `s` is empty (every entry undefined) when not compact, so the arrays are
 * exactly the portrait styles there.
 */
export const compactDialogStyles = StyleSheet.create({
  wrapper: { paddingVertical: space.sm },
  scroll: { maxWidth: 520 },
  card: { maxWidth: 520, paddingVertical: space.lg, paddingHorizontal: space.xl },
  hide: { display: 'none' },
  title: { marginBottom: space.sm },
  message: { marginBottom: space.sm },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  // `width: 'auto'` undoes fullWidthButton's 100% so two buttons share the row
  button: { flexGrow: 1, flexBasis: 160, width: 'auto' },
});
type CompactDialogStyles = { [K in keyof typeof compactDialogStyles]?: (typeof compactDialogStyles)[K] };
const NOT_COMPACT: CompactDialogStyles = {};

export const useCompactDialog = (): { compact: boolean; s: CompactDialogStyles; reserve: number } => {
  const { width, height } = useWindowDimensions();
  const compact = isCompactPopup(width, height);
  return { compact, s: compact ? compactDialogStyles : NOT_COMPACT, reserve: compact ? 16 : 40 };
};

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
  const cd = useCompactDialog();

  // ModalScroll: in landscape / larger text the card (90pt icon + copy + two
  // buttons) was taller than the screen — icon off the top, Cancel off the
  // bottom. Fixed here so every <Dialog> user is covered (audit 2026-10-22).
  return (
    <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.reserve}>
      <View style={[dialogStyles.card, cd.s.card]}>
        <View style={[dialogStyles.iconWrapper, { backgroundColor: ring }, cd.s.hide]}>
          <Ionicons name={icon} size={56} color={iconColor} />
        </View>

        <Text style={[dialogStyles.title, cd.s.title]}>{title}</Text>
        {!!message && <Text style={[dialogStyles.message, cd.s.message]}>{message}</Text>}
        {!!note && <Text style={dialogStyles.note}>{note}</Text>}

        {children}

        {(confirmLabel || cancelLabel) && (
          <View style={[dialogStyles.buttons, cd.s.buttonsRow]}>
            {!!confirmLabel && (
              <TouchableOpacity
                style={[
                  commonStyles.primaryButton,
                  dialogStyles.fullWidthButton,
                  cd.s.button,
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
                style={[commonStyles.secondaryButton, cd.s.button]}
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
    </ModalScroll>
  );
};
