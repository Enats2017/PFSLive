import { StyleSheet } from "react-native";
import { spacing, palette, radii, space, type, fonts } from './common.styles';

 export const particpant = StyleSheet.create({

    // 12_ParticipantHub.png insets every element by the same 20pt page gutter.
    // This was 8 while `sectionLabel` below used 20, so each label sat 12pt to
    // the left of the block it introduced.
    section: {
        paddingHorizontal: space.xl,
        gap: space.md,
    },

    sectionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingHorizontal: space.xl,
        paddingTop: space.xl,
        // Separates the heading from the block it introduces (review note).
        paddingBottom: space.md,
    },
    sectionLabelText: {
        ...type.label,
        color: palette.textMuted,
    },

    dividerRow: {
        // Only ABOVE: the section label that follows already brings 20pt of its
        // own, and 20 + 20 left a 40pt hole between the OR rule and the heading.
        paddingTop: space.xl,
        paddingBottom: 0,
        // Without this the OR rule ran the full screen width while everything
        // around it was inset.
        paddingHorizontal: space.xl,
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

    // The lime-tinted note above "Create personal event". The deck gives it real
    // padding and lets the copy breathe; at 12pt padding with a 4pt gap the icon
    // was welded to the first word.
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: palette.noticeBg,
        borderRadius: radii.md,
        padding: space.lg,
        gap: space.md,
        borderLeftWidth: 3,
        borderLeftColor: palette.lime,
    },

});