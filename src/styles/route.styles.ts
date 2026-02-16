import { StyleSheet } from 'react-native';
import { colors, spacing, typography } from './common.styles';

export const routeStyles = StyleSheet.create({
  // Distance Dropdown
  distanceDropdown: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  dropdownButtonText: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  dropdownArrow: {
    fontSize: typography.sizes.md,
    color: colors.gray500,
    fontWeight: typography.weights.bold,
  },
  dropdownList: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray100,
    maxHeight: 200,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray50,
  },
  dropdownItemActive: {
    backgroundColor: colors.accent,
  },
  dropdownItemText: {
    fontSize: typography.sizes.md,
    color: colors.black,
    fontWeight: typography.weights.medium,
  },
  dropdownItemTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  
  // Map Container
  mapContainer: {
    flex: 1,
  },
  
  // Chart Container
  chartContainer: {
    backgroundColor: colors.white,
  },
});