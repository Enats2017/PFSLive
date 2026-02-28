import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const optStyles = StyleSheet.create({
  // ✅ CONTAINER
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },

  // ✅ HEADER
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary + '30',
  },

  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xs,
  },

  email: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
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
    borderRadius: 12,
    borderColor: colors.gray300,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    backgroundColor: colors.white,
    textAlign: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },

  otpInputError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },

  // ✅ ERROR MESSAGE
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontWeight: typography.weights.medium,
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
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },

  resendLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },

  countdown: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.semibold,
  },
});