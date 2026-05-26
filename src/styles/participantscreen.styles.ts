import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

 export const particpant = StyleSheet.create({

    section: {
        paddingHorizontal: spacing.sm,
        gap: spacing.xl,
    },

    yellowHeader: {
        flexDirection: 'row',
        backgroundColor: colors.themeiColor,
       
        paddingVertical: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl
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
    dividerLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.gray400,
        letterSpacing: 1,
    },

    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        padding: spacing.lg,
        gap: spacing.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.themeiColor,
    },

});