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
  subtitle: {
    ...type.body,
    marginTop: space.sm,
    marginBottom: space.lg,
  },

  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.fill,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.xl,
  },

  form: {
    width: '100%',
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xl,
    gap: 6,
  },
  backButtonText: {
    ...type.smallMedium,
  },

  email: {
    ...type.h3,
    color: palette.navy,
    marginTop: space.xs,
    marginBottom: space.xxl,
  },

  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: space.md,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: radii.md,
    borderColor: palette.inputBorder,
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.inkSoft,
    backgroundColor: palette.surface,
    textAlign: 'center',
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
