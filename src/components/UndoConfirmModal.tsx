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
import { commonStyles, palette, fonts, radii, withAlpha } from '../styles/common.styles';
import { dialogStyles, dialogTone } from './ui';

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
      <View style={dialogStyles.backdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </View>

      {/* Card */}
      <View style={dialogStyles.wrapper}>
        <View style={dialogStyles.card}>
          {/* Icon */}
          <View style={[dialogStyles.iconWrapper, { backgroundColor: dialogTone.warning.ring }]}>
            <Ionicons name="alert-circle-outline" size={56} color={dialogTone.warning.icon} />
          </View>

          {/* Title */}
          <Text style={dialogStyles.title}>{t('undoModal:title')}</Text>

          {/* Distance name */}
          {distanceName ? (
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {distanceName}
              </Text>
            </View>
          ) : null}

          {/* Message */}
          <Text style={dialogStyles.message}>{t('undoModal:message')}</Text>

          {/* Buttons */}
          <View style={dialogStyles.buttons}>
            <TouchableOpacity
              style={[commonStyles.primaryButton, dialogStyles.fullWidthButton]}
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
  // Only the chip is local — the dialog chrome comes from `dialogStyles`.
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
});
