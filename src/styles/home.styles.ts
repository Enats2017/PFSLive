import { StyleSheet, Platform } from 'react-native';
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
    paddingHorizontal: spacing.lg,
  },

  // Logo section
  cardscetion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    marginBottom: 0,
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
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    textAlign: 'center',
  },

  // Subtitle
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.xxxl,
  },

  // Event info section
  textContainer: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xxxl,
  },

  // Event Name
  eventInfo: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  eventNameText: {
    fontSize: typography.sizes.lg,
    color: colors.black,
    textAlign: 'left',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  eventLabel: {
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  eventValue: {
    fontWeight: typography.weights.semibold,
    color: colors.black,
  },

  smallText: {
    fontSize: typography.sizes.md,
    color: colors.black,
    textAlign: 'left',
    marginBottom: spacing.sm,
    fontWeight: typography.weights.medium,
    paddingLeft: spacing.md,
  },

  centeredText: {
    fontSize: typography.sizes.md,
    color: colors.black,
    textAlign: 'center',
    marginBottom: spacing.sm,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
  },

  heading: {
    fontSize: typography.sizes.md,
    color: colors.black,
    textAlign: 'center',
    marginVertical: spacing.lg,
    lineHeight: 22,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
  },

  tagline: {
    fontSize: typography.sizes.lg,
    color: colors.black,
    textAlign: 'center',
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    lineHeight: 24,
  },

  // Tracking Status
  trackingStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.success + '20',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: '100%',
  },
  trackingStatusIcon: {
    fontSize: 16,
    marginRight: spacing.md,
    marginTop: 2,
  },
  trackingStatusText: {
    fontSize: typography.sizes.md,
    color: colors.success,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  trackingLocationText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontFamily: 'monospace',
    marginBottom: 4,
    fontWeight: typography.weights.medium,
  },
  trackingCountText: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },

  permissionWarning: {
    backgroundColor: colors.warning + '20',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: '100%',
  },
  permissionWarningText: {
    fontSize: typography.sizes.sm,
    color: colors.warning,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },

  // Buttons
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.md,
    elevation: 3,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  buttonContainer: {
    paddingHorizontal: spacing.md,
    marginTop: 0,
    gap: spacing.md,
  },

  footer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.gray400,
    fontWeight: typography.weights.medium,
  },

  // ✅ Notification popup — consistent with SuccessCelebrationModal & UndoConfirmModal
  notifBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  notifWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  notifCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  notifIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  notifTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  notifBody: {
    fontSize: typography.sizes.sm,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  notifButtonContainer: {
    width: '100%',
    gap: spacing.md,
  },
  notifViewButton: {
    backgroundColor: colors.primary,
  },
});