import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const eventStyles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    justifyContent: "flex-start",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  section: {
    alignItems: "center",
    padding: 6,
    backgroundColor: colors.gray300,
    marginVertical: spacing.sm,
  },
  header: {
    alignItems: "center",
    marginTop: spacing.lg,
    paddingBottom: spacing.sm,
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
 
});
