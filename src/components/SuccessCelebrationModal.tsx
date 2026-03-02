import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, commonStyles } from '../styles/common.styles';

interface SuccessCelebrationModalProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

const SuccessCelebrationModal: React.FC<SuccessCelebrationModalProps> = ({
  visible,
  message,
  onClose,
}) => {
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
    <Modal
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
                colors.primary,
                colors.success,
                '#FFD700',
                '#FF69B4',
                '#00CED1',
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
      <View style={styles.wrapper}>
        <View style={styles.card}>
          {/* ✅ CLOSE BUTTON (TOP RIGHT X) */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#64748b" />
          </TouchableOpacity>

          {/* Success Icon */}
          <View style={styles.iconWrapper}>
            <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Registration Successful!</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* ✅ GOT IT BUTTON */}
          <TouchableOpacity
            style={[commonStyles.primaryButton, styles.button]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={commonStyles.primaryButtonText}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default SuccessCelebrationModal;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconWrapper: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  button: {
    width: '100%',
    backgroundColor: colors.success,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});