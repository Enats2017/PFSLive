import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { spacing, typography, palette, fonts, shadows, withAlpha } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

interface UpdateRequiredModalProps {
  visible: boolean;
  isForced: boolean;
  currentVersion: string;
  latestVersion: string;
  title: string;
  message: string;
  onUpdate: () => void;
  onLater?: () => void;
}

// ✅ FIX: Regular function component (not memo for now)
export const UpdateRequiredModal: React.FC<UpdateRequiredModalProps> = ({
  visible,
  isForced,
  currentVersion,
  latestVersion,
  title,
  message,
  onUpdate,
  onLater,
}) => {
  const { t } = useTranslation(['common']);

  // Early return if not visible
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated={true}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="refresh" size={30} color={palette.navy} />
          </View>

          {/* Title from API */}
          {title ? (
            <Text style={styles.title}>{title}</Text>
          ) : null}

          {/* Message from API */}
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          {/* Version Info */}
          <View style={styles.versionInfo}>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>
                {t('common:update.currentVersion')}:
              </Text>
              <Text style={styles.versionValue}>{currentVersion}</Text>
            </View>
            <View style={styles.versionRow}>
              <Text style={styles.versionLabel}>
                {t('common:update.latestVersion')}:
              </Text>
              <Text style={styles.versionValue}>{latestVersion}</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {/* Update Button */}
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={onUpdate}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonText}>
                {t('common:update.updateNow')}
              </Text>
            </TouchableOpacity>

            {/* Later Button */}
            {!isForced && onLater && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={onLater}
                activeOpacity={0.8}
              >
                <Text style={styles.laterButtonText}>
                  {t('common:update.later')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Forced update warning */}
          {isForced && (
            <Text style={styles.forcedText}>
              {t('common:update.forcedMessage')}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  container: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...shadows.card,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: withAlpha(palette.navy, 0.13),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontFamily: fonts.body,
        fontSize: 40,
  },
  title: {
    fontFamily: fonts.bodySemi,
        fontSize: 26,

        color: palette.ink,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textBody,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  versionInfo: {
    width: '100%',
    backgroundColor: palette.fill,
    borderRadius: 10,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  versionLabel: {
    fontFamily: fonts.bodyMedium,
        fontSize: 13,
    color: palette.textBody,

        },
  versionValue: {
    fontFamily: fonts.bodySemi,
        fontSize: 13,
    color: palette.ink,

        },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: palette.navy,
    ...shadows.card,
  },
  updateButtonText: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        letterSpacing: 0.5,
  },
  laterButton: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  laterButtonText: {
    color: palette.textBody,
    fontFamily: fonts.bodySemi,
        fontSize: 15,

        },
  forcedText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 12,
    color: palette.danger,
    textAlign: 'center',
    marginTop: spacing.md,

        },
});