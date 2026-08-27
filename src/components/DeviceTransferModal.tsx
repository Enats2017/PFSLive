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
import { colors, commonStyles } from '../styles/common.styles';

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
            <Ionicons name="phone-portrait-outline" size={56} color={colors.warning} />
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
                <ActivityIndicator color="#fff" size="small" />
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.warning + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 12,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    color: '#94a3b8',
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
