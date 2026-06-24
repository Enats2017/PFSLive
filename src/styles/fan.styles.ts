import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

export const fanstyle = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  navCard: {
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    paddingVertical: spacing.sm, // was: padding: spacing.md (all sides)
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  navIconWrap: {
    width: 60, // was: 56
    height: 60, // was: 56
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    flex: 1,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  navSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 18,
  },
  nextEventsSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },

  nextEventsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  nextEventsTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },

  sliderContent: {
    gap: 12,
    paddingRight: 4,
    paddingBottom: 4,
  },

  eventCard: {
    width: 160,
    backgroundColor: colors.white,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#e5e8ef",
  },
  eventImg: {
    width: 160,
    height: 112, // was: 100
    resizeMode: "cover",
  },
  // favBadge: {
  //     position: 'absolute',
  //     top: 8,
  //     right: 8,
  //     width: 28,
  //     height: 28,
  //     borderRadius: 14,
  //     backgroundColor: 'rgba(255,255,255,0.9)',
  //     alignItems: 'center',
  //     justifyContent: 'center',
  // },
  eventInfo: {
    padding: 12,
  },
  eventName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 5,
  },
  eventDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  eventDate: {
    fontSize: 12,
    color: "#5a6880",
  },
});
