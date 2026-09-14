import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Dialog, dialogStyles } from './ui';

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
 *
 * Tone is `warning`: nothing is destroyed, but another device gets signed out.
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
      <View style={dialogStyles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={loading ? undefined : onClose}
          disabled={loading}
        />
      </View>

      <View style={dialogStyles.wrapper}>
        <Dialog
          tone="warning"
          icon="phone-portrait-outline"
          title={t('login:deviceTransfer.title')}
          message={t('login:deviceTransfer.body', { email })}
          note={t('login:deviceTransfer.note')}
          confirmLabel={t('login:deviceTransfer.confirm')}
          onConfirm={onConfirm}
          cancelLabel={t('login:deviceTransfer.cancel')}
          onCancel={onClose}
          loading={loading}
        />
      </View>
    </Modal>
  );
};

export default DeviceTransferModal;
