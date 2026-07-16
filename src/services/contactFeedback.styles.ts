import { StyleSheet } from 'react-native';
import { colors, spacing } from '../styles/common.styles';


export const contactStyles = StyleSheet.create({
    flex: {
        flex: 1,
        backgroundColor: colors.white,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: 6,
        paddingBottom: 14,
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '700',
        color: colors.gray900,
        letterSpacing: 0.2,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xxxl,
    },

    // Banner
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF1FE',
        borderRadius: 10,
        padding: 18,
        marginTop: spacing.md,
        marginBottom: spacing.md,
    },
    bannerText: {
        flex: 1,
        paddingRight: 12,
    },
    bannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.primary,
        marginBottom: 4,
    },
    bannerSubtitle: {
        fontSize: 12.5,
        lineHeight: 17,
        color: colors.gray400,
    },
    bannerIllustration: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerBubble: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.white,
    },

    card: {
        backgroundColor: colors.white,
        borderRadius: 20,
        paddingHorizontal: 2,
    },

    charCount: {
        alignSelf: 'flex-end',
        fontSize: 11,
        color: colors.gray400,
        marginTop: -4,
    },

    sendIcon: {
        marginRight: 8,
    },

    footerNote: {
        textAlign: 'center',
        fontSize: 11.5,
        color: colors.gray400,
        marginTop: 16,
        lineHeight: 16,
        paddingHorizontal: 12,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
});