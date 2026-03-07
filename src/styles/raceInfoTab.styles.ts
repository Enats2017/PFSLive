// raceInfoTab.styles.ts
import { Dimensions, StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.88;

export const raceInfoStyles = StyleSheet.create({
  scrollContent: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    paddingTop:spacing.sm
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
    backgroundColor: "#3cb554",
    paddingHorizontal: 14,

    justifyContent: "center",
    alignItems: "center",
        width: CARD_WIDTH * 0.42,
        height:CARD_WIDTH*0.1,
   
  },
  diagLeft: {
    width: 0,
    height: 0,
    borderStyle: "solid",
    borderTopWidth: 35,
    borderRightWidth: 18,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopColor: "#3cb554",
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
    borderTopColor: "#e03030",
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },

  headerMiddle:{
    flex:1
  },
  headerRed: {
    backgroundColor: "#e03030",
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
   
      width: CARD_WIDTH * 0.42,
        height:CARD_WIDTH*0.1,
    
  },
  headerFinisher: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  header100km: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },

  // ── White card shared ─────────────────────────────────────────────────

  // ── Bib + Name card ───────────────────────────────────────────────────
  bibCard: {
    alignItems: "center",
    marginBottom:15
  },
  bibText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginTop: 2,
  },

  // ── Race Time card ────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#999",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 5,
  },
  raceTimeText: {
    fontSize: 38,
    fontWeight: "900",
    color: "#111",
    letterSpacing: 1,
    textAlign: "center",
  },

  timingPointValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 4,
  },
  timingPointDate: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginTop: 4,
  },

  // ── 3-col Rankings card ───────────────────────────────────────────────
  rankingsCard: {
    
      flex:1,
      flexDirection: "row",
      alignItems:"center",
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
    borderColor: "#eee",
  },
  rankingLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#999",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 14,
    lineHeight: 14,
  },
  rankingValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
  },

  // ── 2-col Stats card ──────────────────────────────────────────────────
  statsCard: {
    flex:1,
    flexDirection: "row",
    alignItems:"center",
     padding:5,
 
  },
  statsCol: {
    flex: 1,
    alignItems: "center",
  
   
  },
  statsColBorder: {
    paddingVertical:18,
    borderLeftWidth: 1,
    borderColor: colors.gray300,
  },
  statsLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#999",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 14,
    lineHeight: 14,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111",
  },
});
