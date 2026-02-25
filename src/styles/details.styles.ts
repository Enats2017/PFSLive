import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const detailsStyles = StyleSheet.create({
  section: {
    alignItems: "center",
    padding: 6,
    backgroundColor: colors.gray300,
    marginVertical: spacing.sm,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabText: {
    fontSize: 14,
    color: "#999",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#000",
    fontWeight: "700",
  },
  underline: {
    position: "absolute",
    bottom: 0,
    height: 2,
    width: "60%",
    borderRadius: 2,
  },
  count: {
    backgroundColor: colors.success,
    width: "35%",
    paddingVertical: 12,
    borderTopRightRadius: 20,
    borderBottomStartRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4
  },
  distance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  topRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    textAlign: "center",
    width: 100,
    height: 60,
  },
  divider: {
    width: 3,
    height: 100,
    marginHorizontal: 15,
  },
  info: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  // ✅ ADD LIVE TRACKING BADGE STYLES
  liveTrackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success + '15', // Light green background
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.success,
  },
  liveTrackingText: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});