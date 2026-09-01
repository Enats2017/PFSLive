import { StyleSheet } from "react-native";
import { spacing, palette, space, type, radii, fonts } from './common.styles';

 export const follow = StyleSheet.create({

    section: {
        paddingHorizontal: space.xl, 
        gap: spacing.md,
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
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: palette.border,
    },
  
    // 18_FollowersList.png: "View" is a small chip on the right of the row,
    // not a full-width bar welded under it.
    viewChip: {
        backgroundColor: palette.fill,
        borderRadius: radii.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        alignSelf: 'center',
    },
    viewChipText: {
        fontFamily: fonts.bodySemi,
        fontSize: 13,
        color: palette.ink,
    },

    infoCard: {
        flexDirection: 'row',
        backgroundColor: palette.surface,
        borderRadius: 10,
        padding: spacing.lg,
        gap: spacing.sm,
        borderLeftWidth: 3,
         borderWidth: 0.5, 
        borderLeftColor: palette.lime,
    },

});