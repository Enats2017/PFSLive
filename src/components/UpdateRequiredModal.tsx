import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

interface UpdateRequiredModalProps {
  visible: boolean;
  isForced: boolean;
  currentVersion: string;
  latestVersion: string;
  title: string; // FROM API
  message: string; // FROM API
  onUpdate: () => void;
  onLater?: () => void;
}

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
  const { t } = useTranslation(['common']); // ✅ ADD TRANSLATION HOOK

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔄</Text>
          </View>

          {/* ✅ Title from API (backend controls language) */}
          <Text style={styles.title}>{title}</Text>

          {/* ✅ Message from API (backend controls language) */}
          <Text style={styles.message}>{message}</Text>

          {/* ✅ Version Info - NOW TRANSLATED */}
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
            {/* ✅ UPDATE NOW - NOW TRANSLATED */}
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={onUpdate}
            >
              <Text style={styles.updateButtonText}>
                {t('common:update.updateNow')}
              </Text>
            </TouchableOpacity>

            {/* ✅ LATER - NOW TRANSLATED */}
            {!isForced && onLater && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={onLater}
              >
                <Text style={styles.laterButtonText}>
                  {t('common:update.later')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ✅ Forced Message - NOW TRANSLATED */}
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
  },
  updateButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
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