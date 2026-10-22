import { StyleSheet } from "react-native";
import { spacing, palette, fonts, radii, space } from "./common.styles";

export const fanstyle = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxxl,
  },
  section: {
    paddingHorizontal: space.xl,
    paddingTop: spacing.md,
  },
  navCard: {
    backgroundColor: palette.navy,
    borderRadius: radii.md,
    paddingVertical: spacing.sm, // was: padding: spacing.md (all sides)
    paddingHorizontal: space.xl,
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
    fontFamily: fonts.display,
        fontSize: 15,
    color: palette.surface,
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  navSub: {
    fontFamily: fonts.body,
        fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    lineHeight: 19,
  },
  nextEventsSection: {
    paddingHorizontal: space.xl,
    paddingTop: spacing.xs,
  },

  nextEventsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  nextEventsTitle: {
    fontFamily: fonts.display,
        fontSize: 15,
    color: palette.ink,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontFamily: fonts.bodySemi,
        fontSize: 14,
    color: palette.navy,
  },

  sliderContent: {
    gap: 12,
    paddingRight: 4,
    paddingBottom: 4,
  },

  eventCard: {
    width: 160,
    // Fills its touchable, which the horizontal row stretches to the tallest
    // card: every "Next events" card is the same height whatever the name's
    // length (a 2-line name made its card taller than the rest).
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: palette.border,
  },
  eventImg: {
    width: 160,
    height: 112, // was: 100
    // NOTE: no resizeMode here — this wraps an expo-image, which reads fit from
    // the contentFit PROP (set in EventCard.tsx), not from the style.
    
    position: 'relative',   // 👈 add this
    overflow: 'hidden',
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
    // name at the top, date row pinned to the bottom — the same layout in
    // every card of the row
    flex: 1,
    justifyContent: "space-between",
  },
  eventName: {
    fontFamily: fonts.bodySemi,
        fontSize: 14,
    color: palette.ink,
    marginBottom: 4,
  },
  eventDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  eventDate: {
    fontFamily: fonts.body,
        fontSize: 13,
    color: palette.textMuted,
  },
});
