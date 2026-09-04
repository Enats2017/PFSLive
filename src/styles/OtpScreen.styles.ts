import { StyleSheet, Platform } from 'react-native';
import { spacing, typography, palette, fonts, shadows, space, radii, withAlpha } from './common.styles';

export const optStyles = StyleSheet.create({
  // ✅ CONTAINER
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // ✅ HEADER
  // ── 05_OTP.png: the "Not arrived?" card ────────────────
  // The spam-folder hint and the sending address, plus a way back to change a
  // mistyped email. Without it the only options are wait or start over.
  notArrivedCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    marginTop: space.xl,
    ...shadows.card,
  },
  notArrivedTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
    marginBottom: space.sm,
  },
  notArrivedBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 20,
  },
  notArrivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: palette.border,
    marginTop: space.md,
    paddingTop: space.md,
  },
  notArrivedLink: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.navy,
  },

  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: withAlpha(palette.navy, 0.08),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: withAlpha(palette.navy, 0.19),
  },

  title: {
    fontFamily: fonts.bodySemi,
        fontSize: 26,

        color: palette.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textBody,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },

  email: {
    fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.navy,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // ✅ OTP INPUT
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },

  otpInput: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderWidth: 1.5,
    borderRadius: radii.md,
    borderColor: palette.inputBorder,
    fontFamily: fonts.display,
    fontSize: 26,
    color: palette.ink,
    backgroundColor: palette.surface,
    textAlign: 'center',
    // A TextInput does NOT vertically centre its own text. Android defaults to
    // textAlignVertical 'top' and both platforms add their own vertical padding,
    // so a 26pt digit in a fixed 56pt box sits high in the box rather than in
    // the middle of it. `textAlign` only ever handled the horizontal axis.
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    ...shadows.hairline,
  },

  otpInputFilled: {
    borderColor: palette.navy,
    backgroundColor: withAlpha(palette.navy, 0.06),
  },

  otpInputError: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerBg,
  },

  // ✅ ERROR MESSAGE
  errorText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,

        },

  // ✅ VERIFY BUTTON
  verifyButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  // ✅ RESEND SECTION
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  resendLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textBody,
  },

  resendLink: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.navy,

        },

  countdown: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.textMuted,

        },
});