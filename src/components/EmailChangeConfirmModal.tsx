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

interface EmailChangeConfirmModalProps {
  visible: boolean;
  newEmail: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Consent gate for changing the account email.
 *
 * The email field lives inline in the edit-profile form, so nothing about it
 * looks different from first name or city — but saving it kicks off an OTP
 * round-trip and routes the user straight to the verification screen. Before
 * this existed the only warning was a tap-to-open tooltip on the field label,
 * which almost nobody opens; users hit Save and landed on an OTP screen with
 * no idea why.
 *
 * Structure mirrors DeviceTransferModal — same "we're about to email you a
 * 6-digit code, confirm first" moment, so it should look the same.
 */
const EmailChangeConfirmModal: React.FC<EmailChangeConfirmModalProps> = ({
  visible,
  newEmail,
  loading = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation(['profile']);

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
            <Ionicons name="mail-outline" size={56} color={colors.warning} />
          </View>

          <Text style={styles.title}>{t('profile:emailChange.title')}</Text>

          <Text style={styles.message}>
            {t('profile:emailChange.body', { email: newEmail })}
          </Text>

          <Text style={styles.note}>{t('profile:emailChange.note')}</Text>

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
                  {t('profile:emailChange.confirm')}
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
                {t('profile:emailChange.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default EmailChangeConfirmModal;

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
