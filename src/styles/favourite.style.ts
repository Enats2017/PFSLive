import { Platform, StyleSheet,Dimensions } from "react-native";
import { spacing, typography, palette, fonts, shadows, space, radii } from "../styles/common.styles";
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 600 && SCREEN_WIDTH <= 768; 
const DIAG_SIZE = isTablet ? 162 : 140;

export const favstyle = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    marginBottom: space.md,
    // The lime left edge marks an athlete row, as drawn in the deck.
    borderLeftWidth: 3,
    borderLeftColor: palette.lime,
    ...shadows.card,
  },

  // ── Card header: status chip + distance chip ─────────────
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
    marginBottom: space.md,
  },

  // 25_Favourites.png: one identity row — avatar, name, "Bib · distance",
  // status badge — rather than a chip band above the body.
  // 25_Favourites.png: the sentence under the band, and the initials avatar
  // on each card. Neither existed.
  subHeader: {
    backgroundColor: palette.surface,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  subHeaderText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textMuted,
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.fill,
    alignItems: "center",
    justifyContent: "center",
    // No marginRight: `identityRow` already supplies the gap, and having both
    // took 24pt out of the name column instead of 12.
  },
  cardAvatarText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.navy,
  },

  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },

  // The status chip and the star/rank badge used to sit SIDE BY SIDE at the end
  // of the row, so together with the avatar they took 220 of the card's 315pt
  // and left 95pt for the name - every name and bib line was cropped. Stacked,
  // they take the width of the wider one instead of the sum of both.
  identityMeta: {
    alignItems: "flex-end",
    justifyContent: "center",
    // Never give up width to a long name: `identityText` truncates instead.
    flexShrink: 0,
    gap: space.sm,
  },
  headerLeft: {
    borderRadius: radii.sm,
    paddingHorizontal: space.md,
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  // ✅ Header label text (status + distance)
  headerText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  headerRight: {
    backgroundColor: palette.fill,
    borderRadius: radii.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },

  // ── Star + rank badge (interactive) ──────────────────────
  cornerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },



  cornerBadgeRight: {
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 2,
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

  // ── Body ─────────────────────────────────────────────────
  bodyRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },

  bodyLeft: {
    flex: 1,
    paddingRight: 88, // ✅ leave room for the badge on the right
  },

  // 15, matching resultListStyle.cardName and detailsStyles.rowName - this is
  // the same athlete row, and at 20 it needed ~143pt for a 13-character name.
  runnerName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },

  bibText: {
    fontFamily: fonts.body,
        fontSize: 12,
    color: palette.textMuted,
    marginTop: 4,
  },

  // Meta line 1 (bib · distance), under the name.
  metaLine: {
    marginTop: space.xs,
  },
  // Meta line 2 (flag · country · age). 8pt was the gap to the NAME when this
  // was the only meta line; as the second of two it only needs a hairline.
  nationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },

  nationText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textMuted,
    flexShrink: 1,
  },

  // ── Separator ────────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: palette.border,
    // Spans the card's content width - the card already supplies the inset.
    marginHorizontal: 0,
    marginTop: space.md,
    marginBottom: space.lg,
  },

  // ── Stats row (3 columns) ────────────────────────────────
  statsRow: {
    flexDirection: "row",
    gap: space.md,
  },

  // 25_Favourites.png left-aligns the three stat columns under the divider;
  // centring them left ragged gaps that read as uneven spacing.
  statCol: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },

  // The middle column carries the separators. It originally had the borders and
  // NO horizontal padding, so once the columns were left-aligned its label and
  // value sat hard against the left rule. The padding is what makes the rules
  // work - never add the borders back without it.
  //
  // Columns 1 and 3 need nothing: `statsRow`'s 12pt gap already holds their
  // content clear of the rules on either side.
  statColMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: palette.inputBorder,
    paddingHorizontal: space.md,
  },

  statLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: palette.textMuted,
    textAlign: "left",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: space.xs,
  },

  statVal: {
    fontFamily: fonts.bodySemi,
    fontSize: 20,
    color: palette.ink,
    textAlign: "left",
  },

  // ── Finish time (kept for backward compatibility) ────────
  finishTime: {
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.navy,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // ── Add button (FAB) ─────────────────────────────────────
  addButtonContainer: {
    position: "absolute",
    bottom: DIAG_SIZE,
    right: 25,
  },

  addButton: {
    ...shadows.card,

    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: palette.navy,
    justifyContent: "center",
    alignItems: "center",
  },

  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Legacy styles kept for any other consumers ───────────
  body: {
    alignItems: "center",
    paddingTop: 8,
  },

  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },

  profilePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.border,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  profileInitials: {
    fontFamily: fonts.display,
        fontSize: 26,
    color: palette.textBody,
  },

  bibBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: palette.fill,
    justifyContent: "center",
    alignItems: "center",
  },
  bibBoxText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.navy,
  },
  participantMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: palette.inputBorder,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },

  righticon: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  addBtnActive: {
    borderColor: palette.navy,
    // Was a bright-blue tint under a navy border — the blue is retired.
    backgroundColor: palette.fill,
  },

  participantcard: {
    ...shadows.card,
    flexDirection: "row",
    alignItems: "center",
    // 12pt padding and an 8pt marginLeft on the text block, against the 16/12
    // every other card in the app uses.
    gap: space.md,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.lime,
    padding: space.lg,
    marginTop: space.md,
    marginHorizontal: space.xl,
  },
});