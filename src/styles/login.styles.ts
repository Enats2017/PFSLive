import { StyleSheet } from 'react-native';
import { palette, space, fonts, type, radii } from './common.styles';

// ✅ Redesign: 09_Login.png. The 250pt logo block is gone — the mark now sits in
// the shared header, and the screen opens on a left-aligned hero instead of a
// centred lockup, matching every other screen in the deck.
export const loginStyles = StyleSheet.create({
  inner: {
    flex: 1,
  },

  // Hero sits on white and is separated from the form by a hairline, as drawn.
  headerSection: {
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  title: {
    ...type.h1,
  },
  subtitle: {
    ...type.small,
    marginTop: space.sm,
  },

  formSection: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    gap: space.lg,
  },

  forgotButton: {
    alignSelf: 'flex-end',
    // A text link still needs a real touch target. At 4pt padding this was about
    // 26pt tall - well under the 44pt (iOS) / 48pt (Android) minimum - and it
    // carried no hitSlop, so it read as "not clickable" rather than as a link
    // that was merely hard to hit.
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  forgotText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.navy,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: space.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    ...type.small,
    marginHorizontal: space.md,
  },

  registerButton: {
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.navy,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  registerText: {
    ...type.h3,
    color: palette.navy,
  },
  // The reassurance line at the foot of the screen.
  accountNote: {
    ...type.small,
    textAlign: 'center',
    marginTop: space.xl,
    paddingHorizontal: space.xl,
  },
  registerLink: {
    fontFamily: fonts.bodySemi,
    color: palette.navy,
  },
});
