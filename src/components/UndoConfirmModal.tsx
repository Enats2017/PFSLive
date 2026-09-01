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
import { commonStyles, palette, fonts, shadows, radii, withAlpha } from '../styles/common.styles';

interface UndoConfirmModalProps {
  visible: boolean;
  distanceName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const UndoConfirmModal: React.FC<UndoConfirmModalProps> = ({
  visible,
  distanceName,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation(['undoModal']);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <Ionicons name="alert-circle-outline" size={60} color={palette.warning} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{t('undoModal:title')}</Text>

          {/* Distance name */}
          {distanceName ? (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {distanceName}
              </Text>
            </View>
          ) : null}

          {/* Message */}
          <Text style={styles.message}>{t('undoModal:message')}</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[commonStyles.primaryButton, styles.confirmButton]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>
                {t('undoModal:buttons.confirm')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={commonStyles.secondaryButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={commonStyles.secondaryButtonText}>
                {t('undoModal:buttons.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UndoConfirmModal;

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
    marginBottom: 8,
  },
  chip: {
    backgroundColor: withAlpha(palette.navy, 0.08),
    borderWidth: 1,
    borderColor: palette.navy,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  chipText: {
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    color: palette.navy,
    letterSpacing: 0.5,
  },
  message: {
    fontFamily: fonts.body,
        fontSize: 13,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    backgroundColor: palette.navy,
  },
});