// ResultDetails.styles.ts
import { StyleSheet, Dimensions } from "react-native";
import { spacing, typography, type, palette, space, radii, fonts, shadows } from "./common.styles";

const { width, } = Dimensions.get("window");
const CARD_WIDTH = width * 0.88;
const isTablet = width >= 600;
const DIAG_SIZE = isTablet ? 70 : 35;

export const resultInfoStyles = StyleSheet.create({
  scrollContent: {
    padding: space.xl,
    paddingBottom: space.xxxl,
    backgroundColor: palette.page,
    flexGrow: 1,
  },
  text: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: palette.navy,
    textAlign: "center",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    backgroundColor: palette.surface,
  },
  headerCenter: {
    flex: 1,
  },

  // Runner identity under the band — the event name is in the band itself.
  runnerMeta: {
    ...type.body,
    color: palette.textMuted,
  },
  headerRightBtn: {
    width: 32,
    alignItems: "flex-end",
  },
  tabStrip: {
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },

  tabBarContent: {
    flexDirection: "row",
    gap: space.xxl,
    paddingHorizontal: space.xl,
    // Matches `tabBarUnderline` in details.styles.ts / event.ts — the in-page
    // tab strip has one vertical rhythm wherever it appears.
    paddingTop: space.lg,
    backgroundColor: palette.surface,
  },
  tabItem: {
    paddingBottom: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  // ✅ Redesign: these are IN-PAGE content tabs, so the active state is the
  // lime underline — not the navy pill used for filter groups.
  tabItemActive: {
    borderBottomColor: palette.lime,
  },
  tabText: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    color: palette.textMuted,
  },
  tabTextActive: {
    fontFamily: fonts.display,
    color: palette.ink,
  },
  // 29_RaceInfo.png: the performance card closes with a full-width outlined
  // button, inset to the card's own padding and separated from the last row.
  shareRow: {
    // `card` already supplies the horizontal padding the rows sit in, so
    // the button only needs separating from the last row above it.
    paddingTop: space.lg,
  },
  pageList: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    // 29_RaceInfo.png leaves ~20pt between stacked cards. At 12 the sections ran
    // together, which is the "clearer section separation" the review asks for.
    marginBottom: space.xl,
    ...shadows.card,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginBottom: space.md,
  },
  headerGreen: {
    backgroundColor: palette.fill,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  headerRed: {
    backgroundColor: palette.fill,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  // Label left, value right — the deck's detail row. It was a centred stack.
  bibCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
    paddingVertical: space.sm,
    minHeight: 36,
  },

  // 28_RunnerInfo.png centres the whole identity block: avatar, then the name
  // below it, then the country under the name. The name and country used to sit
  // in a `bibCard` - a space-between row - so the country was flung to the far
  // edge of the card, nowhere near the name it belongs to (review note
  // 2026-09-04: "name below the profile image, country and flag alongside").
  identityBlock: {
    alignItems: "center",
    marginTop: space.md,
  },
  identityName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: "center",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xs,
  },
  // Small-caps section label at the head of a card (29_RaceInfo.png).
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.textMuted,
    marginBottom: space.md,
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingTop: space.sm,
  },


  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textBody,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },

  statLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: palette.textMuted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  raceTimeText: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
  },
  timingPointDate: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
  },

  rankingsCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 24,
  },
  // 28_RunnerInfo.png DOES rule this two-column block, so the border stays -
  // but the columns need real clearance from it, not 4pt.
  rankingCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: space.md,
  },
  rankingColBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.placeholder,
  },

  statsCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  statsCol: {
    flex: 1,
    alignItems: "center",
  },
  statsColBorder: {
    paddingVertical: 16,
    borderLeftWidth: 1,
    borderColor: palette.inputBorder,
  },

  // ── Timeline Styles ──────────────────────────────────────
  // The timeline rail: narrow gutter, card takes the rest.
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space.md,
  },

  iconCirclePending: {
    backgroundColor: palette.navyLift,
  },






  // ── 30_CheckpointHistory.png: card head ────────────────
  // The mockup drops the timeline rail entirely. Each checkpoint is a plain
  // card: a rounded-square status badge, the name over its distance, and the
  // race time over the ranking on the right.
  cpHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
  },
  cpBadge: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  cpBadgeFinish: {
    backgroundColor: palette.navy,
  },
  cpBadgePending: {
    backgroundColor: palette.fill,
  },
  cpHeadText: {
    flex: 1,
    minWidth: 0,
  },
  cpName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  cpSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },
  cpRight: {
    alignItems: "flex-end",
  },
  cpTime: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  cpRank: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },
  cpDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: space.md,
  },

  // ── Checkpoint Card Styles ──────────────────────────────
  timingcard: {
    ...shadows.card,
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    marginBottom: space.md,
  },
  // The checkpoint's own name — `bibCard` is a label/value ROW and cannot
  // carry a title.
  checkpointName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
    marginBottom: space.sm,
  },

  singleRow: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  twoColRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  twoColLeft: {
    flex: 1,
    gap: space.xs,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: palette.border,
  },
  twoColRight: {
    flex: 1,
    gap: space.xs,
    paddingLeft: space.md,
  },

  // ── Avatar / Profile ─────────────────────────────────────
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },

  initials: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.fill,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  // Deck: 26px display type in navy. This was `palette.danger` — crimson
  // initials on grey, a colour the deck uses only for DNF/error states.
  initialsText: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: palette.navy,
    letterSpacing: 1,
  },

  // ── Row / Col Layout ─────────────────────────────────────
  row: {
    flexDirection: "row",
    marginBottom: 20,
  },
  col: {
    flex: 1,
    alignItems: "center",
    gap: 12,
  },
  colDivider: {
    width: 1,
    backgroundColor: palette.placeholder,
  },

  // ── UTMB Badges ──────────────────────────────────────────
  utmbIndexBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  utmbText: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    letterSpacing: 0.5,
  },
  utmbIndexTag: {
    backgroundColor: palette.navy,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  utmbIndexText: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 11,
    letterSpacing: 0.5,
  },
  utmbValue: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
  },

  utmbSeriesBadge: {
    alignItems: "center",
  },
  utmbSeriesTitle: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.ink,
    letterSpacing: 1,
  },
  utmbSeriesSub: {
    fontFamily: fonts.bodySemi,
        fontSize: 10,
    color: palette.ink,
    letterSpacing: 1,
  },

  // ── Misc ─────────────────────────────────────────────────
  cornerBadge: {
    backgroundColor: palette.navy,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomRightRadius: 16,
    marginBottom: space.md,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagEmoji: {
    fontFamily: fonts.body,
        fontSize: 20,
  },
  mapButton: {
    height: 56,
    borderRadius: radii.md,
    backgroundColor: palette.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: space.md,
    marginBottom: space.md,
  },
  mapButtonText: {
    color: palette.ink,
    fontFamily: fonts.display,
    fontSize: 15,
  },

singleColumn: {
    width: '100%',
    alignItems: 'center',
},

});