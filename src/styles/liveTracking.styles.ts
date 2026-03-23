import { StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, typography } from './common.styles';

const { width, height } = Dimensions.get('window');

export const liveTrackingStyles = StyleSheet.create({
    // ── Main Screen ──────────────────────────────────────────
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    
    chartContainer: {
        height: 240, // ✅ Match profileContainer
        borderTopWidth: 1,
        borderTopColor: colors.gray200,
        backgroundColor: colors.white,
    },
    collapseBtn: {
        position: 'absolute',
        bottom: 255, // ✅ Adjusted for new height (240 + 15)
        right: 16,
        backgroundColor: colors.white,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 5,
    },

    // ── Map Loading Overlay ──────────────────────────────────
    mapLoadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    mapLoadingBox: {
        backgroundColor: colors.white,
        borderRadius: 12,
        padding: spacing.xl,
        alignItems: 'center',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    mapLoadingText: {
        marginTop: spacing.md,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.gray700,
    },

    // ── Popup Overlay ────────────────────────────────────────
    popupOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    popup: {
        backgroundColor: colors.white,
        borderRadius: 16,
        padding: spacing.xl,
        width: '90%',
        maxWidth: 400,
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    popupCloseBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 10,
        padding: 4,
    },

    // ── Participant Popup ────────────────────────────────────
    popupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingRight: 30,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: spacing.md,
    },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.gray200,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    initials: {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
    popupHeaderText: {
        flex: 1,
    },
    participantName: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.gray900,
        marginBottom: 4,
    },
    participantBib: {
        fontSize: typography.sizes.md,
        color: colors.gray600,
    },
    popupSection: {
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray200,
    },
    popupSectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.gray700,
        marginBottom: spacing.sm,
    },
    popupRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    popupLabel: {
        fontSize: typography.sizes.md,
        color: colors.gray600,
        flex: 1,
    },
    popupValue: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.gray900,
        textAlign: 'right',
    },
    popupFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
    },
    lastUpdateText: {
        fontSize: typography.sizes.sm,
        color: colors.gray500,
        fontStyle: 'italic',
    },

    // ── Aid Station Popup ────────────────────────────────────
    aidStationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingRight: 30,
    },
    aidStationIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.black,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    aidStationHeaderText: {
        flex: 1,
    },
    aidStationName: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.gray900,
        marginBottom: 4,
    },
    aidStationSubtitle: {
        fontSize: typography.sizes.sm,
        color: colors.gray600,
    },
    aidStationInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#FFF3CD',
        padding: spacing.md,
        borderRadius: 8,
        marginBottom: spacing.md,
    },
    warningText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        color: '#856404',
        fontWeight: typography.weights.medium,
    },
    directionsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 10,
    },
    directionsBtnText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        color: colors.white,
    },

    // ── Elevation Profile ────────────────────────────────────
    profileContainer: {
        height: 240, // ✅ Increased from 180 to 240
        backgroundColor: colors.white,
        borderTopWidth: 1,
        borderTopColor: colors.gray200,
        paddingTop: spacing.xs,
    },
    profileTitle: {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: colors.gray900,
        marginLeft: spacing.md,
        marginBottom: spacing.xs,
    },
    profileScrollView: {
        flex: 1,
    },

    // ── Distance Dropdown ────────────────────────────────────
    dropdownContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray200,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.gray100,
        borderRadius: 8,
    },
    dropdownButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        color: colors.gray900,
    },
    dropdownModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
        backgroundColor: colors.white,
        borderRadius: 12,
        width: '80%',
        maxHeight: '60%',
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray200,
    },
    dropdownItemActive: {
        backgroundColor: colors.gray100,
    },
    dropdownItemText: {
        fontSize: typography.sizes.md,
        color: colors.gray900,
    },
    dropdownItemTextActive: {
        fontWeight: typography.weights.bold,
        color: colors.primary,
    },
});