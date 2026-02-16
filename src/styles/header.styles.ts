import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  // Left Section - Logo only
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  logo: {
    width: 32,
    height: 32,
    backgroundColor: colors.black,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    color: colors.white,
    fontSize: 20,
    fontWeight: typography.weights.bold,
  },
  
  // Center Section - Title
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  
  // Right Section - Icons
  rightSection: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
  },
  iconButton: {
    padding: spacing.xs,
  },
  icon: {
    fontSize: 24,
    color: colors.black,
  },
});