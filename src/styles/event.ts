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
  count: {
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomLeftRadius: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 20,
    borderBottomStartRadius: 20,
    borderBottomEndRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  distance:{
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 
  }
});
