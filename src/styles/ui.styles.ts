import { StyleSheet } from 'react-native';
import { palette, radii, shadows, space, fonts, type } from './common.styles';

// ✅ Styles for the shared redesign components in src/components/ui.
// Every value here comes from the approved artboards — if a screen needs a
// variant that isn't here, add it here rather than styling inline.
export const ui = StyleSheet.create({
  // ── Card ───────────────────────────────────────────────────────────────
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    ...shadows.card,
  },
  cardFlat: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: palette.border,
  },
  cardRaised: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    ...shadows.raised,
  },

  // ── Button ─────────────────────────────────────────────────────────────
  btn: {
    height: 48,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  btnFullWidth: {
    alignSelf: 'stretch',
  },
  btnPrimary: {
    backgroundColor: palette.navy,
  },
  btnAccent: {
    backgroundColor: palette.lime,
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.navy,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnLabel: {
    fontFamily: fonts.display,
    fontSize: 15,
  },
  btnLabelPrimary: { color: palette.surface },
  btnLabelAccent: { color: palette.ink },
  btnLabelSecondary: { color: palette.navy },

  // ── Badge ──────────────────────────────────────────────────────────────
  badge: {
    borderRadius: radii.sm,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
  },
  // Status badges (LIVE, TODAY) are drawn in caps. The uppercasing lives here
  // rather than in the string so fr/nl capitalise by their own rules — and so a
  // badge carrying data (a bib, a time, "Wave 2") is not shouted at.
  badgeTextCaps: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  badgeInk:     { backgroundColor: palette.navy },
  badgeLime:    { backgroundColor: palette.lime },
  badgeNeutral: { backgroundColor: palette.fill },
  badgeDanger:  { backgroundColor: palette.dangerBg },
  badgeWarning: { backgroundColor: palette.warningBg },
  badgeTextInk:     { color: palette.surface },
  badgeTextLime:    { color: palette.ink },
  badgeTextNeutral: { color: palette.textBody },
  badgeTextDanger:  { color: palette.danger },
  badgeTextWarning: { color: palette.warning },

  // ── List row ───────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: palette.page,
    borderRadius: radii.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  rowAccent: {
    borderLeftWidth: 3,
    borderLeftColor: palette.lime,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...type.h3,
  },
  rowSubtitle: {
    ...type.small,
    marginTop: 2,
  },

  // Fully-round elements sit outside the radius scale on purpose.
  rank: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },

  // ── Segmented filter ───────────────────────────────────────────────────
  segment: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    gap: space.xs,
    backgroundColor: palette.page,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.pill,
    padding: space.xs,
  },
  segmentItem: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
  },
  segmentItemActive: {
    backgroundColor: palette.navy,
  },
  segmentLabel: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    color: palette.textMuted,
  },
  segmentLabelActive: {
    fontFamily: fonts.display,
    color: palette.surface,
  },

  // ── Empty state ────────────────────────────────────────────────────────
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  emptyRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: palette.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...type.h3,
    marginTop: space.lg,
    textAlign: 'center',
  },
  emptyBody: {
    ...type.body,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 260,
  },
  emptyAction: {
    marginTop: space.xl,
  },
});
