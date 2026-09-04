import { StyleSheet } from "react-native";
import { spacing, typography, type, palette, fonts, shadows, space, radii } from "./common.styles";

export const resultListStyle = StyleSheet.create({
  // 23_ParticipantSearch.png: "6 RESULTS FOR ..." above the list.
  searchCount: {
    ...type.label,
    color: palette.textMuted,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },

  filterRow1: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    backgroundColor: palette.surface,
  },
  filterRow2: {
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 38,
    paddingHorizontal: space.md,
    borderRadius: radii.sm,
    backgroundColor: palette.page,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  tabrow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  filterTabText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.ink,
  },
  statisticsContainer: {
    ...shadows.card,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
    marginHorizontal: space.xl,
    marginTop: space.lg,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
  },

statItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
},

statValue: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    marginBottom: 2,
},

statValueHighlight: {
    color: palette.danger, // make DNF stand out, e.g. red/orange
},

statLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: palette.textMuted,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    lineHeight: 13,
    minHeight: 26,        // two lines — keeps all three values on one baseline
    marginBottom: 4,
},

divider: {
    width: 1,
    height: "100%",
    backgroundColor: palette.placeholder,
},


  filterArrow: { fontFamily: fonts.body,
        fontSize: 13, color: palette.ink, marginLeft: 8 },
  filterArrowOpen: { color: palette.lime },

  popup: {
    ...shadows.card,

    position: "absolute",
    backgroundColor: palette.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.surface,
    zIndex: 999,
    overflow: "hidden",
  },
  popupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  popupRowLast: { borderBottomWidth: 0 },
  popupRowActive: {
    backgroundColor: palette.border,
    marginTop: 12,
  },
  popupRowText: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.ink,
    },
  popupRowTextActive: {
    color: palette.ink,
    fontFamily: fonts.bodySemi,
        fontSize: 13,
        },

  card: {
    ...shadows.card,
    backgroundColor: palette.surface,
    marginBottom: space.md,
    marginHorizontal: space.xl,
    borderRadius: radii.md,
    padding: space.lg,
  },

  // The women's category keeps a left accent; everything else is a plain card.
  cardWithLeftBorder: {
    ...shadows.card,
    backgroundColor: palette.surface,
    marginBottom: space.md,
    marginHorizontal: space.xl,
    borderRadius: radii.md,
    padding: space.lg,
  },

  // ── Row head: rank circle | name + meta | star ────────────────────────
  rowHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
  },
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.lime,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Kept as a no-op: the deck draws every rank circle lime, whatever the
  // race status. Call sites still reference it.
  rankCircleFinished: {},
  rankText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  rankTextFinished: {},
  rankGender: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: palette.ink,
  },

  // Kept so the old corner-badge keys still resolve while callers migrate.
  cornerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  cornerBadgeRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerNum: {
    color: palette.ink,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  cornerGenderRank: {
    color: palette.textMuted,
    fontFamily: fonts.bodySemi,
    fontSize: 10,
  },

  // Keep for backward compat
  cornerWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    zIndex: 20,
  },
  cornerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    zIndex: 15,
    backgroundColor: 'transparent',
  },
  cornerTriangle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 72,
    borderLeftWidth: 72,
    borderTopColor: palette.navy,
    borderLeftColor: "transparent",
  },
  cornerStarBtn: {
    position: "absolute",
    top: 15,
    left: -25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  cornerStarIcon: {
    width: 50,
    height: 50,
  },

  // ── Card Content ──────────────────────────────────────────
  cardTop: {
    flexGrow: 1,
    minWidth: 0,
  },
  cardTopLeft: {
    flexGrow: 1,
    minWidth: 0,
  },
  cardName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },

  bibText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textMuted,
    marginTop: space.xs,
  },
  // The SECOND meta line (club · country · age). `bibText`'s 4pt top margin is
  // the gap to the NAME; between two meta lines a hairline is enough.
  bibTextTight: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textMuted,
    marginTop: 2,
    flexShrink: 1,
  },

  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
  },
  // Same row, as the second meta line.
  metaLineTight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: 2,
  },

  teamText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
  },
  waveText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
  },

  // ✅ The 10px gap belongs to the club/nation + wave BLOCK, not to whichever
  // line happens to render last. `wave` comes from getField() in the RaceResult
  // parser, which returns '' (not null) when the export has no wave column —
  // true for most events — so the wave line is usually absent. Hanging the
  // margin off waveText silently dropped the gap on every non-wave event.
  metaBlock: {
    marginTop: 2,
  },

  // ── Stats Row ─────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    // Holds each column's content clear of the separator beside it. Without a
    // gap the columns sit flush and their text lands on the rules.
    gap: space.md,
    marginTop: space.md,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },

  statCol: {
    flexGrow: 1,
    flex: 1,
  },

  // Separators between the stat columns. These carried borders with NO
  // horizontal padding: `statCol` sets no alignItems, so the text started at
  // x=0 and sat directly on the rule. The padding is what makes them work.
  statColMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.placeholder,
    paddingHorizontal: space.md,
  },

  statColLeft: {
    borderLeftWidth: 1,
    borderColor: palette.placeholder,
    paddingLeft: space.md,
  },

  statFlagMid: {
    borderLeftWidth: 1,
    borderColor: palette.placeholder,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: space.md,
  },

  // Flag is the only remaining column (UTMB was to its left) → no divider.
  statFlagFullNoBorder: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  
  statVal: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
    textAlign: "center",
    marginTop: space.xs,
  },

  beforeRaceLeftHalf: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  utmbSection: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  utmbBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },

  utmbBadgeTextTop: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 10,
    letterSpacing: 0.5,
  },

  utmbBadgeTextBottom: {
    backgroundColor: palette.navy,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
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

  list: {
    paddingTop: 8,
    paddingBottom: 24,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },

  loadingText: {
    color: palette.textBody,
    fontFamily: fonts.body,
        fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },

  errorText: {
    color: palette.textMuted,
    fontFamily: fonts.body,
        fontSize: 13,
    textAlign: "center",
  },

  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 8,
    backgroundColor: palette.navy,
    borderRadius: 10,
  },

  retryText: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 13,
  },

  filterOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },

  flagRow: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  statValSmall: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,

        color: palette.ink,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
});