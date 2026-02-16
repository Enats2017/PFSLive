import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const bottomNavStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
    elevation: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  icon: {
    fontSize: 24,
    marginBottom: 4,
    opacity: 0.6,
  },
  iconActive: {
    opacity: 1,
  },
  label: {
    fontSize: typography.sizes.xs,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  labelActive: {
    color: colors.accent,
    fontWeight: typography.weights.semibold,
  },
});