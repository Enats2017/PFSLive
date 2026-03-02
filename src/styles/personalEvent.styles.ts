import { StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from './common.styles';

// ✅ CONSTANTS
const BORDER_RADIUS = 12;
const BORDER_WIDTH_NORMAL = 2;
const UPLOAD_ICON_SIZE = 40;
const FILE_ICON_SIZE = 28;

export const personalStyles = StyleSheet.create({
  // ✅ SECTION HEADER
  section: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.gray100,
    marginVertical: spacing.sm,
  },

  // ✅ TEXT STYLES
  subtitle: {
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
    lineHeight: 20,
  },

  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.medium,
    lineHeight: 18,
  },

  // ✅ FORM CONTAINER
  formContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },

  // ✅ FILE UPLOAD BOX
  uploadBox: {
    borderWidth: BORDER_WIDTH_NORMAL,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary + '10',
    minHeight: 140,
  },

  uploadBoxError: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },

  uploadTitle: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    textAlign: 'center',
  },

  uploadSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 18,
  },

  // ✅ FILE CARD (SELECTED FILE)
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: BORDER_RADIUS,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    minHeight: 80,
    // Platform-specific shadows
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  fileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },

  fileIconContainer: {
    width: FILE_ICON_SIZE + 8,
    height: FILE_ICON_SIZE + 8,
    borderRadius: (FILE_ICON_SIZE + 8) / 2,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },

  fileDetails: {
    flex: 1,
  },

  fileName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.black,
    marginBottom: spacing.xs / 2,
  },

  fileSize: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    fontWeight: typography.weights.regular,
  },

  // ✅ FILE ACTIONS
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },

  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },

  // ✅ FIELD WRAPPER (for error display)
  fieldWrapper: {
    marginBottom: spacing.md,
  },
});