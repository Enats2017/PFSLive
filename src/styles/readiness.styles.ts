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
    minHeight: 44,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
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
    minHeight: 32,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixButtonText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
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
    // flexShrink: fr ran past the card beside the icon at 320 (audit 2026-10-22)
    flexShrink: 1,
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
    fontSize: 14,
    color: palette.noticeText,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.navy,
    marginTop: space.md,
    // side padding + text flexShrink: the fr label ran out of the button at
    // 320 from x1.1 text (audit 2026-10-22)
    paddingHorizontal: space.lg,
  },
  shareButtonText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.navy,
    flexShrink: 1,
    textAlign: 'center',
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
  // flex 1 + space-between: tiles stretch to the tallest, so the date / city
  // line sat at different heights and a no-image tile had a blank bottom —
  // the meta line is now pinned to the bottom (audit 2026-10-22, same idea as
  // fan.styles eventCard / eventInfo)
  eventTileBody: {
    flex: 1,
    justifyContent: 'space-between',
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
