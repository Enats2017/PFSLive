import { Platform, StyleSheet } from "react-native";
import { spacing, typography, type, palette, fonts, space, radii, shadows } from "./common.styles";

export const detailsStyles = StyleSheet.create({
  section: {
    alignItems: "center",
    backgroundColor: palette.lime,
    paddingVertical: spacing.md,
    paddingHorizontal: space.xl, 
    
  },
  // ✅ Redesign: the segmented pill group — page tint, hairline border, 4pt
  // padding. The old bottom rule went with the underline.
  tabBar: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: space.xs,
    backgroundColor: palette.page,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.pill,
    padding: space.xs,
    marginHorizontal: space.xl,
    marginBottom: space.md,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
  },
  
  card: {
      backgroundColor: palette.surface,
      borderRadius: 14,
      padding: spacing.md,
      marginHorizontal: space.xl,      // FIX: added — aligns cards with infoBox gutters
      marginBottom: spacing.md,    
    ...shadows.card,
  
    },
  // ✅ Text for the segmented pill group above (FILTERS). The deck has two
  // tab treatments and they are not interchangeable: a navy pill for
  // filtering one list, a lime underline for switching content — see
  // `tabBarUnderline` below. The old three-colour gradient underline is gone.
  tabText: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    color: palette.textMuted,
  },
  activeTabText: {
    fontFamily: fonts.display,
    color: palette.surface,
  },
  tabItemActive: {
    backgroundColor: palette.navy,
  },

  // ── 22_ParticipantList.png: the card's action row ──────
  // Two inset pill buttons — Results filled navy, Follow outlined. The old row
  // welded both to the card's bottom edge with square inner corners, and used
  // two different navies with mismatched 12/14 radii.
  cardActionRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    paddingTop: space.md,
  },
  cardActionPrimary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionPrimaryText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.surface,
  },
  cardActionSecondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.navy,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActionSecondaryText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.navy,
  },

  // ✅ Section label — the deck's `.meta` treatment: the small uppercase line
  // that titles a block of content ("Recent races").
  sectionLabel: {
    ...type.label,
    color: palette.textMuted,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    // "Recent races" sat flush against the Past/Live pills below it: this style
    // had top padding only, and `tabBar` has no top margin of its own.
    paddingBottom: space.md,
  },

  // ✅ In-page content tabs (EventDetail, RunnerInfo, RaceInfo, CheckpointHistory,
  // ParticipantList) — a lime underline on white. Distinct from `tabBar`, which
  // is the segmented pill group used for FILTERS.
  tabBarUnderline: {
    flexDirection: "row",
    gap: space.xxl,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  tabItemUnderline: {
    paddingBottom: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  tabItemUnderlineActive: {
    borderBottomColor: palette.lime,
  },
  tabTextUnderline: {
    fontFamily: fonts.displayMedium,
    fontSize: 15,
    color: palette.textMuted,
  },
  tabTextUnderlineActive: {
    fontFamily: fonts.display,
    color: palette.ink,
  },

  distance: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap:spacing.md,
   
  },
  // Avatar | name+meta | action. Reviewer note (2026-09-04): the avatar and the
  // name block were welded together - the row had padding but no gap, so the
  // text started at the edge of the 60pt circle on every card that uses this
  // row (participant list, athlete search, favourites, followers).
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
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
    fontFamily: fonts.body,
        fontSize: 15,                         // FIX: was 13 — synced with metaText; prevents misalignment
    lineHeight: 20,                       // FIX: added — stabilises vertical alignment
  },

  metaText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.textMuted,
    lineHeight: 20,                       // FIX: added — matches metaIcon lineHeight
    flexShrink: 1,
  },

  metaTextRed: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.danger,
    lineHeight: 20,                       // FIX: added — matches metaIcon lineHeight
    flexShrink: 1,
  },
  // ✅ AVATAR CONTAINER
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: palette.fill,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ AVATAR IMAGE STYLE
  avatarImage: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
  },

  // ✅ AVATAR FALLBACK (FOR INITIALS)
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ✅ AVATAR INITIALS TEXT
  avatarInitials: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.navy,
    textTransform: 'uppercase',
  },

  logo: {
    textAlign: "center",
    width: 100,
    height: 60,
  },

  info: {
    flex: 1,
  },

  // Card row: name plus muted meta lines (25_ParticipantList.png).
  rowName: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: space.xs,
  },
  rowAccent: {
    borderLeftWidth: 3,
    borderLeftColor: palette.lime,
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
    backgroundColor: palette.noticeBg,
    paddingVertical: 8,
    paddingHorizontal: space.xl,
    
    
    gap: 6,
  },
  
  liveTrackingText: {
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    color: palette.lime,
    textTransform: 'uppercase',
  },

  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    textAlign:"center",
    color: palette.navy,
  },

    resultsButton: {
    backgroundColor: palette.navyLift,
    borderRadius: radii.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 130,
    minHeight: 44, 
    
  },

  routeButton: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.navy,
    borderRadius: radii.md,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    minWidth: 130,
    minHeight: 44,
  },
  routeButtonText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.navy,
  },
  resultsButtonText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.surface,
  },
  verticalDivider: {
    width: 1,
    height:130,
    alignSelf: 'center',
    backgroundColor: palette.border,
  },

  infoBox: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: palette.fill,       // light blue tint like the screenshot
  borderRadius: 14,
  padding: spacing.sm,
  marginHorizontal: space.xl,
  marginBottom: spacing.md, 
  marginTop: spacing.md, 
  gap: spacing.sm,
},

infoIconWrapper: {
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: palette.border,       // slightly darker circle behind icon
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
},

infoBoxText: {
  flex: 1,
  fontFamily: fonts.bodySemi,
        fontSize: 12,
  color: palette.navyLift,

        lineHeight: 18,
},
});