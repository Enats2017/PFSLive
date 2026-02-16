import { StyleSheet } from 'react-native';

export const colors = {
  // Primary Colors
  primary: '#DC143C',
  primaryDark: '#B71C1C',
  primaryLight: '#FF6B6B',
  
  // Accent Colors
  accent: '#4A9EFF',
  accentDark: '#2196F3',
  
  // Neutral Colors
  black: '#000000',
  white: '#FFFFFF',
  gray50: '#F5F5F5',
  gray100: '#E0E0E0',
  gray200: '#CCCCCC',
  gray300: '#AAAAAA',
  gray400: '#999999',
  gray500: '#666666',
  gray600: '#333333',
  
  // Status Colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#DC143C',
  info: '#2196F3',
  
  // Map Colors
  routeMain: '#DC143C',
  routeOutline: '#8B0000',
  stationDot: '#000000',
  participantDot: '#4CAF50',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const typography = {
  sizes: {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 22,
    xxxl: 28,
    huge: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const commonStyles = StyleSheet.create({
  // Containers
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    padding: spacing.xl,
  },
  
  // Card
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xxl,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
  },
  
  // Text
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.black,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    color: colors.gray500,
  },
  body: {
    fontSize: typography.sizes.md,
    color: colors.gray600,
  },
  caption: {
    fontSize: typography.sizes.sm,
    color: colors.gray400,
  },
  
  // Loading
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.lg,
    color: colors.gray500,
  },
  
  // Error
  errorText: {
    fontSize: typography.sizes.lg,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  
  // Shadow
  shadow: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});