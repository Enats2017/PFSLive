import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const detailsStyles = StyleSheet.create({
  section: {
    alignItems: "center",
    backgroundColor: colors.themeiColor,
     paddingVertical: spacing.sm,
    
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

  distance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
   
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
  },
  
    distanceInfo: {
    flex: 1,
    minWidth: 0,
  },

   metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
  },
  metaIcon: {
    fontSize: 13,
  },
  metaText: {
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
    flexShrink: 1,
  },
  // ✅ AVATAR CONTAINER
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ AVATAR IMAGE STYLE
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  // ✅ AVATAR FALLBACK (FOR INITIALS)
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ AVATAR INITIALS TEXT
  avatarInitials: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },

  logo: {
    textAlign: "center",
    width: 100,
    height: 60,
  },
  divider: {
    width: 3,
    height: 55,
    marginHorizontal: spacing.md,
  },
  info: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  
  // ✅ LIVE TRACKING BADGE STYLES
  liveTrackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  
  liveTrackingText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
    textTransform: 'uppercase',
  },

  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.themeblue,
  },

    resultsButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 120,
    
  },

  routeButton: {
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 120,
  },
});