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
  // 02_Home-Tracking-Active.png sets the event line at 15, not caption size -
  // it is the only thing on the card that says WHICH race is being tracked.
  activeEvent: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
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
  // The home body is a LAYOUT container, not a card. It used to be a white
  // rounded panel with its own shadow, so the next-session card - itself white
  // with a shadow - sat inside a second white card, and the whole block ran
  // edge to edge with no page gutter. 01_Home.png puts the cards on the page
  // tint, inset 20pt, with even spacing between them.
  textContainer: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.md,
  },

  // ── Next-session card (01_Home.png) ──────────────────────────────────────
  // Review note 2026-09-04: the name rendered at 13 (body) and the date at 12,
  // while the description below them ran at 20 (display) - the card read upside
  // down. The deck's ramp is name 26 / meta 15 / description 15.
  eventName: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: palette.ink,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  eventMetaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: palette.textBody,
  },
  // Separates the event's identity from the instruction below it.
  cardDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: space.lg,
  },
  eventDescription: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textMuted,
    lineHeight: 22,
  },

  centeredText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    textAlign: "center",
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
  // Icon + value, one per line (time, distance). It had no gap, so the icon sat
  // against its text, and the two rows carried ad-hoc inline margins that made
  // the spacing between them uneven. Matches `eventMetaRow` on the
  // next-session card.
  eventMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
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
    height: 1,
    backgroundColor: palette.border,
    marginVertical: space.md,
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
