import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const homeStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  logo: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    color: colors.gray500,
  },
  languageSection: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  languageLabel: {
    fontSize: typography.sizes.md,
    color: colors.gray500,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: typography.sizes.xl,
    color: colors.black,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    fontWeight: typography.weights.medium,
  },
  cardsContainer: {
    gap: spacing.xl,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xxl,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconText: {
    fontSize: 40,
  },
  cardTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginBottom: spacing.sm,
  },
  cardDescription: {
    fontSize: typography.sizes.md,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  
  // GPS Tracking Status
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.success + '20',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginBottom: spacing.md,
    width: '100%',
  },
  trackingStatusIcon: {
    fontSize: 12,
    marginRight: spacing.sm,
    marginTop: 2,
  },
  trackingStatusText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  trackingLocationText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  trackingCountText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
  },
  
  // Permission Warning
  permissionWarning: {
    backgroundColor: colors.warning + '20',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    marginBottom: spacing.md,
    width: '100%',
  },
  permissionWarningText: {
    fontSize: typography.sizes.sm,
    color: colors.warning,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  },
  
  // Buttons
  cardButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  cardButtonStop: {
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  cardButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  cardButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cardButtonSecondaryText: {
    color: colors.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  
  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray400,
  },
});