import { StyleSheet } from "react-native";
import { spacing, palette, fonts, space } from './common.styles';

export const ownProfile = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.surface,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxxxl,
  },
  header: {
    height: 0,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: palette.lime,
    backgroundColor: palette.fill,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: palette.lime,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.surface,
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    // ✅ Wrap (layout audit 2026-10-22): fr at ×1.35 ran off-screen in one row.
    flexWrap: "wrap",
    columnGap: space.xl,
    rowGap: space.xs,
    marginTop: space.sm,
  },
  statItem: {
    alignItems: "flex-start",
  },
  statNumber: {
    fontFamily: fonts.display,
        fontSize: 15,
    color: palette.ink,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
  },
  whiteBody: {
    flex: 1,
    backgroundColor: palette.page,
    paddingTop: space.lg,
  },
  menuSection: {
    paddingHorizontal: space.xl,
  },
  trackingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: palette.lime,
    borderRadius: 14,
    padding: 16,
    marginTop: spacing.sm,
    marginBottom: 20,
    paddingHorizontal: space.xl,
  },
  trackingTextWrapper: {
    flex: 1,
  },

  title: {
    fontFamily: fonts.display,
        fontSize: 15,
    color: palette.ink,
    lineHeight: 20,
    marginBottom: 8,
  },

  subtitle: {
    fontFamily: fonts.body,
        fontSize: 14,
    color: palette.textBody,
    lineHeight: 18,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  menuTextWrapper: {
    flex: 1,
  },

  initialsWrapper: {
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontFamily: fonts.display,
        fontSize: 40,
    color: palette.surface,
    letterSpacing: 2,
  },

     backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        // ✅ 44pt touch target (was ~22pt, the text line). The 11pt it adds
        // under the label comes off the margin, so the visual gap is unchanged.
        minHeight: 44,
        marginBottom: 8,
        paddingHorizontal: space.xl
    },
    backLabel: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.ink,
    },

     ioscard: {
        backgroundColor: palette.navy,
        borderRadius: 14,
        padding: 16,
        marginBottom:spacing.lg
        
    },
    iosheader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: space.md,
    },
    iostitle: {
        marginLeft: 8,
        color: palette.textOnNavy,
        fontFamily: fonts.bodySemi,
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    iossubtitle: {
        color: palette.surface,
        fontFamily: fonts.displayMedium,
        fontSize: 20,
        marginBottom: space.md,
    },
    iosbold: {
        fontFamily: fonts.bodySemi,
        },
    iosbutton: {
        backgroundColor: palette.lime,
        borderRadius: 10,
        minHeight: 44,
        paddingVertical: 8,
        paddingHorizontal: 16,
        
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iosbuttonText: {
        color: palette.navy,
        fontFamily: fonts.display,
        fontSize: 15,
        // ✅ Wraps instead of pushing the chevron out of the lime button (fr).
        flexShrink: 1,
        marginRight: 8,
        },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: palette.lime,
        borderRadius: 10,
        minHeight: 48,
        paddingVertical: 8,
        // ✅ Side padding + shrinking label (layout audit 2026-10-22): the fr
        // label ran out of the button at 320pt with larger text.
        paddingHorizontal: space.lg,
        marginHorizontal: space.xl,
        marginBottom: spacing.md,
    },
    createBtnText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.ink,
        flexShrink: 1,
        textAlign: 'center',
    },

});
