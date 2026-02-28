import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const loginStyles = StyleSheet.create({
  // ✅ CONTAINER
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },

  // ✅ HEADER
  headerSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },

  cardscetion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  logo: {
    width: 80,
    height: 80,
    marginRight: spacing.sm,
  },

  textSection: {
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },

  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
  },

  // ✅ FORM
  formSection: {
    flex: 1,
  },

  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
  },

  forgotText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },

  // ✅ DIVIDER
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray200,
  },

  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },

  // ✅ REGISTER LINK
  registerButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },

  registerText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },

  registerLink: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
});