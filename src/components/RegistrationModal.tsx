import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { colors } from '../styles/common.styles';

type RegistrationStatus =
  | 'registered'
  | 'membership_required'
  | 'limit_reached'
  | 'unavailable'
  | 'available';

interface RegistrationModalProps {
  visible: boolean;
  status: RegistrationStatus | null;
  distanceName: string;
  onClose: () => void;
}

const getModalConfig = (status: RegistrationStatus) => {
  switch (status) {
    case 'registered':
      return {
        icon: '✓',
        title: "You're Already Registered!",
        description: "You're already registered for this distance. Get ready to race!",
        accentColor: colors.primaryLight,
      };

    case 'membership_required':
      return {
        icon: '◆',
        title: 'Your Premium Access Has Expired',
        description:
          'Your free trial period has ended. Log in to your account via our website to manage your access.',
        accentColor: '#f59e0b',
      };

    case 'limit_reached':
      return {
        icon: '↑',
        title: 'Your Premium Access Has Expired',
        description:
          "You've reached your yearly limit of 3 tracking sessions. Your current plan does not allow additional activations. Manage your subscription via our website.",
        accentColor: colors.primary,
      };

    case 'unavailable':
      return {
        icon: '⊘',
        title: 'Not Available',
        description: 'Registration for this distance is not yet configured. Please check back soon.',
        accentColor: '#6b7280',
      };

    case 'available':
      return {
        icon: '→',
        title: 'Ready to Race?',
        description: "Secure your spot now before it fills up. Let's do this!",
        accentColor: '#f4a100',
      };

    default:
      return {
        icon: '?',
        title: 'Something Went Wrong',
        description: 'Please try again later.',
        accentColor: '#6b7280',
      };
  }
};

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  visible,
  status,
  distanceName,
  onClose,
}) => {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(cardTranslateY, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, delay: 200, tension: 130, friction: 6, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(cardTranslateY, { toValue: 80, duration: 200, useNativeDriver: true }),
      ]).start();
      iconScale.setValue(0);
    }
  }, [visible]);

  if (!status) return null;

  const config = getModalConfig(status);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Card */}
      <View style={styles.wrapper} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY: cardTranslateY }],
              opacity: cardOpacity,
            },
          ]}
        >
          {/* Top accent bar */}
          <View style={[styles.accentBar, { backgroundColor: config.accentColor }]} />

          {/* Close button */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Icon */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: config.accentColor,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Text style={styles.iconText}>{config.icon}</Text>
          </Animated.View>

          {/* Distance chip */}
          {distanceName ? (
            <Text style={[styles.distanceName, { color: config.accentColor }]} numberOfLines={1}>
              {distanceName}
            </Text>
          ) : null}

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{config.description}</Text>

        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 10 },
    }),
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  iconText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
  },
  distanceName: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});

export default RegistrationModal;