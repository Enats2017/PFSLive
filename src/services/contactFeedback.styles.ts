import { StyleSheet } from 'react-native';
import { palette, radii, space, fonts, type, shadows } from '../styles/common.styles';

// ✅ Redesign: 36_ContactFeedback.png. The header row and title moved into the
// shared AppHeader band, so `header`/`backButton`/`headerTitle` are gone.
export const contactStyles = StyleSheet.create({
    // ── 36_ContactFeedback.png: the "other ways to reach us" card ──
    reachCard: {
        backgroundColor: palette.surface,
        borderRadius: radii.md,
        padding: space.lg,
        marginTop: space.lg,
        ...shadows.card,
    },
    reachTitle: {
        ...type.h3,
        marginBottom: space.md,
    },
    reachRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingBottom: space.md,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    reachEmail: {
        ...type.bodyMedium,
        color: palette.ink,
    },
    reachNote: {
        ...type.small,
        marginTop: space.md,
    },

    flex: {
        flex: 1,
        backgroundColor: palette.surface,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: space.xl,
        paddingTop: space.lg,
        paddingBottom: space.xxxl,
    },

    // Banner — the lime-tinted notice, not the old periwinkle.
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: palette.noticeBg,
        borderRadius: radii.md,
        padding: space.lg,
        marginBottom: space.lg,
    },
    bannerText: {
        flex: 1,
        paddingRight: space.md,
    },
    bannerTitle: {
        ...type.h3,
        color: palette.noticeText,
        marginBottom: space.xs,
    },
    bannerSubtitle: {
        ...type.small,
        color: palette.noticeText,
    },
    bannerIllustration: {
        width: 56,
        height: 56,
        borderRadius: radii.lg,
        backgroundColor: palette.surface,
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
        backgroundColor: palette.navy,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: palette.surface,
    },

    charCount: {
        alignSelf: 'flex-end',
        fontFamily: fonts.body,
        fontSize: 11,
        color: palette.textMuted,
        marginTop: -4,
    },

    submitSpacing: {
        marginTop: space.xl,
    },

    footerNote: {
        ...type.small,
        textAlign: 'center',
        marginTop: space.lg,
        paddingHorizontal: space.md,
    },
});
