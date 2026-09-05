import { StyleSheet, Dimensions } from 'react-native';
import { spacing, typography, type, palette, radii, fonts, shadows, space } from './common.styles';

const { width, height } = Dimensions.get('window');

export const liveTrackingStyles = StyleSheet.create({
    // ── Main Screen ──────────────────────────────────────────
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    
    chartContainer: {
        height: 234, // ✅ Match profileContainer
        borderTopWidth: 1,
        borderTopColor: palette.border,
        backgroundColor: palette.surface,
    },
    collapseBtn: {
    ...shadows.card,

        position: 'absolute',
        bottom: 255, // ✅ Adjusted for new height (240 + 15)
        right: 16,
        backgroundColor: palette.surface,
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
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
    ...shadows.card,

        backgroundColor: palette.surface,
        borderRadius: 14,
        padding: spacing.xl,
        alignItems: 'center',
  },
    mapLoadingText: {
        marginTop: spacing.md,
        fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.textBody,
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
    ...shadows.card,

        backgroundColor: palette.surface,
        borderRadius: 16,
        padding: spacing.xl,
        width: '90%',
        maxWidth: 400,
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
        paddingRight: 32,
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
        backgroundColor: palette.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    initials: {
        fontFamily: fonts.bodySemi,
        fontSize: 26,

        color: palette.navy,
    },
    popupHeaderText: {
        flex: 1,
    },
    participantName: {
        fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.ink,
        marginBottom: 4,
    },
    participantBib: {
        fontFamily: fonts.body,
    fontSize: 15,
        color: palette.textBody,
    },
    popupSection: {
        marginBottom: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    popupSectionTitle: {
        fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.textBody,
        marginBottom: spacing.sm,
    },
    popupRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: space.md,
    },
    popupLabel: {
        fontFamily: fonts.body,
    fontSize: 15,
        color: palette.textBody,
        flex: 1,
    },
    popupValue: {
        fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.ink,
        textAlign: 'right',
    },
    popupFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: spacing.sm,
    },
    lastUpdateText: {
        fontFamily: fonts.body,
    fontSize: 13,
        color: palette.textMuted,
        fontStyle: 'italic',
    },

    // ── Aid Station Popup ────────────────────────────────────
    aidStationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
        paddingRight: 32,
    },
    aidStationIconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: palette.ink,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.md,
    },
    aidStationHeaderText: {
        flex: 1,
    },
    aidStationName: {
        fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.ink,
        marginBottom: 4,
    },
    aidStationSubtitle: {
        fontFamily: fonts.body,
    fontSize: 13,
        color: palette.textBody,
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
        backgroundColor: palette.warningBg,
        padding: spacing.md,
        borderRadius: 10,
        marginBottom: spacing.md,
    },
    warningText: {
        flex: 1,
        fontFamily: fonts.bodyMedium,
        fontSize: 13,
        color: palette.warning,

        },
    directionsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: palette.navy,
        paddingVertical: 16,
        borderRadius: 10,
    },
    directionsBtnText: {
        fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.surface,
    },

    // ── Elevation Profile ────────────────────────────────────
    profileContainer: {
        height: 240, // ✅ Increased from 180 to 240
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
        paddingTop: spacing.xs,
    },
    // ✅ Section label — the deck titles the elevation chart with its small
    // uppercase `.meta` line, the same treatment used everywhere else.
    // 32_MapView.png: the label sits left, the route's total ascent right.
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: spacing.md,
    },
    profileGain: {
        ...type.small,
    },

    profileTitle: {
        ...type.label,
        color: palette.textMuted,
        marginLeft: spacing.md,
        marginBottom: spacing.xs,
        paddingTop: spacing.sm,
    },
    profileScrollView: {
        flex: 1,
    },

    // ── Distance Dropdown ────────────────────────────────────
    // 32_MapView.png: "Live map" on the left of the band, a LIVE pill on the
    // right, with the distance selector beneath.
    mapHeadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    mapHeadTitle: {
        fontFamily: fonts.body,
        fontSize: 15,
        color: palette.ink,
    },
    mapLivePill: {
        backgroundColor: palette.noticeBg,
        borderRadius: radii.pill,
        paddingHorizontal: space.md,
        paddingVertical: 4,
    },
    mapLiveText: {
        fontFamily: fonts.bodySemi,
        fontSize: 12,
        color: palette.ink,
    },
    // A finished race is over and an upcoming one has not begun: neither should
    // wear the lime "happening now" tint.
    mapPillFinished: {
        backgroundColor: palette.fill,
    },
    mapPillUpcoming: {
        backgroundColor: palette.fill,
    },
    mapPillMutedText: {
        color: palette.textBody,
    },

    dropdownContainer: {
        paddingHorizontal: space.xl,
        paddingVertical: spacing.sm,
        backgroundColor: palette.surface,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: space.xl,
        backgroundColor: palette.fill,
        borderRadius: 10,
    },
    dropdownButtonText: {
        fontFamily: fonts.bodySemi,
        fontSize: 15,

        color: palette.ink,
    },
    dropdownModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdownModal: {
    ...shadows.card,

        backgroundColor: palette.surface,
        borderRadius: 14,
        width: '80%',
        maxHeight: '60%',
  },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
    },
    dropdownItemActive: {
        backgroundColor: palette.fill,
    },
    dropdownItemText: {
        fontFamily: fonts.body,
    fontSize: 15,
        color: palette.ink,
    },
    dropdownItemTextActive: {
        fontFamily: fonts.bodySemi,
        fontSize: 13,
        color: palette.navy,
    },

    // ── Map markers ──────────────────────────────────────
    // Used by <ParticipantMarker> and <AidStationMarker>, which render inside a
    // Mapbox.PointAnnotation — the annotation sizes itself to these views.
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: palette.surface,
    },
    greenDot: {
        backgroundColor: palette.lime,
    },
    bibBadge: {
        marginTop: 2,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: palette.navy,
    },
    bibText: {
        fontFamily: fonts.bodySemi,
        fontSize: 12,

        color: palette.surface,
    },
    aidStationMarker: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    aidStationIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: palette.navy,
        borderWidth: 2,
        borderColor: palette.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
});