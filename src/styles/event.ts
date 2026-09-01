import { StyleSheet } from "react-native";
import { spacing, typography, type, palette, fonts, space, radii } from "./common.styles";

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
    paddingHorizontal: space.xl,
  },
  // ✅ Redesign: the deck's sub-header — a white band under the AppHeader
  // carrying the page label and its filter tabs. This replaced a full-width
  // lime strip with a centred 20px title, which was the old design's device
  // and is not in the deck.
  subHeader: {
    backgroundColor: palette.surface,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    gap: space.md,
  },
  sectionLabel: {
    ...type.label,
    color: palette.textMuted,
  },
  title: {
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.navy,
  },
  textCenter: {
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.navy,
    textAlign:"center"
  },
  header: {
    alignItems: "center",
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radii.lg,
  },
  // ✅ Redesign: tabs are the segmented pill group from the design sheet, so
  // the active state is a navy pill rather than an underline. `underline` is
  // gone — it carried a three-colour gradient that appears nowhere in the deck.
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

  eventCardInfo: {
  flex: 1,
  
},

eventCardDateRow: {
  flexDirection: 'row',
  alignItems: 'center',
},
iconButtonBlue: {
  backgroundColor: palette.lime,
  borderRadius: 10,
  width: 45,
  height: 40,
  alignItems: 'center',
  justifyContent: 'center',
    flexShrink: 0,
},
});