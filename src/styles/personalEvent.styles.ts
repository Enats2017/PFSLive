import { colors, spacing, typography } from "./common.styles";
import { StyleSheet } from "react-native";
export const personalStyles = StyleSheet.create({
  section: {
    alignItems: "center",
    padding: 6,
    backgroundColor: colors.gray300,
    marginVertical: spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginTop: spacing.sm,
    fontSize: typography.sizes.md,
    color: colors.gray600,
    fontWeight: typography.weights.medium,
  },

  formContainer: {
    paddingHorizontal: 15,
  },

  uploadBox: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5ebe8cc",
  },

  uploadTitle: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  uploadSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.black,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fileLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  fileSize: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
});
