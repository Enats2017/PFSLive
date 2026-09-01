import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { commonStyles, palette, fonts, shadows } from '../styles/common.styles';

interface DeviceTransferModalProps {
  visible: boolean;
  email: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Shown when login returns `device_not_allowed` — the account is bound to a
 * different phone.
 *
 * Before this existed the user got a toast telling them to email support, and
 * the ticket was resolved by an admin blanking device_id by hand. Confirming
 * here sends a 6-digit code to the account's email address; entering it moves
 * the account to this phone and signs the old one out.
 */
const DeviceTransferModal: React.FC<DeviceTransferModalProps> = ({
  visible,
  email,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation(['login']);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onClose}
    >
      {/* Backdrop */}
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={loading ? undefined : onClose}
          disabled={loading}
        />
      </View>

      {/* Card */}
      <View style={styles.wrapper}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Ionicons name="phone-portrait-outline" size={56} color={palette.warning} />
          </View>

          <Text style={styles.title}>{t('login:deviceTransfer.title')}</Text>

          <Text style={styles.message}>
            {t('login:deviceTransfer.body', { email })}
          </Text>

          <Text style={styles.note}>{t('login:deviceTransfer.note')}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                commonStyles.primaryButton,
                styles.confirmButton,
                loading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={palette.surface} size="small" />
              ) : (
                <Text style={commonStyles.primaryButtonText}>
                  {t('login:deviceTransfer.confirm')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.secondaryButton}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={commonStyles.secondaryButtonText}>
                {t('login:deviceTransfer.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default DeviceTransferModal;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...shadows.card,
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: palette.warningBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontFamily: fonts.body,
        fontSize: 13,
    lineHeight: 21,
    color: palette.textBody,
    textAlign: 'center',
    marginBottom: 12,
  },
  note: {
    fontFamily: fonts.body,
        fontSize: 12,
    lineHeight: 18,
    color: palette.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 10,
  },
  confirmButton: {
    width: '100%',
  },
});
