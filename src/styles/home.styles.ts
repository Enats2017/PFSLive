import { StyleSheet, Platform } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const homeStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxxl,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },

  // Logo section
  cardscetion: {
    marginTop: spacing.lg,
    marginBottom: 0,
  },

  logo: {
    width: "100%",
    height: 250,
  },

  textSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    textAlign: "center",
  },

  // Subtitle
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.error,
    fontWeight: typography.weights.semibold,
    textAlign: "center",
    letterSpacing: 1,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },

  // Event info section
  textContainer: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },

  // Event Name
  eventInfo: {
    marginBottom: spacing.md,
  },
  eventNameText: {
    fontSize: typography.sizes.lg,
    color: colors.black,
    flexWrap: "wrap",
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
    textAlign: "left",
    marginBottom: spacing.sm,
    fontWeight: typography.weights.medium,
  },

  centeredText: {
    fontSize: typography.sizes.md,
    color: colors.black,
    textAlign: "center",
    marginBottom: spacing.sm,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
  },

  heading: {
    fontSize: typography.sizes.md,
    color: colors.black,
    textAlign: "center",
    marginVertical: spacing.lg,
    lineHeight: 22,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
  },

  tagline: {
    fontSize: typography.sizes.lg,
    color: colors.black,
    textAlign: "center",
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    lineHeight: 24,
  },

  // Tracking Status
  trackingStatus: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.success + "20",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: "100%",
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
    fontFamily: "monospace",
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
    backgroundColor: colors.warning + "20",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: "100%",
  },
  permissionWarningText: {
    fontSize: typography.sizes.sm,
    color: colors.warning,
    fontWeight: typography.weights.semibold,
    textAlign: "center",
  },

  // Buttons
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: "center",
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
    textTransform: "uppercase",
  },

  buttonContainer: {
    paddingHorizontal: spacing.md,
    marginTop: 0,
    gap: spacing.md,
  },

  footer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
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
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  notifWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  notifCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
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
    backgroundColor: colors.primary + "15",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  notifTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  notifBody: {
    fontSize: typography.sizes.sm,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  notifButtonContainer: {
    width: "100%",
    gap: spacing.md,
  },
  notifViewButton: {
    backgroundColor: colors.primary,
  },
  logosSection: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  logosTitle: {
    fontSize: spacing.md,
    fontStyle: "italic",
    color: colors.gray50,
    textTransform: "capitalize",
    letterSpacing: 2,
    textAlign: "center",
  },
  logosContainer: {
    backgroundColor: colors.primary, // ← single dark navy bg
    borderRadius: 8,
    padding: spacing.md,
  },

  logoBox: {
    width: 135, // fixed width for snapping
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerLogo: {
    width: "135%",
    height: "100%",
  },

  logosRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  section: { paddingBottom: 10 },

  section_followers: { paddingBottom: 10, paddingTop: 20, },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventBody: { flex: 1 },
  eventMeta: { flexDirection: "row", alignItems: "center" },
  countdownBlock: { alignItems: "flex-end" },
  countdownValue: {
    fontSize: 15,
    fontWeight: "500",
    letterSpacing: 0.3,
    color: "#A32D2D",
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FDECEA",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#A32D2D",
  },
  liveText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#A32D2D",
    letterSpacing: 0.5,
  },

  divider: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginVertical: 12,
  },
});
