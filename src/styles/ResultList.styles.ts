import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const resultListStyle = StyleSheet.create({
  filterRow1: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },
  filterRow2: {
    flexDirection: "row",
    paddingHorizontal: 15,
  },

  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  tabrow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 7,
    borderBottomWidth: 1.5,
    borderColor: colors.info,
  },

  filterTabText: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },

  filterArrow: { fontSize: 13, color: colors.black, marginLeft: 6 },
  filterArrowOpen: { color: colors.success },

  popup: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 12,
    zIndex: 999,
    overflow: "hidden",
  },
  popupRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  popupRowLast: { borderBottomWidth: 0 },
  popupRowActive: {
    backgroundColor: colors.gray200,
    marginTop: 12,
  },
  popupRowText: {
    fontSize: 14,
    color: colors.black,
    fontWeight: typography.weights.semibold,
  },
  popupRowTextActive: {
    color: colors.black,
    fontWeight: typography.weights.bold,
  },

  card: {
    backgroundColor: "#fff",
    marginBottom: 10,
    marginHorizontal: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },

  cardWithLeftBorder: {
    backgroundColor: "#fff",
    marginBottom: 10,
    marginHorizontal: 10,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  // ── Corner Star Styles ────────────────────────────────────
  cornerOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    zIndex: 15,
    backgroundColor: 'transparent',
  },

  cornerWrap: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    zIndex: 10,
    overflow: 'visible',
  },

  cornerTriangle: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderTopWidth: 72,
    borderLeftWidth: 72,
    borderTopColor: colors.primary,
    borderLeftColor: "transparent",
  },

  cornerNum: {
    position: "absolute",
    top: 6,
    right: 8,
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
  },

  cornerStarBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 72,
    height: 72,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 2,
    paddingRight: 2,
    zIndex: 20,
    backgroundColor: 'transparent',
  },

  cornerStar: {
    fontSize: 50,
    lineHeight: 50,
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  cornerStarUnfilled: {
    fontSize: 50,
    lineHeight: 50,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ── Card Content ──────────────────────────────────────────
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  cardTopLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  cardName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray900,
  },

  bibText: { 
    fontSize: 12, 
    color: colors.gray500, 
    marginTop: 2 
  },
  
  teamText: { 
    fontSize: 12, 
    color: colors.gray500, 
    marginBottom: 10 
  },

  // ── Stats Row ─────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    padding: 12,
  },
  
  statCol: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  
  statColMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.gray400,
  },
  
  statFlagMid: {
    borderLeftWidth: 1,
    borderColor: colors.gray400,
    alignItems: "center",   // ← center the flagRow horizontally within the column
    justifyContent: "center",
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
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.gray900,
  },

  // ✅ UTMB Badge Styles (Before Race Card)
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
    backgroundColor: "#1a1a2e",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },

  utmbBadgeTextTop: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  utmbBadgeTextBottom: {
    backgroundColor: colors.info,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    color: colors.white,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  utmbValue: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.gray900,
  },

  // ── List & Loading States ─────────────────────────────────
  list: { 
    paddingTop: 10, 
    paddingBottom: 24 
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  
  loadingText: { 
    color: colors.gray600, 
    fontSize: 14, 
    marginTop: 8 
  },
  
  errorText: { 
    color: "#555", 
    fontSize: 14, 
    textAlign: "center" 
  },
  
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 28,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  
  retryText: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 14 
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
    flexDirection: "column",  // ← stack flag on top, text below
    alignItems: "center",     // ← center both within the column
    justifyContent: "center",
    gap: 4,
  },

  // ADD this to resultListStyle
  statValSmall: {
    fontSize: typography.sizes.sm,  // smaller font
    fontWeight: typography.weights.bold,
    color: colors.gray900,
    flexShrink: 1,                  // allows text to shrink
    flexWrap: 'wrap',               // allows wrapping
  },
});