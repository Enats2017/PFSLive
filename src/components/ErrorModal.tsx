import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { commonStyles, palette, fonts, shadows } from '../styles/common.styles';

interface ErrorModalProps {
  visible: boolean;
  titleKey?: string;
  messageKey: string;
  onClose: () => void;
  onRetry?: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  titleKey,
  messageKey,
  onClose,
  onRetry,
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>

      <View style={styles.wrapper}>
        <View style={styles.card}>
          <View style={styles.iconWrapper}>
            <Ionicons name="alert-circle" size={60} color={palette.danger} />
          </View>

          <Text style={styles.title}>
            {titleKey ? t(titleKey) : t('common:errors.generic')}
          </Text>

          <Text style={styles.message}>{t(messageKey)}</Text>

          <View style={styles.buttonContainer}>
            {onRetry && (
              <TouchableOpacity
                style={[commonStyles.primaryButton, styles.retryButton]}
                onPress={() => {
                  onClose();
                  onRetry();
                }}
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>
                  {t('common:buttons.retry')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={commonStyles.secondaryButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={commonStyles.secondaryButtonText}>
                {t('common:buttons.close')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ErrorModal;

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
    backgroundColor: palette.dangerBg,
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
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    backgroundColor: palette.navy,
  },
});