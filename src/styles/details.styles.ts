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
  // ✅ UPDATED COUNT BADGE - MORE PADDING FOR READABILITY
  count: {
    backgroundColor: colors.success,
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopRightRadius: 20,
    borderBottomStartRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  distance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
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
});