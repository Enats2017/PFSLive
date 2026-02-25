import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const optStyles = StyleSheet.create({
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff5f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: "#ffe0d6",
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: "#111827",
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.lg,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  email: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: "#FF5722",
    marginTop: spacing.sm,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    borderColor: "#d1d5db",
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    backgroundColor: "#fff",
    textAlign: "center",
  },
  otpInputFilled: {
    borderColor: "#FF5722",
    backgroundColor: "#fff5f0",
  },
  otpInputError: {
    borderColor: "#ef4444",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    fontSize: 13,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  verifyButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  resendLabel: {
    fontSize: typography.sizes.sm,
    color: "#6b7280",
  },
  resendLink: {
    fontSize: typography.sizes.sm,
    color:  colors.stationColor,
    fontWeight: typography.weights.bold,
  },
  countdown: {
    fontSize: typography.sizes.sm,
    color: "#9ca3af",
    fontWeight: typography.weights.semibold,
  },
});
