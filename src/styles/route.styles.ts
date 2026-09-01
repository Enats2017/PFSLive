import { StyleSheet } from 'react-native';
import { spacing, typography, palette, fonts, shadows } from './common.styles';

export const routeStyles = StyleSheet.create({
  // Distance Dropdown
  distanceDropdown: {
    backgroundColor: palette.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.fill,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: 0,
    borderBottomWidth: 2,
    borderBottomColor: palette.lime,
  },
  dropdownButtonText: {
    fontFamily: fonts.bodySemi,
        fontSize: 20,

        color: palette.ink,
  },
  dropdownArrow: {
    fontFamily: fonts.bodySemi,
        fontSize: 15,
    color: palette.textMuted,

        },
  dropdownList: {
    ...shadows.card,

    backgroundColor: palette.surface,
    borderRadius: 10,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: palette.fill,
    maxHeight: 200,
  },
  dropdownItem: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.page,
  },
  dropdownItemActive: {
    backgroundColor: palette.fill,
  },
  dropdownItemText: {
    fontFamily: fonts.bodyMedium,
        fontSize: 15,
    color: palette.ink,

        },
  dropdownItemTextActive: {
    color: palette.surface,
    fontFamily: fonts.bodySemi,
        fontSize: 13,
        },
  
  // Map Container
  mapContainer: {
    flex: 1,
  },
  
  // Chart Container
  chartContainer: {
    backgroundColor: palette.surface,
  },
});