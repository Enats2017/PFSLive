// ResultDetails.styles.ts
import { StyleSheet, Dimensions } from "react-native";
import { colors, spacing, typography } from "./common.styles";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.88;

export const resultInfoStyles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    paddingTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  headerBackBtn: {
    width: 32,
  },
  headerCenter: {
    flex: 1,
  },
  headerRightBtn: {
    width: 32,
    alignItems: "flex-end",
  },

  tabBarContent: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  tabItem: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: width / 3,
    position: "relative",
  },
  tabTextActive: {
    color: colors.black,
    fontWeight: typography.weights.bold,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
  },
  pageList: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
  },

  card: {
    width: "97%",
    backgroundColor: colors.white,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    overflow: "hidden",
  },

  headerBar: {
    flexDirection: "row",
  },
  headerGreen: {
    backgroundColor: colors.success,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    width: CARD_WIDTH * 0.42,
    height: CARD_WIDTH * 0.1,
  },
  diagLeft: {
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderTopWidth: 35,
    borderRightWidth: 18,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: colors.success,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  diagRight: {
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderTopWidth: 35,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 18,
    borderTopColor: colors.participantColor,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  headerMiddle: {
    flex: 1,
  },
  headerRed: {
    backgroundColor: colors.participantColor,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
    width: CARD_WIDTH * 0.42,
    height: CARD_WIDTH * 0.1,
  },

  bibCard: {
    alignItems: "center",
    paddingVertical: 15,
  },

  raceTimeText: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    letterSpacing: 1,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  timingPointDate: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    marginTop: spacing.md,
  },

  rankingsCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 24,
  },
  rankingCol: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  rankingColBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gray400,
  },

  statsCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
  },
  statsCol: {
    flex: 1,
    alignItems: "center",
  },
  statsColBorder: {
    paddingVertical: 18,
    borderLeftWidth: 1,
    borderColor: colors.gray300,
  },

  // ── Timeline Styles ──────────────────────────────────────
  leftCol: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
  },

  iconSpacer: {
    height: 158,
  },

  lineTop: {
    width: 2,
    height: 158,
    backgroundColor: colors.primaryLight,
  },

  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  iconCircleDone: {
    backgroundColor: colors.primaryLight,
  },
  iconCirclePending: {
    backgroundColor: colors.primaryLight,
  },

  lineBottomWrap: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    position: "relative",
    minHeight: 200,
  },

  lineBottom: {
    position: "absolute",
    top: 4,
    bottom: 0,
    width: 2,
    backgroundColor: colors.primaryLight,
  },

  // ✅ VERIFIED: Distance Label - Upper position (ORANGE)
  segmentDistanceLabel: {
    position: "absolute",
    top: 150,              // ✅ Upper position
    left: -25,
    width: 80,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  segmentDistanceText: {
    fontSize: 15,
    fontWeight: typography.weights.bold,
    color: colors.primaryLight,     // ✅ ORANGE
    letterSpacing: 0.3,
    transform: [{ rotate: "-90deg" }],
    textAlign: "center",
    width: 80,
  },

  // ✅ VERIFIED: Elevation Label - Lower position (ORANGE)
  segmentElevationLabel: {
    position: "absolute",
    top: 250,             // ✅ Below distance (NOT bottom)
    left: -25,
    width: 80,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  segmentElevationText: {
    fontSize: 13,
    fontWeight: typography.weights.bold,
    color: colors.primaryLight,     // ✅ ORANGE (same as distance)
    letterSpacing: 0.3,
    transform: [{ rotate: "-90deg" }],
    textAlign: "center",
    width: 80,
  },

  // ── Checkpoint Card Styles ──────────────────────────────
  timingcard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    paddingBottom: 4,
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
    paddingVertical: 30,
  },
  twoColLeft: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  verticalDivider: {
    width: 1,
    backgroundColor: colors.gray400,
  },
  twoColRight: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },

  // ── Avatar / Profile ─────────────────────────────────────
  avatarCircle: {
    marginTop: 10,
    width: 120,
    height: 140,
    borderRadius: 15,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },

  initials: {
    marginTop: 10,
    width: 120,
    height: 140,
    borderRadius: 15,
    backgroundColor: colors.gray200,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
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
    backgroundColor: colors.gray400,
  },

  // ── UTMB Badges ──────────────────────────────────────────
  utmbIndexBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  utmbText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  utmbIndexTag: {
    backgroundColor: colors.info,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  utmbIndexText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  utmbValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111",
  },

  utmbSeriesBadge: {
    alignItems: "center",
  },
  utmbSeriesTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1a1a2e",
    letterSpacing: 1,
  },
  utmbSeriesSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1a1a2e",
    letterSpacing: 1,
  },

  // ── Misc ─────────────────────────────────────────────────
  cornerBadge: {
    backgroundColor: colors.info,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomRightRadius: 22,
    marginBottom: 14,
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagEmoji: {
    fontSize: 22,
  },
});