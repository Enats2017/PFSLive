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
        backgroundColor: colors.primary,
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
        color: colors.white,
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.5,
        marginLeft: 4,
    },
    headerTitle: {
        color: colors.white,
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 6,
    },
    headerSubtitle: {
        color: colors.themeiColor,
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
        backgroundColor: colors.primary,
        borderColor: colors.themeiColor,
    },
    popularBadge: {
        position: 'absolute',
        top: -13,
        left: 16,
        backgroundColor: colors.themeiColor,
        borderRadius: 20,
        paddingHorizontal: spacing.lg,
        paddingVertical: 6,
    },
    popularBadgeText: {
        color: colors.primaryDark,
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
        backgroundColor: colors.themeiColor,
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
        color: COLORS.white,
    },
    sessionsBadge: {
        backgroundColor: '#EFEFEF',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    sessionsBadgeLime: {
        backgroundColor: COLORS.lime,
    },
    sessionsBadgeText: {
        fontSize: 13,
        color: COLORS.darkText,
        fontWeight: '500',
    },
    sessionsBadgeTextSelected: {
        color: COLORS.darkText,
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
        color: '#A6B1BE',
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
        color: '#D7DEE5',
    },
    footerNote: {
        textAlign: 'center',
        color: COLORS.grayText,
        fontSize: 13,
        lineHeight: 19,
        marginTop: 8,
        marginBottom: 16,
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
        backgroundColor: colors.themeiColor,
        borderRadius: 12,
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaButtonText: {
        color: COLORS.darkText,
        fontSize: 16,
        fontWeight: '700',
        marginRight: 6,
    },
});