import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const bottomNavStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
  iconImage: {
    // Square, to match the normalized icon canvases: each glyph is centred
    // inside its own transparent square, so it self-aligns and needs no
    // per-icon nudging. 26 is the platform norm for a tab icon — the previous
    // 45 was compensating for the padding baked into the old exports, where the
    // glyph only filled part of the image.
    width: 26,
    height: 26,
    marginBottom: 4,
    // ⚠️ The tint is NOT set here any more, and must not be moved back.
    //
    // The icons render through expo-image, which — unlike RN's <Image> — ignores
    // tintColor (and resizeMode) in a StyleSheet and reads them only as props.
    // Both now live on the component: see BottomNavigation.tsx /
    // BottomNavigationFollower.tsx, which pass
    // tintColor={isActive ? colors.accent : colors.gray500} and
    // contentFit="contain". Putting them back in this object silently does
    // nothing and the icons lose their grey/active state.
    //
    // The reasoning still stands: tintColor rather than opacity, because dimming
    // pure black to 50% gives a washed grey that doesn't match the label beside
    // it and can't take the brand colour when active. Requires transparent PNGs —
    // an opaque plate blocks the tint entirely.
  },
});