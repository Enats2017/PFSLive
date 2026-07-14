import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

export const ownProfile = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.themeiColor,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    height: 115,
    backgroundColor: colors.themeiColor,
  },
  profileRow: {
    position: "absolute",
    top: 47,
    left: 0,
    right: 0,
    height: 140,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  avatarWrapper: {
    marginRight: 16,
  },
  avatar: {
    width: 125,
    height: 125,
    borderRadius: 62,
    borderWidth: 5,
    borderColor: colors.white,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.themeiColor,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 24,
    marginTop: 18,
  },
  statItem: {
    alignItems: "flex-start",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 11,
    color: colors.gray900,
    marginTop: 1,
  },
  whiteBody: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopRightRadius: 40,
    paddingTop: 83,
  },
  menuSection: {
    paddingHorizontal: spacing.md,
  },
  trackingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: colors.themeiColor,
    borderRadius: 14,
    padding: 14,
    marginTop: spacing.sm,
    marginBottom: 20,
    paddingHorizontal: spacing.md,
  },
  trackingTextWrapper: {
    flex: 1,
  },

  title: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray900,
    lineHeight: 20,
    marginBottom: 7,
  },

  subtitle: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 16,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 15,
  },
  menuTextWrapper: {
    flex: 1,
  },

  initialsWrapper: {
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontSize: 40,
    fontWeight: "800",
    color: colors.white,
    letterSpacing: 2,
  },

     backRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        paddingHorizontal:spacing.md
    },
    backLabel: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.gray900,
    },

     ioscard: {
        backgroundColor: '#16283A',
        borderRadius: 14,
        padding: 16,
        marginBottom:spacing.lg
        
    },
    iosheader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    iostitle: {
        marginLeft: 6,
        color: '#A6B1BE',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    iossubtitle: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '500',
        marginBottom: 14,
    },
    iosbold: {
        fontWeight: '700',
    },
    iosbutton: {
        backgroundColor: colors.themeiColor,
        borderRadius: 8,
        height: 44,
        paddingHorizontal: 16,
        
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iosbuttonText: {
        color: '#16283A',
        fontSize: 15,
        fontWeight: '700',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.themeiColor,
        borderRadius: 10,
        height: 48,
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
    },
    createBtnText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.gray900,
    },

});
