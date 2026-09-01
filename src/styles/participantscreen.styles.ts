import { StyleSheet } from "react-native";
import { spacing, palette, radii, space, type, fonts } from './common.styles';

 export const particpant = StyleSheet.create({

    section: {
        paddingHorizontal: spacing.sm,
        gap: spacing.xl,
    },

    sectionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.xl,
        paddingTop: space.lg,
        paddingBottom: space.sm,
    },
    sectionLabelText: {
        ...type.label,
        color: palette.textMuted,
    },

    dividerRow: {
        paddingVertical: spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    dividerOr: {
        ...type.small,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: palette.border,
    },
    dividerLabel: {
        fontFamily: fonts.bodySemi,
        fontSize: 12,
        color: palette.placeholder,
        letterSpacing: 1,
    },

    infoCard: {
        flexDirection: 'row',
        backgroundColor: palette.noticeBg,
        borderRadius: radii.md,
        padding: spacing.md,
        gap: spacing.xs,
        borderLeftWidth: 3,
        borderLeftColor: palette.lime,
    },

});