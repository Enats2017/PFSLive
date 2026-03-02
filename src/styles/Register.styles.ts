import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const registerStyles = StyleSheet.create({
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
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.gray200,
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
    backgroundColor: colors.primary,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  removeIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  uploadPhotoText: {
    marginTop: spacing.sm,
    color: colors.gray600,
    fontSize: typography.sizes.sm,
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
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  termsText: {
    fontSize: typography.sizes.md,
    color: colors.gray700,
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
    backgroundColor: colors.gray200,
  },

  dividerText: {
    marginHorizontal: spacing.md,
    fontSize: typography.sizes.sm,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },

  // ✅ REGISTER LINK
  registerButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },

  registerText: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },

  registerLink: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },

  // ✅ ERROR TEXT
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.medium,
  },
});