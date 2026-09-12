import { StyleSheet } from "react-native";
import { spacing, palette, fonts, shadows, space, withAlpha, colors } from "./common.styles";

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
    borderRadius: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: space.md,
    gap: 5,
  },
  badgeDot: { 
    width: 7, 
    height: 7, 
    borderRadius: 3.5 
  },
  badgeText: { 
    fontFamily: fonts.bodySemi,
        fontSize: 11, 
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
    paddingHorizontal: space.xl, // ✅ ADDED: Horizontal padding for button
  },
  avatarWrapper: { 
    position: "relative", 
    marginVertical: spacing.md 
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderColor: palette.lime,
    borderWidth: 2.5,
    backgroundColor: palette.fill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
  },
  identityName: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
  },
  // 20_OtherProfile.png: "<place> - <country>" under the athlete's name.
  identityPlace: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },
  identityMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginTop: space.xs,
  },
  avatarImage: { 
    width: "100%", 
    height: "100%" 
  },
  editIcon: {
    ...shadows.hairline,

    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: palette.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontFamily: fonts.display,
        fontSize: 20,
    color: palette.ink,
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
    paddingHorizontal: space.xl, 
    paddingBottom: 100 
  },
  avatarFallback: {
    backgroundColor: palette.border,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontFamily: fonts.display,
        fontSize: 26,
    color: palette.textBody,
    letterSpacing: 1,
  },
  cameraBtn: {
    ...shadows.card,

    position: "absolute",
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 14,
    backgroundColor: palette.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: space.xl,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.navy,
  },
  removeBtnText: { 
    fontFamily: fonts.bodySemi,
        fontSize: 13, 
    color: palette.navy, 
    },
  // Introduces a new block of fields, so it needs air ABOVE it as well as below.
  // With only a bottom margin the "Change password" heading sat 8pt under the
  // field before it - closer to the previous block than to its own.
  sectionHeader: {
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemi,
        fontSize: 12,
    color: palette.textMuted,
    letterSpacing: 1.5,
  },
  sectionSubtitle: { 
    fontFamily: fonts.body,
        fontSize: 12, 
    color: palette.placeholder, 
    marginTop: 2 
  },
  sectionLine: { 
    height: 1, 
    backgroundColor: palette.border, 
    marginTop: 8 
  },
  // 08_EditProfile.png pairs first/last name and country/city on one line each.
  fieldRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  fieldHalf: {
    flex: 1,
    minWidth: 0,
  },

  readOnlyHint: {
    fontFamily: fonts.body,
        fontSize: 12,
    color: palette.placeholder,
    marginTop: -4,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  saveButton: {
    marginTop: space.xl,
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
    backgroundColor: withAlpha(palette.lime, 0.08),
    borderRadius: 10,
  },
  // Sits in the `successBanner` ROW beside an icon: without flex it sized to
  // its content and ran outside the banner instead of wrapping in it.
  successText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.bodySemi,
        fontSize: 13, 
    color: palette.lime, 
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
});