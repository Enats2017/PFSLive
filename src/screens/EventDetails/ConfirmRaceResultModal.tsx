import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Platform,
    ScrollView,
} from 'react-native';
import { RaceResultData } from '../../services/eventDetailService';
import { colors, commonStyles } from '../../styles/common.styles';

interface ConfirmRaceResultModalProps {
    visible: boolean;
    data: RaceResultData | null;
    distanceName: string;
    registerLoading: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

const ConfirmRaceResultModal: React.FC<ConfirmRaceResultModalProps> = ({
    visible,
    data,
    distanceName,
    registerLoading,
    onConfirm,
    onClose,
}) => {
    if (!data) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            {/* Backdrop */}
            <View style={styles.backdrop}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
            </View>

            {/* Card */}
            <View style={styles.wrapper}>
                <View style={styles.card}>

                    {/* Top accent bar */}
                    <View style={styles.accentBar} />

                    {/* Close button */}
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={onClose}
                        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    >
                        <View style={styles.closeBtnInner}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Icon */}
                    <View style={styles.iconWrapper}>
                        <Text style={styles.iconText}>🏁</Text>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>Confirm Registration</Text>

                    {/* Distance name */}
                    {distanceName ? (
                        <View style={styles.chip}>
                            <Text style={styles.chipText} numberOfLines={1}>{distanceName}</Text>
                        </View>
                    ) : null}

                    <Text style={styles.subtitle}>
                        We found your details in the race result. Please confirm your information below.
                    </Text>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Data rows */}
                    <ScrollView style={styles.dataContainer} showsVerticalScrollIndicator={false}>

                        <Row label="Bib Number" value={data.bib_number} highlight />
                        <Row label="First Name" value={data.firstname} />
                        <Row label="Last Name" value={data.lastname} />
                        <Row label="Date of Birth" value={data.dob} />
                        <Row label="Gender" value={data.gender} />
                        <Row label="City" value={data.city} />
                        <Row label="Country" value={data.country} />
                        <Row label="Nation" value={data.nation} />
                        <Row label="Distance" value={data.distance_name} />
                        <Row label="Email" value={data.email} />

                    </ScrollView>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Confirm button */}
                    <TouchableOpacity
                        style={[commonStyles.primaryButton, { marginBottom: 10 }, registerLoading && { opacity: 0.7 }]}
                        onPress={onConfirm}
                        disabled={registerLoading}
                        activeOpacity={0.82}
                    >
                        {registerLoading
                            ? <ActivityIndicator color="#000" size="small" />
                            : <Text style={commonStyles.primaryButtonText}>Confirm & Register</Text>
                        }
                    </TouchableOpacity>

                    {/* Cancel button */}
                    <TouchableOpacity
                        style={commonStyles.secondaryButton}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={commonStyles.secondaryButtonText}>Cancel</Text>
                    </TouchableOpacity>

                </View>
            </View>
        </Modal>
    );
};

// ─── Row component ─────────────────────────────────────────────────────────

const Row = ({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) => {
    if (!value) return null;
    return (
        <View style={rowStyles.row}>
            <Text style={rowStyles.label}>{label}</Text>
            <Text style={[rowStyles.value, highlight && rowStyles.highlightValue]}>
                {value}
            </Text>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    wrapper: {
        flex: 1,
        justifyContent: 'flex-end', // ← bottom sheet style
        paddingHorizontal: 0,
    },
    card: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 36,
        paddingBottom: 70,
        maxHeight: '75%',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
            },
            android: { elevation: 20 },
        }),
    },
    accentBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,

        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },
    closeBtn: {
        position: 'absolute',
        top: 14,
        right: 16,
        zIndex: 10,
    },
    closeBtnInner: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.white,
    },
    iconWrapper: {
        alignSelf: 'center',
        width: 68,
        height: 68,
        borderRadius: 50,
        backgroundColor: '#fff0e6',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    iconText: {
        fontSize: 30,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: 8,
    },
    chip: {
        alignSelf: 'center',
        backgroundColor: "#f5ebe8cc",
        borderWidth: 1,
        borderColor: colors.primary,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginBottom: 10,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.primary,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 8,
    },
    divider: {
        width: '100%',
        height: 1,
        backgroundColor: '#e2e8f0',
        marginVertical: 16,
    },
    dataContainer: {
        maxHeight: 280,
    },
    confirmBtn: {
        width: '100%',
        backgroundColor: '#f4a100',
        borderRadius: 13,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 10,
    },
    confirmBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#000',
    },
    cancelBtn: {
        width: '100%',
        borderRadius: 13,
        marginTop: 10,
        paddingVertical: 13,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#64748b',
    },
});

const rowStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    label: {
        fontSize: 13,
        color: '#94a3b8',
        fontWeight: '500',
        flex: 1,
    },
    value: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
        flex: 1,
        textAlign: 'right',
    },
    highlightValue: {
        color: '#0f172a',
        fontSize: 16,
        fontWeight: '800',
    },
});

export default ConfirmRaceResultModal;