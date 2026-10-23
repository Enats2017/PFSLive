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
import { dialogStyles, dialogTone, useCompactDialog } from './ui';
import ModalScroll from './ui/ModalScroll';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';

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
  // ✅ Landscape: no icon, buttons side by side (device test 2026-10-23 — this
  // card's buttons were cut off on a landscape phone). Portrait: unchanged.
  const cd = useCompactDialog();

  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS}
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
      {/* ModalScroll: the card (~444pt) was taller than a landscape screen —
          icon off the top, Cancel off the bottom (audit 2026-10-22) */}
      <View style={[dialogStyles.wrapper, cd.s.wrapper]}>
        <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.reserve}>
          <View style={[dialogStyles.card, cd.s.card]}>
            {/* Icon */}
            <View style={[dialogStyles.iconWrapper, { backgroundColor: dialogTone.warning.ring }, cd.s.hide]}>
              <Ionicons name="alert-circle-outline" size={56} color={dialogTone.warning.icon} />
            </View>

            {/* Title */}
            <Text style={[dialogStyles.title, cd.s.title]}>{t('undoModal:title')}</Text>

            {/* Distance name */}
            {distanceName ? (
              <View style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={2}>
                  {distanceName}
                </Text>
              </View>
            ) : null}

            {/* Message */}
            <Text style={[dialogStyles.message, cd.s.message]}>{t('undoModal:message')}</Text>

            {/* Buttons */}
            <View style={[dialogStyles.buttons, cd.s.buttonsRow]}>
              <TouchableOpacity
                style={[commonStyles.primaryButton, dialogStyles.fullWidthButton, cd.s.button]}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={commonStyles.primaryButtonText}>
                  {t('undoModal:buttons.confirm')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[commonStyles.secondaryButton, cd.s.button]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={commonStyles.secondaryButtonText}>
                  {t('undoModal:buttons.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ModalScroll>
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
    fontSize: 13,
    color: palette.navy,
    letterSpacing: 0.5,
    // 2 lines (was 1): a long distance name was cut at 320pt (audit 2026-10-22)
    textAlign: 'center',
  },
});
