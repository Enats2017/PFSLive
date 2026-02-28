import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { colors, spacing, typography } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

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
            <Text style={styles.icon}>🔄</Text>
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
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  versionInfo: {
    width: '100%',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  versionLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },
  versionValue: {
    fontSize: typography.sizes.sm,
    color: colors.black,
    fontWeight: typography.weights.semibold,
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.md,
  },
  button: {
    paddingVertical: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  updateButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  laterButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  laterButtonText: {
    color: colors.gray600,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  forcedText: {
    fontSize: typography.sizes.xs,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: typography.weights.medium,
  },
});