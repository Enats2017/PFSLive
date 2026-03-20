import { StyleSheet } from "react-native";
import { colors, commonStyles } from "../styles/common.styles";

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
    backgroundColor: colors.gray400,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    width: 120,
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
    borderTopColor: colors.gray400,
    borderRightColor: "transparent",
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
    borderLeftColor: "transparent",
    zIndex: 2,
  },

  headerRight: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 14,
    paddingLeft: 4,
    width: 120,

    zIndex: 1,
  },

  headerRightText: {
    color: "#FCEBEB",
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: 0.6,
  },

  body: {
    alignItems: "center",
  },

  addButtonContainer: {
    position: "absolute",
    bottom: 140, // sits above BottomNavigationFollower
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
    marginRight:5
  },
  addBtnActive:{
    width: 34,
    height: 34,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight:5

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
