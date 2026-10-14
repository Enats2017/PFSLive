import { StyleSheet } from 'react-native';
import { palette, space, radii, fonts, type, shadows, withAlpha } from './common.styles';

// Get race-ready flow, home readiness card, notifications screen, follow
// pre-prompt and the idle-home sections. Tokens only (design-audit).
export const readinessStyles = StyleSheet.create({
  // ── Get race-ready screen ────────────────────────────────────────────────
  screen: {
    flexGrow: 1,
    padding: space.xl,
    gap: space.lg,
  },
  intro: {
    ...type.body,
  },
  stepCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    padding: space.xl,
    alignItems: 'center',
    gap: space.md,
    ...shadows.card,
  },
  stepIconPlate: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(palette.lime, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  stepCounter: {
    ...type.label,
    color: palette.textMuted,
  },
  stepTitle: {
    ...type.h2,
    textAlign: 'center',
  },
  stepBody: {
    ...type.body,
    textAlign: 'center',
  },
  actions: {
    gap: space.md,
    marginTop: space.sm,
  },
  laterButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.textMuted,
  },
  doneNote: {
    ...type.small,
    textAlign: 'center',
  },

  // ── Home readiness card ──────────────────────────────────────────────────
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    marginTop: space.md,
    marginBottom: space.lg,
    ...shadows.card,
  },
  cardTitle: {
    ...type.h3,
  },
  cardSubtitle: {
    ...type.small,
    marginTop: 2,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    gap: space.md,
  },
  rowDivider: {
    height: 1,
    backgroundColor: palette.border,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    ...type.bodyMedium,
    color: palette.ink,
  },
  rowWhy: {
    ...type.small,
  },
  fixButton: {
    paddingHorizontal: space.md,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixButtonText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: palette.surface,
  },
  allSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  allSetText: {
    ...type.bodyMedium,
    color: palette.ink,
  },

  // ── Countdown + share (home, upcoming race) ──────────────────────────────
  countdownPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radii.pill,
    backgroundColor: palette.noticeBg,
    marginTop: space.sm,
  },
  countdownText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.noticeText,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.navy,
    marginTop: space.md,
  },
  shareButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.navy,
  },

  // ── Notifications screen ─────────────────────────────────────────────────
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  statusTitle: {
    ...type.h3,
    flex: 1,
  },
  statusBody: {
    ...type.body,
    marginTop: space.sm,
  },

  // ── Follow pre-prompt (bottom sheet) ─────────────────────────────────────
  sheetBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(palette.ink, 0.45),
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: space.xl,
    gap: space.md,
    alignItems: 'center',
  },

  // ── Idle home (no upcoming race) ─────────────────────────────────────────
  sectionLabel: {
    ...type.label,
    color: palette.textMuted,
    marginBottom: space.sm,
    marginTop: space.md,
  },
  emptyTitle: {
    ...type.h3,
  },
  emptyBody: {
    ...type.body,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  eventRow: {
    gap: space.md,
    paddingBottom: space.sm,
  },
  eventTile: {
    width: 220,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  eventImage: {
    width: '100%',
    height: 96,
    backgroundColor: palette.fill,
  },
  eventTileBody: {
    padding: space.md,
    gap: 2,
  },
  eventTileName: {
    ...type.h3Medium,
  },
  eventTileMeta: {
    ...type.small,
  },
});
