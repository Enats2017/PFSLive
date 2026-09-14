import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Dialog, dialogStyles } from './ui';

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
 * Tone is `warning`, not `info`: the current address keeps working but the
 * account is about to depend on an inbox the user has not proved they own.
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
          icon="mail-outline"
          title={t('profile:emailChange.title')}
          message={t('profile:emailChange.body', { email: newEmail })}
          note={t('profile:emailChange.note')}
          confirmLabel={t('profile:emailChange.confirm')}
          onConfirm={onConfirm}
          cancelLabel={t('profile:emailChange.cancel')}
          onCancel={onClose}
          loading={loading}
        />
      </View>
    </Modal>
  );
};

export default EmailChangeConfirmModal;
