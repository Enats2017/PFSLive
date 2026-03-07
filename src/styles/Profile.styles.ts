import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

export const profileStyles = StyleSheet.create({
  textsection: {
    alignItems: "center",
    paddingBottom: spacing.sm,
  },
  list: { 
    flexGrow: 1, 
    //paddingBottom: spacing.xl,
    //paddingHorizontal: spacing.md,
  },
  eventCard: { 
    marginBottom: spacing.md, 
    overflow: "hidden",
    padding: 0,
    paddingTop: spacing.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: 6,
    gap: 5,
  },
  badgeDot: { 
    width: 7, 
    height: 7, 
    borderRadius: 4 
  },
  badgeText: { 
    fontSize: 11, 
    fontWeight: "700", 
    letterSpacing: 0.5 
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxxl * 2,
  },
  loadMoreBtn: { 
    alignItems: "center", 
    paddingVertical: spacing.lg 
  },
  profileCard: {
    alignItems: "center",
    overflow: "hidden",
    paddingVertical: spacing.xl,
  },
  avatarWrapper: { 
    position: "relative", 
    marginVertical: spacing.md 
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderColor: colors.gray400,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { 
    width: "100%", 
    height: "100%" 
  },
  editIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.black,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  editButton: { 
    minWidth: 160 
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
  },
  content: {  
    paddingHorizontal: spacing.md, 
    paddingBottom: 100 
  },
  avatarFallback: {
    backgroundColor: colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.gray600,
    letterSpacing: 1,
  },
  cameraBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  removeBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  removeBtnText: { 
    fontSize: 13, 
    color: colors.primary, 
    fontWeight: "600" 
  },
  sectionHeader: {  
    marginBottom: spacing.sm 
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.gray500,
    letterSpacing: 1.5,
  },
  sectionSubtitle: { 
    fontSize: 12, 
    color: colors.gray400, 
    marginTop: 2 
  },
  sectionLine: { 
    height: 1, 
    backgroundColor: colors.gray200, 
    marginTop: 6 
  },
  readOnlyHint: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: -4,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  saveBtnDisabled: { 
    opacity: 0.6 
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.success + '15',
    borderRadius: 8,
  },
  successText: { 
    fontSize: 14, 
    color: colors.success, 
    fontWeight: "600" 
  },
});