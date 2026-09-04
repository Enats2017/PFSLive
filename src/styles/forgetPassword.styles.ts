import { StyleSheet } from "react-native";
import { palette, radii, space, fonts, type, shadows } from "./common.styles";

// ✅ Redesign: 12_ForgotPassword.png. The peach-tinted OTP boxes and the
// orange-ringed icon circle are gone — the flow now uses the neutral fill and
// the navy/lime pair like every other screen.
export const forgotStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },

  // ── 06_ForgotPassword.png: "What happens next" ─────────
  // Three numbered steps. A reset flow that says nothing about the next screen
  // is where people give up and mail support instead.
  nextCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    marginTop: space.xl,
    ...shadows.card,
  },
  nextTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
    marginBottom: space.md,
  },
  nextRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  nextNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextNumText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: palette.navy,
  },
  nextStepTitle: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.ink,
  },
  nextStepSub: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },

  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border,
  },
  // Lime marks progress, matching the badge language: lime = positive state.
  progressActive: {
    backgroundColor: palette.lime,
  },

  scroll: {
    flexGrow: 1,
    paddingVertical: space.lg,
  },

  title: {
    ...type.h1,
  },
  // Reviewer note (2026-09-04): centre the step header. NOTE this differs from
  // 06_ForgotPassword.png, which draws the title and description left-aligned.
  stepTitle: {
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    marginTop: space.sm,
    marginBottom: space.lg,
    textAlign: 'center',
  },

  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.fill,
    justifyContent: 'center',
    alignItems: 'center',
    // The title and description below are centred (review note), so a
    // left-hugging icon left the whole header block lopsided.
    alignSelf: 'center',
    marginBottom: space.xl,
  },

  form: {
    width: '100%',
  },

  // Had NO vertical padding at all - the touch target was the 18pt text line.
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    minHeight: 44,
    marginTop: space.xl,
    gap: 6,
  },

  backButtonText: {
    ...type.smallMedium,
  },

  // Sits directly under the centred subtitle, so it centres with it - matching
  // how the registration OTP screen draws the same line (OtpScreen.styles.ts).
  email: {
    ...type.h3,
    color: palette.navy,
    textAlign: 'center',
    marginTop: space.xs,
    marginBottom: space.xxl,
  },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: space.md,
  },
  // Same control as the registration OTP box (OtpScreen.styles.ts) - it was
  // 20pt in a softer ink, so the two screens drew the same field differently.
  otpInput: {
    width: 48,
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
  },
  // A filled box reads as progress, so it takes the navy edge — not a tint,
  // which fought the error state at a glance.
  otpFilled: {
    borderColor: palette.navy,
  },
  otpError: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerBg,
  },

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
    gap: 6,
  },
  errorText: {
    ...type.smallMedium,
    color: palette.danger,
  },

  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    marginTop: space.xl,
    marginBottom: space.md,
  },
  resendLabel: {
    ...type.small,
  },
  resendLink: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: palette.navy,
  },
  countdown: {
    ...type.smallMedium,
    color: palette.placeholder,
  },

  buttonDisabled: {
    opacity: 0.7,
  },
});
