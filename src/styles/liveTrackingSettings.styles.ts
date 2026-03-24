// styles/liveTrackingSettings.styles.ts
import { StyleSheet } from 'react-native';
import { colors } from './common.styles';

export const styles = StyleSheet.create({
    // Layout
    
    pageTitleRow:   { marginBottom: 20, marginTop: 8 },
   

    // Card
    cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    cardIconWrap:   { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.gray200, alignItems: 'center', justifyContent: 'center' },
    cardSubtitle:   { fontSize: 12, color: colors.black, marginTop: 2 },
    divider:        { height: 1, backgroundColor: '#F0F2F8', marginVertical: 16 },

    // Segmented control
    segmentedControl: { flexDirection: 'row', backgroundColor: '#F0F2F8', borderRadius: 14, padding: 4, marginBottom: 16, marginTop: 8 },
    segment:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 11, gap: 6 },
    segmentActive:    { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    segmentEmoji:     { fontSize: 16 },
    segmentTextActive:{ color: '#FFFFFF' },

    // Status
    statusRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    statusDot:      { width: 8, height: 8, borderRadius: 4 },
    dotGreen:       { backgroundColor: colors.success },
    dotOrange:      { backgroundColor: colors.primary },

    // Modal
    modalOverlay:   { flex: 1, justifyContent: 'flex-end' },
    modalBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    bottomSheet:    { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14 },
    sheetHandle:    { width: 40, height: 4, backgroundColor: '#E0E4F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    closeBtn:       { position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
    closeBtnText:   { fontSize: 13, fontWeight: '700', color: colors.white },

    // Password
    errorText:      { fontSize: 13, color: '#FF3B30', marginBottom: 6 },
    hintText:       { fontSize: 12, color: colors.black, marginBottom: 14 },
});