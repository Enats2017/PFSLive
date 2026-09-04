import { StyleSheet } from 'react-native';
import { palette, radii, space, fonts } from './common.styles';

// ✅ Redesign header (client-approved 2026-08-29).
// Two stacked pieces, in this order on every screen:
//   1. a navy gradient action row — back · home · [actions] · settings · profile
//   2. a lime band carrying the screen name
// The action row absorbs the status-bar inset itself, so screens using <AppHeader>
// must NOT also pass edges={['top']} to their SafeAreaView or the bar double-pads.
export const headerStyles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 44,
  },
  // Every icon sits in the SAME 24pt slot. Without a fixed slot each button was
  // only as wide as its own glyph - chevron 23, home 21, the rest 20 - so a flat
  // gap produced visibly uneven spacing across search / settings / profile.
  // Slot + gap = 36pt centre-to-centre: the artboards measure ~28, but at that
  // pitch the settings and profile icons read as crowded on a real device.
  // The touch target stays comfortable via hitSlop, not via padding.
  iconBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  centerLogoWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLogo: {
    height: 22,
    width: 96,
  },

  band: {
    backgroundColor: palette.lime,
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
  },
  bandText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.ink,
    textAlign: 'center',
  },

  // Kept for the screens that still render the pre-redesign white bar.
  legacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    height: 60,
  },
  legacyRadius: {
    borderRadius: radii.md,
  },
});
