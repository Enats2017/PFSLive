import { StyleSheet } from 'react-native';
import { colors, spacing } from './common.styles';


export const COLORS = {
    navy: colors.primary,
    lime: colors.themeiColor,
    limeDark: colors.themeiColor,
    bg: '#F2F2EF',
    white: '#FFFFFF',
    grayText: '#8A8F98',
    darkText: '#1A2233',
    infoBg: '#f5f8e8',
    infoText: '#3C4A1E',
    border: '#E5E5E0',
};

export const membershipPlansStyle = StyleSheet.create({

    header: {
        backgroundColor: colors.themeiColor,
        paddingHorizontal: spacing.lg,
        paddingTop: 12,
        paddingBottom: 24,

    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
    },
    headerLabel: {
        color: colors.black,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginLeft: 4,
    },
    headerTitle: {
        color: colors.black,
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 6,
    },
    headerSubtitle: {
        color: colors.primaryLight,
        fontSize: 16,
        fontWeight: '600',
    },
    scroll: {
        flex: 1,
        backgroundColor: colors.white
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,

        paddingBottom: 20,
    },
    infoBanner: {
        backgroundColor: COLORS.infoBg,
        borderRadius: 16,
        padding: 12,
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    infoBannerText: {
        color: COLORS.infoText,
        fontSize: 15,
        fontWeight: "500",
        flex: 1,
        lineHeight: 21,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        position: 'relative',
        borderWidth: 2,
    },
    cardUnselected: {
        backgroundColor: COLORS.white,
        borderColor: COLORS.border,
    },
    cardSelected: {
        borderColor: colors.primary,
        borderWidth:1,
        backgroundColor: colors.themeiColor,
    },
    popularBadge: {
        position: 'absolute',
        top: -13,
        left: 16,
        backgroundColor: colors.primary,
        borderRadius: 20,
        paddingHorizontal: spacing.lg,
        paddingVertical: 6,
    },
    popularBadgeText: {
        color: colors.white,
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    popularselectedtext:{
        color: colors.themeiColor,
        fontSize: 11.5,
        fontWeight: '800',
        letterSpacing: 0.5,

    },
    checkCircle: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 17,
        height: 17,
        borderRadius: 12,
        backgroundColor: colors.primaryDark,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        marginTop: 6,
       
    },
    planName: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    textLight: {
        color: colors.primaryDark,
    },
    sessionsBadge: {
        backgroundColor: '#EFEFEF',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    sessionsBadgeLime: {
        backgroundColor: colors.primaryDark,
    },
    sessionsBadgeText: {
        fontSize: 13,
        color: COLORS.darkText,
        fontWeight: '500',
    },
    sessionsBadgeTextSelected: {
        color: colors.themeiColor,
        fontWeight: '700',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 14,
    },
    price: {
        fontSize: 34,
        fontWeight: '800',
        color: COLORS.darkText,
    },
    period: {
        fontSize: 15,
        color: COLORS.grayText,
    },
    periodLight: {
        color: colors.primaryDark,
    },
    featuresWrapper: {
        marginTop: 2,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureText: {
        marginLeft: 8,
        fontSize: 15,
        color: COLORS.grayText,
    },
    featureTextLight: {
        color: colors.primaryDark,
    },
    footerNote: {
        textAlign: 'center',
        color: COLORS.grayText,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
        marginBottom: 16,
    },
    // ✅ Subscription auto-renew disclosure text
    subscriptionInfoText: {
        textAlign: 'center',
        color: COLORS.grayText,
        fontSize: 12,
        lineHeight: 18,
        marginTop: 8,
        marginBottom: 12,
        paddingHorizontal: 8,
    },
    // ✅ Required legal links row (Privacy Policy • Terms of Use)
    legalLinksRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: 4,
        marginBottom: 20,
    },
    legalLinkText: {
        color: COLORS.darkText,
        fontSize: 13,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    legalLinkSeparator: {
        color: COLORS.grayText,
        fontSize: 13,
    },
    ctaWrapper: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingBottom: spacing.xxl
    },
    ctaButton: {
        backgroundColor: colors.primary,
        borderRadius: 12,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaButtonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '700',
        marginRight: 6,
    },
});