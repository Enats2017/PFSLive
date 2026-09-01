import { StyleSheet } from 'react-native';
import { palette, radii, space, fonts } from './common.styles';

export const bottomNavStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: space.sm,
    // The artboard's 16pt foot. The bottom safe-area inset is owned by the
    // screen's SafeAreaView, not here — adding it in both places double-pads.
    paddingBottom: space.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  // ✅ The active tab is a lime pill around the icon — this replaced the old
  // blue tint (`colors.accent`, #4A9EFF), which was the only blue in the app.
  pill: {
    backgroundColor: palette.lime,
    borderRadius: radii.md,
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Keeps the inactive icon on the same baseline as one sitting in a pill.
  pillGhost: {
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    color: palette.textMuted,
  },
  labelActive: {
    fontFamily: fonts.bodySemi,
    color: palette.navy,
  },
  iconImage: {
    // Square, to match the normalized icon canvases: each glyph is centred
    // inside its own transparent square, so it self-aligns and needs no
    // per-icon nudging. 26 is the platform norm for a tab icon — the previous
    // 45 was compensating for the padding baked into the old exports, where the
    // glyph only filled part of the image.
    width: 26,
    height: 26,
    // ⚠️ The tint is NOT set here any more, and must not be moved back.
    //
    // The icons render through expo-image, which — unlike RN's <Image> — ignores
    // tintColor (and resizeMode) in a StyleSheet and reads them only as props.
    // Both now live on the component: see BottomNavigation.tsx /
    // BottomNavigationFollower.tsx, which pass
    // tintColor={isActive ? palette.ink : palette.textMuted} and
    // contentFit="contain". Putting them back in this object silently does
    // nothing and the icons lose their grey/active state.
    //
    // The reasoning still stands: tintColor rather than opacity, because dimming
    // pure black to 50% gives a washed grey that doesn't match the label beside
    // it and can't take the brand colour when active. Requires transparent PNGs —
    // an opaque plate blocks the tint entirely.
  },
});
