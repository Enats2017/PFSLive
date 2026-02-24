import { colors, spacing, typography } from "./common.styles";
import { StyleSheet } from "react-native";

export const loginStyles = StyleSheet.create({
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 32,
  },

  cardscetion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    marginBottom: 0, // ✅ Reduced from spacing.md to spacing.xs (12px → 4px)
    paddingHorizontal: spacing.md,
  },
   logo: {
    width: 80, // Smaller logo for side-by-side
    height: 80,
    marginRight: spacing.sm, // Space between logo and text (8px)
  },

   textSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },


  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff5f0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#ffe0d6",
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
  formSection: {
    flex: 1,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 20,
  },
  forgotText: {
    fontSize: 13,
    color: "#FF5722",
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
  },
  registerButton: {
    alignItems: "center",
    paddingVertical: 4,
  },
  registerText: {
    fontSize: 14,
    color: "#6b7280",
  },
  registerLink: {
    color: "#FF5722",
    fontWeight: "700",
  },
});
