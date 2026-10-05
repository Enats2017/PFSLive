import { StyleSheet } from 'react-native';
import { palette, radii, shadows, space, fonts, type } from './common.styles';

// Kept as a named export because the screen and MembershipPlanModel both read it.
export const COLORS = {
    navy: palette.navy,
    lime: palette.lime,
    limeDark: palette.lime,
    bg: palette.page,
    white: palette.surface,
    grayText: palette.textMuted,
    darkText: palette.ink,
    infoBg: palette.noticeBg,
    infoText: palette.noticeText,
    border: palette.border,
};

// ✅ Redesign: 33_Membership.png / 34_Membership-Terms.png.
// Layout note — plan name, sessions badge and price share ONE row. That is what
// makes three tiers plus every App Review 3.1.2 disclosure fit a phone screen;
// stacking the price under the name pushes the disclosures off the bottom.
export const membershipPlansStyle = StyleSheet.create({
    scroll: {
        flex: 1,
        backgroundColor: palette.surface,
    },
    scrollContent: {
        paddingHorizontal: space.xl,
        paddingTop: space.lg,
        paddingBottom: space.xl,
    },

    // ── Hero ───────────────────────────────────────────────────────────
    headerTitle: {
        ...type.h2,
    },
    headerSubtitle: {
        ...type.body,
        marginTop: space.xs,
    },

    // ── Info banner ────────────────────────────────────────────────────
    infoBanner: {
        backgroundColor: palette.noticeBg,
        borderRadius: radii.md,
        padding: space.md,
        marginTop: space.md,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
    },
    infoBannerText: {
        ...type.small,
        color: palette.noticeText,
        flex: 1,
    },

    // ── Plan card ──────────────────────────────────────────────────────
    card: {
        borderRadius: radii.md,
        // Asymmetric on purpose. `popularBadge` and `checkCircle` are absolute at
        // top: -8 and hang half outside the card, so the first flow child — planRow
        // — has to start below where they end. At the old paddingVertical of 12 the
        // badge's lower edge (-8 + 20 = 12) landed exactly on the plan name's row,
        // which is why "Most popular" and the sessions badge read as one glued lump
        // on the popular card. 20 leaves 8pt of air under the badge and 10 under the
        // tick. Applied to EVERY card, not just the badged one: the tick appears on
        // whichever card is selected, and making the padding conditional would
        // resize cards as the selection moved.
        paddingTop: space.xl,
        paddingBottom: space.md,
        paddingHorizontal: space.xl,
        marginTop: space.lg,
        position: 'relative',
    },
    cardUnselected: {
        backgroundColor: palette.surface,
        borderWidth: 1.5,
        borderColor: palette.border,
    },
    cardSelected: {
        backgroundColor: palette.navy,
        ...shadows.raised,
    },
    // Badge and tick sit half outside the card, as drawn.
    popularBadge: {
        position: 'absolute',
        top: -8,
        left: 14,
        backgroundColor: palette.lime,
        borderRadius: radii.sm,
        paddingVertical: space.xs,
        paddingHorizontal: space.sm,
    },
    popularBadgeText: {
        fontFamily: fonts.bodySemi,
        fontSize: 10,
        // Pinned so the badge's height does not drift with the platform's default
        // line height — the card's paddingTop above is calculated against it.
        lineHeight: 12,
        letterSpacing: 0.4,
        // The string stays sentence case; the CAPS are a display choice, so
        // French and Dutch capitalise by their own rules.
        textTransform: 'uppercase',
        color: palette.ink,
    },
    checkCircle: {
        position: 'absolute',
        top: -8,
        right: 14,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: palette.lime,
        alignItems: 'center',
        justifyContent: 'center',
    },

    planRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
    },
    planName: {
        ...type.h3,
        flexShrink: 0,
    },
    sessionsBadge: {
        flexShrink: 1,
        // Without minWidth a flex child will not shrink below its own content, so a
        // long badge ("Unlimited sessions / year" is the API-less fallback) pushed
        // the price off the row instead of ellipsizing. The badge is the only thing
        // on this row that may give way — name and price are both flexShrink: 0.
        minWidth: 0,
        backgroundColor: palette.fill,
        borderRadius: radii.sm,
        paddingVertical: space.xs,
        paddingHorizontal: space.sm,
    },
    sessionsBadgeLime: {
        backgroundColor: palette.lime,
    },
    sessionsBadgeText: {
        fontFamily: fonts.bodySemi,
        fontSize: 10,
        letterSpacing: 0.4,
        color: palette.navy,
    },
    sessionsBadgeTextSelected: {
        color: palette.ink,
    },
    spacer: {
        flex: 1,
    },
    price: {
        flexShrink: 0,
        fontFamily: fonts.display,
        fontSize: 20,
        color: palette.ink,
    },
    period: {
        ...type.small,
        // "/ year" must not wrap onto a second line — that would double the row's
        // height and drop the price out of line with the name beside it.
        flexShrink: 0,
    },

    featuresWrapper: {
        marginTop: space.sm,
        gap: space.xs,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
    },
    featureText: {
        ...type.small,
        color: palette.textBody,
        flex: 1,
    },

    // On the selected (navy) card everything flips to the light-on-navy set.
    textLight: {
        color: palette.surface,
    },
    mutedLight: {
        color: palette.textOnNavy,
    },

    // ── the one-off activation, below the subscription cards ──
    // Deliberately NOT a plan card: it is a consumable, it has no period, and it
    // is bought on its own button rather than through "Continue with <plan>".
    // Drawn with the same tokens as the plan cards above — name on type.h3 and
    // price on display/20 — so the two read as one family despite the different
    // product. It arrived from master on the pre-redesign fontSize/fontWeight
    // pairs; those are what the design audit rejects, so they were mapped onto
    // the ramp rather than carried over.
    activationDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: space.lg,
        marginBottom: space.sm,
    },
    activationDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    activationDividerText: {
        ...type.smallSemi,
        color: palette.textMuted,
        marginHorizontal: space.md,
    },
    activationCard: {
        backgroundColor: COLORS.white,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: space.lg,
    },
    activationTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    activationName: {
        ...type.h3,
        flexShrink: 1,
        minWidth: 0,
        paddingRight: space.sm,
    },
    // Same treatment as `price` above — a consumable is still a price.
    activationPrice: {
        flexShrink: 0,
        fontFamily: fonts.display,
        fontSize: 20,
        color: palette.ink,
    },
    activationDescription: {
        ...type.body,
        marginTop: space.sm,
    },
    activationNote: {
        ...type.caption,
        marginTop: space.xs,
    },
    activationBuyButton: {
        marginTop: space.md,
        minHeight: 48,
        borderRadius: radii.md,
        backgroundColor: COLORS.lime,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xl,
    },
    activationBuyText: {
        fontFamily: fonts.display,
        fontSize: 15,
        color: palette.ink,
    },

    // ── Purchase disclosures ───────────────────────────────────────────
    // ⚠️ App Review 3.1.2. footerNote, subscriptionInfo, Restore Purchases and
    // both legal links must stay on this screen and stay legible. Do not shrink
    // or drop them to win space — the plan cards give space up first.
    footerNote: {
        ...type.small,
        textAlign: 'center',
        marginTop: space.lg,
    },
    subscriptionInfoText: {
        ...type.small,
        textAlign: 'center',
        marginTop: space.md,
    },
    // Same undersized text link as loginStyles.forgotButton: 4pt padding around
    // 12pt text is ~25pt, well under the 44/48pt minimum.
    restoreButton: {
        alignSelf: 'center',
        justifyContent: 'center',
        marginTop: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.md,
        minHeight: 44,
    },
    restoreButtonText: {
        fontFamily: fonts.bodySemi,
        fontSize: 12,
        color: palette.navy,
        textDecorationLine: 'underline',
    },
    legalLinksRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginTop: space.md,
    },
    legalLinkText: {
        fontFamily: fonts.bodySemi,
        fontSize: 12,
        color: palette.navy,
        textDecorationLine: 'underline',
    },
    legalLinkSeparator: {
        ...type.small,
    },

    // ── Pinned CTA ─────────────────────────────────────────────────────
    // Outside the ScrollView on purpose: the primary action stays reachable
    // however far down the disclosures the reader has scrolled.
    ctaWrapper: {
        paddingHorizontal: space.xl,
        paddingTop: space.md,
        paddingBottom: space.xl,
        backgroundColor: palette.surface,
        borderTopWidth: 1,
        borderTopColor: palette.border,
    },
});
