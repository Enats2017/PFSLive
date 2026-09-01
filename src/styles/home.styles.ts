import { StyleSheet, Platform } from "react-native";
import { spacing, typography, palette, fonts, shadows, radii, space, withAlpha } from "./common.styles";

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
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.md,
  },

  // Section label — small caps on white, as the deck draws in-page sections.
  // ── 01_Home.png: the "YOU FOLLOW" block inside a followed-event card ──
  // The card lists the athletes you follow in that event; the data was already
  // fetched (`followed_participants`) but nothing rendered it.
  followLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.textMuted,
    marginBottom: space.sm,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.sm,
  },
  followAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.fill,
    alignItems: "center",
    justifyContent: "center",
  },
  followAvatarText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: palette.navy,
  },
  followName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.ink,
    flexShrink: 1,
  },
  followBib: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
  },
  followCaption: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    textAlign: "center",
    marginTop: space.sm,
  },

  // ── 02_Home-Tracking-Active.png ───────────────────────
  // Two calm cards: the session clock inside a lime-edged card, then distance
  // and send status. Replaces a diagnostic block of raw coordinates and counters.
  activeCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.lime,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: "center",
    marginBottom: space.md,
    ...shadows.card,
  },
  activeStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.lime,
  },
  activeStatusText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.textBody,
  },
  activeClock: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: palette.ink,
    marginTop: space.md,
  },
  activeEvent: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: space.sm,
    textAlign: "center",
  },
  statCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
    alignItems: "center",
    marginBottom: space.md,
    ...shadows.card,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: palette.ink,
    marginTop: space.sm,
  },
  sendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.lg,
  },
  sendText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
  },
  keepOpenNote: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: space.lg,
    marginBottom: space.xl,
  },
  stopButton: {
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.danger,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stopButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.danger,
  },

  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: palette.textMuted,
  },

  // Logo section
  // Hero block — sits on white directly under the lime band.
  cardscetion: {
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  logo: {
    width: 132,
    height: 32,
  },
  textSection: {
    justifyContent: "center",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 32,
    color: palette.ink,
  },

  // Subtitle
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: space.sm,
  },

  // Event info section
  textContainer: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: space.xl,
    ...shadows.raised,
  },

  // Event Name
  eventInfo: {
    flexDirection: "row",
    gap: space.lg,
    marginTop: space.md,
  },
  eventNameText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    marginTop: space.sm,
  },
  eventLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: palette.textMuted,
  },
  eventValue: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textBody,
  },
  smallText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
  },
  centeredText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    textAlign: "center",
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 20,
    marginTop: space.sm,
  },

  // Tracking Status
  trackingStatus: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: withAlpha(palette.lime, 0.13),
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: "100%",
  },
  trackingStatusIcon: {
    fontFamily: fonts.body,
        fontSize: 15,
    marginRight: spacing.md,
    marginTop: 2,
  },
  trackingStatusText: {
    fontFamily: fonts.bodySemi,
        fontSize: 15,
    color: palette.lime,

        marginBottom: 4,
  },
  trackingLocationText: {
    fontSize: 12,
    color: palette.lime,
    fontFamily: "monospace",
    marginBottom: 4,

        },
  trackingCountText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 12,
    color: palette.lime,

        marginTop: 2,
  },

  permissionWarning: {
    backgroundColor: palette.warningBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
    width: "100%",
  },
  permissionWarningText: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.warning,

        textAlign: "center",
  },

  // Buttons
  button: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    marginTop: space.lg,
  },
  buttonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.surface,
  },

  buttonContainer: {
    paddingHorizontal: space.xl,
    marginTop: 0,
    gap: spacing.md,
  },

  footer: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  footerText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.placeholder,

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
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    ...shadows.card,
  },
  notifIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: withAlpha(palette.navy, 0.08),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  notifTitle: {
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.ink,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  notifBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xxl,
  },
  notifButtonContainer: {
    width: "100%",
    gap: spacing.md,
  },
  notifViewButton: {
    backgroundColor: palette.navy,
  },
  logosSection: {
    marginTop: spacing.md,
    paddingHorizontal: space.xl,
  },
  logosTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontStyle: "italic",
    color: palette.page,
    textTransform: "capitalize",
    letterSpacing: 2,
    textAlign: "center",
  },
  logosContainer: {
    backgroundColor: palette.navy, // ← single dark navy bg
    borderRadius: 10,
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

  section: { paddingBottom: 8 },

  section_followers: { paddingBottom: 8, paddingTop: 20, },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: space.md,
  },

  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventBody: { flex: 1 },
  eventMeta: { flexDirection: "row", alignItems: "center" },
  countdownBlock: { alignItems: "flex-end" },
  countdownValue: {
    fontFamily: fonts.displayMedium,
        fontSize: 15,
    letterSpacing: 0.3,
    color: palette.danger,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: palette.dangerBg,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: palette.danger,
  },
  liveText: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.danger,
    letterSpacing: 0.5,
  },

  divider: {
    height: 0.5,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginVertical: 12,
  },

  followerBtn: {
    backgroundColor: palette.lime,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
     borderRadius: 10,   
  },

  followerText:{
    color: palette.ink,
    fontFamily: fonts.bodySemi,
        fontSize: 15,

        }
});
