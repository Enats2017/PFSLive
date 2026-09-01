import { StyleSheet, Platform } from 'react-native';
import { spacing, typography, type, palette, fonts, shadows, radii, space } from './common.styles';

export const registerStyles = StyleSheet.create({
  // ✅ HEADER SECTION — mirrors loginStyles.headerSection so both auth screens
  // open with the same white band; the deck draws them identically.
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

  // ✅ Paired fields — 04_Register.png puts first/last name on one line and
  // birth date/gender on another, so the form reads as four rows not six.
  fieldRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },

  // ✅ IMAGE SECTION
  imagesection: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },

  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.fill,
    borderWidth: 2,
    borderColor: palette.border,
  },

  profileImage: {
    width: '100%',
    height: '100%',
  },

  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  cameraIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: palette.navy,
    borderRadius: radii.pill,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },

  removeIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.card,
  },

  uploadPhotoText: {
    marginTop: spacing.sm,
    color: palette.textBody,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
  },

  // ✅ TERMS & CONDITIONS
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.inputBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.surface,
  },

  checkboxActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },

  termsText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textBody,
    flex: 1,
  },

  // ✅ BUTTONS
  buttonSection: {
    marginTop: spacing.lg,
  },

  // ✅ DIVIDER
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },

  dividerText: {
    marginHorizontal: space.xl,
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.textMuted,

        },

  // ✅ REGISTER LINK
  registerButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },

  registerText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textBody,
  },

  registerLink: {
    color: palette.navy,
    fontFamily: fonts.bodySemi,
        fontSize: 13,
        },

  // ✅ ERROR TEXT
  errorText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,

        },
});