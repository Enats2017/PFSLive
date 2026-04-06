import { StyleSheet } from "react-native";
import { colors, typography } from "../styles/common.styles";

export const favstyle = StyleSheet.create({
  wrapper: {
    paddingVertical: 5,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
    paddingBottom: 10,
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 120,
    height: 33,
    zIndex: 3,
  },

  diagLeft: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 33,
    borderRightWidth: 20,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    zIndex: 2,
  },

  headerMiddle: {
    flex: 1,
  },

  diagRight: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderTopWidth: 33,
    borderRightWidth: 0,
    borderLeftWidth: 20,
    borderTopColor: colors.primary,
    borderRightColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    zIndex: 2,
  },

  headerRight: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    width: 120,
    height: 33,
    zIndex: 1,
  },

  body: {
    alignItems: "center",
    paddingTop: 10,
  },

  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 8,
  },

  profilePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  profileInitials: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.gray700,
  },


  finishTime: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginTop: 4,
    letterSpacing: 0.5,
  },

  addButtonContainer: {
    position: "absolute",
    bottom: 140,
    right: 25,
  },

  addButton: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },

  bibBox: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
    marginLeft: 10,
  },

  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },

  righticon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
   
  },

  addBtnActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },

  participantcard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 5,
    marginVertical: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});