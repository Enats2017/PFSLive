import { Platform, StyleSheet,Dimensions } from "react-native";
import { colors, spacing, typography } from "../styles/common.styles";
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isTablet = SCREEN_WIDTH >= 600 && SCREEN_WIDTH <= 768; 
const DIAG_SIZE = isTablet ? 162 : 140;

export const favstyle = StyleSheet.create({

  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.01,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },
    }),
    shadowRadius: 10,
    elevation: 3,
    paddingBottom: 10,
    marginBottom:spacing.md
  },

  // ── Diagonal header ──────────────────────────────────────
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 120,
    height: 33,
    zIndex: 3,
  },

  // ✅ Header label text (status + distance)
  headerText: {
    fontSize: typography.sizes.md,
    fontWeight: "600",
  },

  diagLeft: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 33,
    borderRightWidth: 20,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    zIndex: 2,
  },

  headerMiddle: {
    flex: 1,
  },

  diagRight: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 33,
    borderRightWidth: 0,
    borderLeftWidth: 20,
    borderTopColor: colors.primary,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    zIndex: 2,
  },

  headerRight: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 120,
    height: 33,
    zIndex: 1,
  },

  // ── Star + rank badge (interactive) ──────────────────────
  cornerBadge: {
    position: "absolute",
    top: 45,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    zIndex: 20,
    gap: 8,
    minWidth: 56,
    justifyContent: "center",
  },

  cornerStar: {
    fontSize: 26,
    color: "#FFD700",
  },

  cornerStarUnfilled: {
    fontSize: 26,
    color: "#FFFFFF",
  },

  cornerBadgeRight: {
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 2,
  },

  cornerNum: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },

  cornerGenderRank: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 14,
  },

  // ── Body ─────────────────────────────────────────────────
  bodyRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },

  bodyLeft: {
    flex: 1,
    paddingRight: 90, // ✅ leave room for the badge on the right
  },

  runnerName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray900,
  },

  bibText: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 4,
  },

  nationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },

  nationText: {
    fontSize: 12,
    color: colors.gray500,
    flexShrink: 1,
  },

  // ── Separator ────────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: colors.gray200,
    marginHorizontal: 16,
  },

  // ── Stats row (3 columns) ────────────────────────────────
  statsRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },

  statCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  statColMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gray300,
  },

  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.gray500,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  statVal: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray900,
    textAlign: "center",
  },

  // ── Finish time (kept for backward compatibility) ────────
  finishTime: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
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
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Legacy styles kept for any other consumers ───────────
  body: {
    alignItems: "center",
    paddingTop: 10,
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
    backgroundColor: colors.gray200,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  profileInitials: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray700,
  },

  bibBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },

  content: {
    flex: 1,
    marginLeft: 10,
  },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },

  righticon: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  addBtnActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
  },

  participantcard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 5,
    marginVertical: 5,
    marginTop:spacing.sm,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});