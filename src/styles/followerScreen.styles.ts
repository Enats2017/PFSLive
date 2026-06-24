import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

 export const follow = StyleSheet.create({

    section: {
        paddingHorizontal: spacing.md, 
        gap: spacing.md,
    },

    yellowHeader: {
        flexDirection: 'row',
        backgroundColor: colors.themeiColor,
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md
    },
    yellowHeaderText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1a1a1a',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    dividerRow: {
        paddingVertical: spacing.xl,
        flexDirection: 'row',
        alignItems: 'center',       
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.gray200,
    },
  
    infoCard: {
        flexDirection: 'row',
        backgroundColor: colors.white,
        borderRadius: 10,
        padding: spacing.lg,
        gap: spacing.sm,
        borderLeftWidth: 3,
         borderWidth: 0.5, 
        borderLeftColor: colors.themeiColor,
    },

});