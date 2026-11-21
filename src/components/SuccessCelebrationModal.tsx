import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles, palette, fonts, shadows, withAlpha } from '../styles/common.styles';
import { dialogTone, useCompactDialog } from './ui';
import { useTranslation } from 'react-i18next';
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';
import ModalScroll from './ui/ModalScroll';

interface SuccessCelebrationModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  title:string,
}

const SuccessCelebrationModal: React.FC<SuccessCelebrationModalProps> = ({
  visible,
  message,
  title = "Registration Successful!",
  onClose,
}) => {
  const { t } = useTranslation();
  // ✅ The live window width, not Dimensions at import time (device test
  // 2026-10-23): in landscape the confetti only fell over the left part of the
  // screen (the portrait width).
  const { width } = useWindowDimensions();
  // ✅ Landscape: no icon, tighter card (device test 2026-10-23). Portrait: unchanged.
  const cd = useCompactDialog();
  const confettiAnims = useRef(
    Array.from({ length: 20 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      opacity: new Animated.Value(1),
    }))
  ).current;

  useEffect(() => {
    if (visible) {
      // Start confetti animation
      confettiAnims.forEach((anim, index) => {
        Animated.parallel([
          Animated.timing(anim.translateY, {
            toValue: 600,
            duration: 3000 + index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim.translateX, {
            toValue: (Math.random() - 0.5) * 200,
            duration: 3000 + index * 100,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]).start();
      });

      // ❌ REMOVED AUTO-CLOSE TIMER
      // User must click button to close
    }
  }, [visible]);

  const resetAnimations = () => {
    confettiAnims.forEach((anim) => {
      anim.translateY.setValue(0);
      anim.translateX.setValue(0);
      anim.opacity.setValue(1);
    });
  };

  const handleClose = () => {
    resetAnimations();
    onClose();
  };

  return (
    <Modal supportedOrientations={MODAL_ORIENTATIONS}
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <View style={styles.backdrop} />

      {/* Confetti */}
      {confettiAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              left: Math.random() * width,
              top: -20,
              backgroundColor: [
                palette.navy,
                palette.lime,
                palette.lime,
                palette.navy,
                palette.navyLift,
              ][index % 5],
              transform: [
                { translateY: anim.translateY },
                { translateX: anim.translateX },
              ],
              opacity: anim.opacity,
            },
          ]}
        />
      ))}

      {/* Content */}
      {/* ModalScroll: at 320pt tall (landscape) the card was taller than the
          screen — the X (top 16) and Got it were off-screen (audit 2026-10-22) */}
      <View style={[styles.wrapper, cd.s.wrapper]}>
        <ModalScroll contentStyle={{ alignItems: 'center' }} style={cd.s.scroll} reserve={cd.reserve}>
          <View style={[styles.card, cd.s.card]}>
            {/* ✅ CLOSE BUTTON (TOP RIGHT X) */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color={palette.textMuted} />
            </TouchableOpacity>

            {/* Success Icon */}
            <View style={[styles.iconWrapper, { backgroundColor: dialogTone.success.ring }, cd.s.hide]}>
              <Ionicons name="checkmark-circle" size={56} color={dialogTone.success.icon} />
            </View>

            {/* Title */}
            {/* ✅ Compact: with the icon hidden the title is the top line, level with
                the X — clearClose keeps a long title out from under it (2026-10-23) */}
            <Text style={[styles.title, cd.s.title, cd.compact && styles.clearClose]}>{title}</Text>

            {/* Message */}
            <Text style={[styles.message, cd.s.message]}>{message}</Text>

            {/* ✅ GOT IT BUTTON */}
            {/* Primary, not secondary: across this app secondary means "the OTHER
                choice" (cancel/close next to a primary). A lone acknowledge button
                has no other choice to sit beside, so it is the primary — which is
                what FeedbackSuccessModal and MembershipPlanModel already do. */}
            <TouchableOpacity
              style={[commonStyles.primaryButton, styles.button]}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <Text style={commonStyles.primaryButtonText}>
                {t('common:buttons.gotIt')}
              </Text>
            </TouchableOpacity>
          </View>
        </ModalScroll>
      </View>
    </Modal>
  );
};

export default SuccessCelebrationModal;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(palette.ink, 0.6),
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    ...shadows.overlay,

    backgroundColor: palette.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.fill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
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
        fontSize: 14,
    color: palette.textBody,
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  button: {
    width: '100%',
  },
  clearClose: {
    paddingHorizontal: 32,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});