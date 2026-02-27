import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "./common.styles";

export const registerStyles = StyleSheet.create({
  imagesection: {
    alignItems: "center",
    marginVertical: 20,
  },

  imageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },

  cameraIcon: {
    position: "absolute",
    bottom: 15,
    right: 15,
    backgroundColor: "#FF5722",
    borderRadius: 20,
    padding: 6,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 5,
    paddingHorizontal: 6,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxActive: {
    backgroundColor: "#FF5722",
    borderColor: "#FF5722",
  },

  termsText: {
    fontSize: spacing.lg,
    color: "#374151",
  },
  buttonSection: {
    marginTop: 18,
  },
  removeIcon: {
    position: "absolute",
    top: 10,
    right: 20,
    width: 20,
    height: 20,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4, 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

   forgotText: {
    fontSize: 13,
    color: "#FF5722",
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
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
