import { StyleSheet } from "react-native";
import { spacing, palette, fonts, shadows, space, withAlpha } from "./common.styles";

export const profileStyles = StyleSheet.create({
  // ✅ PARENT / GUARDIAN CONSENT — only rendered when the date of birth being
  // saved puts the person at 13 to 17. Deliberately the same shape as the terms
  // checkbox in Register.styles.ts so the two read alike; kept here rather than
  // imported from there because styles are per-screen in this repo.
  consentContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  // Same shape as the terms checkbox the comment above refers to — that is
  // `registerStyles.checkbox`, which the redesign draws round (radius 11 on a
  // 22pt box) rather than the 6pt square this arrived from master with.
  consentCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: palette.inputBorder,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.surface,
    marginTop: 2,
  },
  consentCheckboxActive: {
    backgroundColor: palette.navy,
    borderColor: palette.navy,
  },
  // Consent already on file. It cannot be withdrawn from here - edit_profile_api
  // has no branch that writes parent_consent back to 0 for a 13-to-17 date, so a
  // tappable box would untick, save, and come back ticked. Dimmed so it reads as
  // settled rather than broken.
  consentCheckboxLocked: {
    opacity: 0.6,
  },
  // Matches registerStyles.termsText / errorText, so consent reads as the same
  // kind of control as the terms tick it sits beside.
  consentText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.textBody,
    flex: 1,
  },
  consentError: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.danger,
    marginTop: 2,
    paddingHorizontal: spacing.xs,
  },

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
    gap: space.sm,
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
    gap: space.sm,
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
    color: palette.textMuted,
    marginTop: 1,
  },
  emailChangeHintText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: palette.textMuted,
  },
  // ✅ The save commits pending_email server-side *before* the OTP screen
  // opens, so backing out of that screen leaves state the user cannot see.
  // The banner itself is <NoticeCard> — the deck's amber notice — so only the
  // action row below its message is styled here.
  pendingEmailWrapper: {
    marginTop: -space.xs,
    marginBottom: space.sm,
  },
  pendingEmailActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    marginTop: space.sm,
  },
  pendingEmailAction: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: palette.navy,
  },
  pendingEmailActionMuted: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: palette.textMuted,
  },
});