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
import { useTranslation } from 'react-i18next';
import { commonStyles, spacing, palette, fonts, shadows, space } from '../styles/common.styles';
import { useNavigation } from '@react-navigation/native';

type RegistrationStatus =
  | 'registered'
  | 'membership_required'
  | 'limit_reached'
  | 'membership_upcoming'  // ✅ NEW
  | 'unavailable'
  | 'available'
  | 'connect_confirm';

interface RegistrationModalProps {
  visible: boolean;
  status: RegistrationStatus | null;
  distanceName: string;
  membershipLimit?: number;
  membershipStartDate?: string;  // ✅ NEW
  onClose: () => void;
   onConfirm?: () => void;
}

interface ModalConfig {
  icon: string;
  title: string;
  description: string;
  accentColor: string;
  buttonLabel: string | null;
  notNowLabel?: string;
}

const UPGRADE_STATUSES: RegistrationStatus[] = ['membership_required', 'limit_reached'];

const RegistrationModal: React.FC<RegistrationModalProps> = ({
  visible,
  status,
  distanceName,
  membershipLimit,
  membershipStartDate,  // ✅ NEW
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation(['details']);
  const navigation = useNavigation<any>();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(80)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;

  // ✅ GET MODAL CONFIG FROM i18n
  const getModalConfig = (status: RegistrationStatus): ModalConfig => {
    const baseKey = `details:registrationModal.${status}`;
    if (status === 'connect_confirm') {
      return {
        icon: t('details:registrationModal.connect_confirm.icon'),
        title: t('details:registrationModal.connect_confirm.title'),
        description: t('details:registrationModal.connect_confirm.description'),
        accentColor: palette.navy,
        buttonLabel: t('details:registrationModal.connect_confirm.button'),
        notNowLabel: t('details:registrationModal.connect_confirm.notNowButton'),
      };
    }
     const showUpgradeButton = Platform.OS === 'ios' && UPGRADE_STATUSES.includes(status);

    const accentColors: Record<Exclude<RegistrationStatus, 'connect_confirm'>, string> = {
      registered:           palette.navyLift,
      membership_required:  palette.navy,
      limit_reached:        palette.navy,
      membership_upcoming:  palette.warning,   // ✅ NEW — orange/amber for "future"
      unavailable:          palette.textMuted,
      available:            palette.warning,
    };
     const descriptionKey = showUpgradeButton
      ? `${baseKey}.iosDescription`
      : `${baseKey}.description`;

     return {
      icon:        t(`${baseKey}.icon`),
      title:       t(`${baseKey}.title`),
      description: t(descriptionKey, {
        limit: membershipLimit ?? 3,
        date:  membershipStartDate ?? '',
        defaultValue: t(`${baseKey}.description`, {
          limit: membershipLimit ?? 3,
          date:  membershipStartDate ?? '',
        }),
      }),
      accentColor: accentColors[status],
      buttonLabel: showUpgradeButton
        ? t(`${baseKey}.button`, { defaultValue: t('details:registrationModal.viewPlansButton') })
        : null,
    };
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(cardTranslateY, {
          toValue: 0,
          tension: 70,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(iconScale, {
          toValue: 1,
          delay: 200,
          tension: 130,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 80,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      iconScale.setValue(0);
    }
  }, [visible, backdropOpacity, cardTranslateY, cardOpacity, iconScale]);

  if (!status) return null;

  const config = getModalConfig(status);
   const handleUpgradePress = () => {
  if (status === 'connect_confirm') {
    onConfirm?.();
    return;
  }
  onClose();
  navigation.navigate('MembershipPlansScreen');
};


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
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
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
                backgroundColor: palette.fill,
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Text style={styles.iconText}>{config.icon}</Text>
          </Animated.View>

          {/* Distance chip */}
          {distanceName ? (
            <Text
              style={[styles.distanceName, { color: config.accentColor }]}
              numberOfLines={1}
            >
              {distanceName}
            </Text>
          ) : null}

          {/* Title */}
          <Text style={styles.title}>{config.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{config.description}</Text>
          {config.buttonLabel && (
          <View style = {{width:"100%", paddingTop:spacing.md}} >
            {status === 'connect_confirm' ? (
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[commonStyles.secondaryButton]}
                  activeOpacity={0.7}
                  onPress={onClose}
                >
                  <Text style={commonStyles.secondaryButtonText}>
                    {config.notNowLabel}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[commonStyles.primaryButton, styles.confirmBtnRow, styles.modalPrimary]}
                  activeOpacity={0.85}
                  onPress={handleUpgradePress}
                >
                  <Text style={[commonStyles.primaryButtonText, styles.modalPrimaryText]}>{config.buttonLabel}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[commonStyles.primaryButton, styles.modalPrimary]}
                  activeOpacity={0.85}
                  onPress={handleUpgradePress}
                >
                  <Text style={[commonStyles.primaryButtonText, styles.modalPrimaryText]}>{config.buttonLabel}</Text>
                </TouchableOpacity>
                <Text style={[styles.description, { marginTop: spacing.sm }]}>
                  {t('details:iosnotnow')}
                </Text>
              </>
            )}
          </View>
          )}
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
    backgroundColor: palette.surface,
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
    ...shadows.raised,
  },
  // The deck's modal action is the lime button with ink text.
  modalPrimary: {
    backgroundColor: palette.lime,
  },
  modalPrimaryText: {
    color: palette.ink,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.navy,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeBtnText: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.surface,
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
    fontFamily: fonts.display,
    fontSize: 26,
    color: palette.navy,
  },
  distanceName: {
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
    marginBottom: space.md,
    lineHeight: 28,
  },
  description: {
    fontFamily: fonts.body,
        fontSize: 13,
    lineHeight: 22,
    color: palette.textMuted,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
 buttonRow: {
  flexDirection: 'row',
  gap: spacing.sm,
},

confirmBtnRow: {
  flex: 1,
},

});

export default RegistrationModal;