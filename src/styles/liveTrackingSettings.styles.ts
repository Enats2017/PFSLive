// styles/liveTrackingSettings.styles.ts
import { StyleSheet } from 'react-native';
import { palette, radii, shadows, space, fonts, type, withAlpha } from './common.styles';

// ✅ Redesign: 31_TrackingSettings.png — stacked cards on the page tint, each
// card a labelled group. The visibility choice uses the shared SegmentedFilter.
export const styles = StyleSheet.create({
    // ── 35_Settings.png: the language block ────────────────
    // Three pills side by side, the active one navy. A dropdown hid two of the
    // three languages behind a tap.
    languageBlock: {
        marginBottom: space.md,
    },
    languageLabel: {
        ...type.label,
        color: palette.textMuted,
        marginBottom: space.md,
    },
    languageRow: {
        flexDirection: 'row',
        gap: space.md,
    },
    languagePill: {
        flex: 1,
        minHeight: 48,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.sm,
    },
    languagePillActive: {
        backgroundColor: palette.navy,
        borderColor: palette.navy,
    },
    languagePillText: {
        fontFamily: fonts.bodyMedium,
        fontSize: 13,
        color: palette.textBody,
    },
    languagePillTextActive: {
        fontFamily: fonts.display,
        color: palette.surface,
    },

    // Layout
    screen: {
        flexGrow: 1,
        padding: space.xl,
        gap: space.md,
        backgroundColor: palette.page,
    },
    pageTitleRow: {
        marginBottom: space.xs,
    },
    pageTitle: {
        ...type.h2,
    },
    pageSubtitle: {
        ...type.body,
        marginTop: space.xs,
    },

    // Card
    cardLabel: {
        ...type.label,
        color: palette.textMuted,
        marginBottom: space.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        marginBottom: space.lg,
    },
    cardIconWrap: {
        width: 46,
        height: 46,
        borderRadius: radii.md,
        backgroundColor: palette.fill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardTitle: {
        ...type.h3,
    },
    cardSubtitle: {
        ...type.small,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: palette.border,
        marginVertical: space.lg,
    },
    sectionLabel: {
        ...type.label,
        color: palette.textMuted,
        marginBottom: space.sm,
    },
    actionSpacing: {
        marginTop: space.lg,
    },

    // Status
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        marginBottom: space.lg,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    dotGreen: { backgroundColor: palette.lime },
    dotOrange: { backgroundColor: palette.warning },

    // Modal — the one place radius 16 (overlay) applies.
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: withAlpha(palette.ink, 0.45) },
    bottomSheet: {
        backgroundColor: palette.surface,
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
        paddingHorizontal: space.xxl,
        paddingTop: 16,
        ...shadows.overlay,
    },
    sheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: palette.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: space.xl,
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: palette.navy,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    closeBtnText: {
        fontFamily: fonts.bodySemi,
        fontSize: 13,
        color: palette.surface,
    },
    modalTitle: { ...type.h2 },
    modalSubtitle: { ...type.body, marginTop: space.xs },
    fieldLabel: { ...type.label, color: palette.textMuted, marginTop: space.sm },

    // Password
    errorText: {
        ...type.small,
        color: palette.danger,
        marginBottom: space.md,
    },
    hintText: {
        ...type.small,
        marginBottom: space.md,
    },

    // Deleting an account is destructive, so it reads as danger and sits apart
    // from the settings it is not part of.
    deleteAccountBtn: {
        marginTop: space.xl,
        padding: space.lg,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: palette.danger,
        backgroundColor: palette.dangerBg,
        alignItems: 'center',
    },
    deleteAccountText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.danger,
    },
    deleteAccountHint: {
        ...type.small,
        marginTop: space.xs,
        textAlign: 'center',
    },
});
