import { StyleSheet, Platform } from "react-native";
import { spacing, typography, type, palette, fonts, shadows, space, withAlpha } from "./common.styles";

// ✅ CONSTANTS
const BORDER_RADIUS = 12;
const BORDER_WIDTH_NORMAL = 2;
const UPLOAD_ICON_SIZE = 40;
const FILE_ICON_SIZE = 28;

export const personalStyles = StyleSheet.create({
  // ✅ SECTION HEADER
  // ✅ Redesign: the deck's white sub-header. This was a second full-width lime
  // strip sitting directly under the AppHeader's lime band — the deck uses that
  // band once per screen, for the screen title, and never repeats it.
  section: {
    backgroundColor: palette.surface,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  sectionLabel: {
    ...type.label,
    color: palette.textMuted,
  },

  // ✅ TEXT STYLES
  subtitle: {
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.textBody,

        lineHeight: 20,
  },

  errorText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.danger,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,

        lineHeight: 18,
  },

  // ✅ FORM CONTAINER
  // The page gutter is 20 across the app; this form was on 16 with a thin 12pt
  // top inset, so it sat closer to the lime band than every other screen.
  formContainer: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: spacing.xl,
  },

  // ✅ FILE UPLOAD BOX
  uploadBox: {
    borderWidth: BORDER_WIDTH_NORMAL,
    borderColor: palette.navy,
    borderStyle: "dashed",
    borderRadius: BORDER_RADIUS,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(palette.navy, 0.06),
    minHeight: 140,
  },

  uploadBoxError: {
    borderColor: palette.danger,
    backgroundColor: palette.dangerBg,
  },

  uploadTitle: {
    marginTop: spacing.md,
    fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.navy,
    textAlign: "center",
  },

  uploadSubtitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textBody,
    textAlign: "center",
    lineHeight: 18,
  },

  // ✅ FILE CARD (SELECTED FILE)
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: BORDER_RADIUS,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    minHeight: 80,
    // Platform-specific shadows
    ...shadows.card,
  },

  fileLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.md,
  },

  fileIconContainer: {
    width: FILE_ICON_SIZE + 8,
    height: FILE_ICON_SIZE + 8,
    borderRadius: (FILE_ICON_SIZE + 8) / 2,
    backgroundColor: withAlpha(palette.navy, 0.08),
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },

  fileDetails: {
    flex: 1,
  },

  fileName: {
    fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.ink,
    marginBottom: spacing.xs / 2,
  },

  fileSize: {
    fontFamily: fonts.body,
        fontSize: 12,
    color: palette.textMuted,

        },

  // ✅ FILE ACTIONS
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.fill,
  },

  // ✅ FIELD WRAPPER (for error display)
  fieldWrapper: {
    marginBottom: spacing.md,
  },

  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  fileSection: { marginTop: spacing.md },
  undoBtn: { alignSelf: "flex-end", marginBottom: spacing.xs },
  undoText: { color: palette.navy, fontFamily: fonts.body,
        fontSize: 13 },
  submitBtn: { marginTop: spacing.xxxl, marginBottom: spacing.xl },
  disabled: { opacity: 0.6 },
});
