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
import { useTranslation } from 'react-i18next';
import { RaceResultData } from '../../services/eventDetailService';
import { commonStyles, palette, fonts, shadows, radii, space } from '../../styles/common.styles';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmRaceResultModalProps {
  visible: boolean;
  data: RaceResultData | null;
  distanceName: string;
  registerLoading: boolean;
  // ✅ When true: button says "Confirm" and sends verification email instead of registering
  emailVerificationMode?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmRaceResultModal: React.FC<ConfirmRaceResultModalProps> = ({
  visible,
  data,
  distanceName,
  registerLoading,
  emailVerificationMode = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation(['confirmModal']);

  if (!data) return null;

  const maskEmail = (email: string): string => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.length > 2 ? 2 : 1;
    const masked = local.substring(0, visible) + '***';
    return `${masked}@${domain}`;
  };

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
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>

      {/* Card */}
      <View style={styles.wrapper}>
        <View style={styles.card}>
          {/* Top accent bar */}

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
            <Ionicons name="flag" size={28} color={palette.navy} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{t('confirmModal:title')}</Text>

          {/* Distance name */}
          {distanceName ? (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {distanceName}
              </Text>
            </View>
          ) : null}

          <Text style={styles.subtitle}>{t('confirmModal:subtitle')}</Text>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Data rows */}
          <ScrollView
            style={styles.dataContainer}
            showsVerticalScrollIndicator={false}
          >
            <Row label={t('confirmModal:fields.bibNumber')} value={data.bib_number} highlight />
            <Row label={t('confirmModal:fields.firstName')} value={data.firstname} />
            <Row label={t('confirmModal:fields.lastName')} value={data.lastname} />
            <Row label={t('confirmModal:fields.dob')} value={data.dob} />
            <Row label={t('confirmModal:fields.gender')} value={data.gender} />
            <Row label={t('confirmModal:fields.city')} value={data.city} />
            <Row label={t('confirmModal:fields.country')} value={data.country} />
            <Row label={t('confirmModal:fields.nation')} value={data.nation} />
            <Row label={t('confirmModal:fields.distance')} value={data.distance_name} />
            <Row label={t('confirmModal:fields.email')} value={maskEmail(data.email)} />
          </ScrollView>

          {/* Divider */}
          <View style={styles.divider} />

          {/* ✅ Confirm button — label changes based on mode */}
          <TouchableOpacity
            style={[
              commonStyles.primaryButton,
              { marginBottom: space.md },
              registerLoading && { opacity: 0.7 },
            ]}
            onPress={onConfirm}
            disabled={registerLoading}
            activeOpacity={0.82}
          >
            {registerLoading ? (
              <ActivityIndicator color={palette.surface} size="small" />
            ) : (
              <Text style={commonStyles.primaryButtonText}>
                {emailVerificationMode
                  ? t('confirmModal:buttons.confirmOnly')
                  : t('confirmModal:buttons.confirm')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Cancel button */}
          <TouchableOpacity
            style={commonStyles.secondaryButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={commonStyles.secondaryButtonText}>
              {t('confirmModal:buttons.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Row component ────────────────────────────────────────────────────────────
const Row = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => {
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
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 72,
    maxHeight: '75%',
    ...shadows.raised,
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
    backgroundColor: palette.navy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.surface,
  },
  iconWrapper: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: space.md,
  },
  iconText: {
    fontFamily: fonts.body,
        fontSize: 26,
  },
  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 8,
  },
  chip: {
    alignSelf: 'center',
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.navy,
    borderRadius: radii.pill,
    paddingHorizontal: space.xl,
    paddingVertical: 4,
    marginBottom: space.md,
  },
  chipText: {
    fontFamily: fonts.bodySemi,
        fontSize: 11,
    color: palette.navy,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.body,
        fontSize: 13,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 16,
  },
  dataContainer: {
    maxHeight: 280,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.fill,
  },
  label: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.textMuted,
    flex: 1,
  },
  value: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.ink,
    flex: 1,
    textAlign: 'right',
  },
  highlightValue: {
    color: palette.ink,
    fontFamily: fonts.display,
        fontSize: 15,
    },
});

export default ConfirmRaceResultModal;