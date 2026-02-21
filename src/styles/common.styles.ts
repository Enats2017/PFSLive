import { StyleSheet } from 'react-native';

// Colors
export const colors = {
  // Primary colors
  primary: '#FF5722', // Orange color
  primaryDark: '#E64A19',
  primaryLight: '#FF8A65',
  
  // Accent colors
  accent: '#4A9EFF',
  accentDark: '#2979FF',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#DC143C',
  info: '#2196F3',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Map colors
  routeColor: '#4A9EFF',
  stationColor: '#FF5722',
  participantColor: '#DC143C',
};

// Spacing
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Typography
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Common Styles
export const commonStyles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
  },
  
  // Text
  text: {
    fontSize: typography.sizes.md,
    color: colors.black,
    fontWeight: typography.weights.regular,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray500,
    fontWeight: typography.weights.medium,
  },
  
  // Loading
  loadingText: {
    fontSize: typography.sizes.md,
    color: colors.gray500,
    marginTop: spacing.md,
  },
  
  // Error
  errorText: {
    fontSize: typography.sizes.lg,
    color: colors.error,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  
  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: spacing.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Shadow
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

     favoriteButton: {
    backgroundColor: colors.info,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flex:1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  favoriteButtonText: {
     color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
    livetracking: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flex:1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
});