import { Platform, StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const detailsStyles = StyleSheet.create({
  section: {
    alignItems: "center",
    backgroundColor: colors.themeiColor,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md, 
    
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
  
  card: {
      backgroundColor: colors.white,
      borderRadius: 12,
      padding: spacing.md,
      shadowColor: colors.black,
      marginHorizontal: spacing.md,      // FIX: added — aligns cards with infoBox gutters
      marginBottom: spacing.md,    
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 3,
       ...Platform.select({
      ios: {
        shadowOpacity: 0.15,
        shadowRadius: 5,
      },   
    }),
  
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
    gap:spacing.md,
   
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
   
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
    fontSize: 15,                         // FIX: was 13 — synced with metaText; prevents misalignment
    lineHeight: 20,                       // FIX: added — stabilises vertical alignment
  },

 metaText: {
    fontSize: typography.sizes.sm,        // keep — but ensure sm >= 13px in common.styles
    color: colors.gray500,
    fontWeight: typography.weights.medium,
    lineHeight: 20,                       // FIX: added — matches metaIcon lineHeight
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
    fontSize: 22,
    fontWeight: typography.weights.bold,
    color: colors.themeblue,
  },

    resultsButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 130,
    minHeight: 44, 
    
  },

  routeButton: {
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 130,
    minHeight: 44, 
  },
  verticalDivider: {
    width: 1,
    height:130,
    alignSelf: 'center',
    backgroundColor: colors.gray200,
  },

  infoBox: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#EDF2F7',       // light blue tint like the screenshot
  borderRadius: 12,
  padding: spacing.sm,
  marginHorizontal: spacing.md,
  marginBottom: spacing.md, 
  gap: spacing.sm,
},

infoIconWrapper: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: '#CBD5E0',       // slightly darker circle behind icon
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
},

infoBoxText: {
  flex: 1,
  fontSize: typography.sizes.xs,
  color: colors.primaryLight,
  fontWeight: typography.weights.semibold,
  lineHeight: 18,
},
});