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
    paddingHorizontal: spacing.md,
  },
  section: {
    alignItems: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.themeiColor,
    marginVertical: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.themeblue,
  },
  textCenter: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.themeblue,
    textAlign:"center"
  },
  header: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray300,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  activeTabText: {
    color: colors.black,
    fontWeight: typography.weights.bold,
  },
  underline: {
    position: "absolute",
    bottom: 0,
    height: 2,
    width: "60%",
    borderRadius: 2,
  },

  eventCardInfo: {
  flex: 1,
  
},

eventCardDateRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
iconButtonBlue: {
  backgroundColor: colors.themeiColor,
  borderRadius: 8,
  width: 45,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
},
});