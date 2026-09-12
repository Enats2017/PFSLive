import { StyleSheet } from "react-native";
import { colors, spacing } from "./common.styles";

export const profileStyles = StyleSheet.create({
  textsection: {
    alignItems: "center",
    paddingBottom: spacing.sm,
  },
  list: { 
    flexGrow: 1, 
  },
  eventCard: { 
    marginBottom: spacing.md, 
   
    padding: 0,
    paddingTop: spacing.sm,
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
    paddingHorizontal: spacing.md, // ✅ ADDED: Horizontal padding for button
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
    width: '100%', // ✅ UPDATED: Full width
    alignSelf: 'center',
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
  emailFieldWrapper: {
    marginBottom: spacing.sm,
  },
  // ✅ Shown only while the typed email differs from the saved one — the
  // consequence (an OTP round-trip) is only worth saying at the moment the
  // user actually triggers it. The confirm modal on Save is the hard gate;
  // this is the early warning.
  emailChangeHintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: -spacing.xs,
    marginLeft: 4,
    paddingRight: spacing.sm,
  },
  emailChangeHintIcon: {
    color: colors.gray400,
    marginTop: 1,
  },
  emailChangeHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray400,
  },
  // ✅ The save commits pending_email server-side *before* the OTP screen
  // opens, so backing out of that screen leaves state the user cannot see.
  // This banner is the only surface that state has.
  pendingEmailBanner: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.warning + '15',
    borderRadius: 8,
  },
  pendingEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pendingEmailText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gray900,
  },
  pendingEmailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginLeft: 28,
  },
  pendingEmailAction: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
  pendingEmailActionMuted: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.gray400,
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