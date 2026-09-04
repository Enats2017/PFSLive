import { StyleSheet, TextStyle, ViewStyle } from 'react-native';

// ══ Design tokens (Livio redesign, client-approved 2026-08-29) ══════════════
// Lifted from the approved artboards in D:	emp_chrome_download\livio\Livio_UI_source.
// These are the ONLY values new/migrated screens may use. The legacy `colors`,
// `spacing` and `typography` exports below stay untouched until every screen that
// reads them has moved over — changing them in place would shift 69 screens at once.

/** Closed colour set. Nothing outside this may appear in a migrated screen. */
export const palette = {
  // Navy — headers, primary buttons, selected surfaces
  navy: '#0F2447',
  navyDeep: '#0A1A33',   // gradient start
  navyLift: '#14294F',   // gradient end
  ink: '#081C2C',        // headings on white, text on lime
  inkSoft: '#0D2235',    // field values

  // Brand
  lime: '#C7D92C',       // title band, active nav pill, check marks

  // Text
  textBody: '#4A5A6A',   // paragraphs on white
  textMuted: '#6B7C8D',  // captions, meta, secondary
  textOnNavy: '#A9BDD1', // secondary text on a navy surface
  placeholder: '#9CA3AF',

  // Surfaces
  page: '#F4F6F5',
  surface: '#FFFFFF',
  fill: '#EEF2F6',       // pills, avatars, inert chips
  border: '#E4EAF0',
  inputBorder: '#D1D5DB',

  // Status
  danger: '#DC143C',
  dangerBg: '#FDECEF',
  warning: '#B98900',        // the icon/accent amber only
  warningBg: '#FFF8E6',
  warningBorder: '#F0DFA8',
  // The deck darkens amber COPY well below the accent: #B98900 on #FFF8E6 is
  // too low-contrast to read, so title and body get their own values.
  warningTitle: '#6B4E00',
  warningText: '#7A5E10',
  noticeBg: '#F5F8E8',   // lime-tinted info banner
  noticeText: '#3C4A1E',
} as const;

/** 4pt spacing scale. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Three box radii — plus `pill` for anything circular. */
export const radii = {
  sm: 10,   // pills, badges, small chips
  md: 14,   // cards, buttons, inputs
  lg: 16,   // sheets, banners
  pill: 999,
} as const;

// CSS blur maps to roughly half that value as an iOS shadowRadius, so the design's
// `0 2px 12px` becomes offset 2 / radius 6. Android gets the nearest elevation.
/** Four shadows. Nothing else. */
export const shadows: Record<'card' | 'raised' | 'hairline' | 'overlay', ViewStyle> = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  raised: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  hairline: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1.5,
    elevation: 2,
  },
  overlay: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
};

/**
 * A token colour at partial opacity. Chart and map fills need a translucent
 * tint of the same colour as their stroke; writing that by hand is how a
 * retired blue survived under a navy outline.
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Map and chart colours.
 *
 * Kept separate from `palette` on purpose: these are DATA colours, not chrome.
 * A route line and a checkpoint marker have to stay distinguishable from each
 * other on a satellite basemap, which the navy/lime pair alone cannot do — but
 * they still come from one declared set rather than being invented per file.
 */
export const mapColors = {
  // ── Restored to the pre-redesign values (2026-09-04 request) ─────────────
  // These are DATA colours on a satellite basemap, not chrome. The redesign
  // re-pointed them at the navy/lime brand palette, which lost the distinctions
  // the map relies on: start vs finish vs checkpoint vs you vs everyone else
  // have to stay apart at a glance, and lime route lines disappeared over
  // terrain. The literals below are the ones the old map shipped with.

  // ── Live tracking map (LiveMap/LiveRouteMap.tsx) ──
  route: '#3B82F6',        // was palette.navy      — the course line, blue
  routeCasing: '#1E293B',  // was mapColors.checkpoint — the outline under it
  kmMarker: '#475569',     // was palette.textBody  — neutral km dot anchor
  start: '#22C55E',        // was #2E7D32           — green
  finish: '#EF4444',       // was palette.danger    — red
  checkpoint: '#1a1a2e',   // was palette.ink       — dark
  participant: '#F97316',  // was palette.lime      — orange, tracked athletes
  follower: '#6366F1',     // was palette.navyLift  — indigo, YOUR own marker
  offline: '#94A3B8',      // was palette.textOnNavy — slate, a stale fix

  // ── Static GPX route preview (RouteMap.tsx) ──
  gpxRoute: '#E53935',        // was palette.danger
  gpxRouteCasing: '#B71C1C',  // was mapColors.finish
  gpxKmStroke: '#000000',     // was mapColors.checkpoint
  gpxParticipant: '#4CAF50',  // was mapColors.start

  markerStroke: '#FFFFFF',
} as const;

/**
 * Race-category accents. Result cards mark the women's category with a colour;
 * it carries information, so it is a token rather than a decoration.
 */
export const categoryColors = {
  women: '#FF007F',
  men: palette.navy,
  /**
   * Card ground for a result list filtered to the women's category.
   * 26_ResultList.png draws no left accent on a result card, so the category
   * cannot be shown as an edge stripe there - the whole card tints instead.
   * A wash this light keeps the navy/muted text well clear of AA contrast.
   */
  womenSurface: withAlpha('#FF007F', 0.06),
  /**
   * The stats divider on a women-tinted card. `palette.border` is a cool grey
   * that reads as a hard dark line across the warm tint; this is the same hue
   * as the card, just strong enough to separate the rows.
   */
  womenDivider: withAlpha('#FF007F', 0.18),
} as const;

/** Chart axes, gridlines and series. */
export const chartColors = {
  axis: palette.border,
  grid: palette.border,
  label: palette.textMuted,
  elevation: palette.navy,
  elevationFill: palette.fill,
  marker: palette.lime,
  current: palette.danger,
} as const;

/**
 * Font families. Loaded in App.tsx — until that resolves, RN falls back to the
 * platform default, so never assume these exist at module scope.
 */
export const fonts = {
  displayMedium: 'Poppins_500Medium',
  display: 'Poppins_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
} as const;

/**
 * The type ramp — exactly the 14 combinations used in the approved artboards.
 * Spread these; do not hand-roll a fontSize/fontWeight pair.
 */
export const type: Record<string, TextStyle> = {
  // Poppins — display
  display:    { fontFamily: fonts.display, fontSize: 40, color: palette.ink },
  h1:         { fontFamily: fonts.display, fontSize: 26, color: palette.ink },
  h2:         { fontFamily: fonts.display, fontSize: 20, color: palette.ink },
  h3:         { fontFamily: fonts.display, fontSize: 15, color: palette.ink },
  h3Medium:   { fontFamily: fonts.displayMedium, fontSize: 15, color: palette.ink },
  numeral:    { fontFamily: fonts.display, fontSize: 12, color: palette.ink },

  // Inter — body and UI
  body:       { fontFamily: fonts.body, fontSize: 13, color: palette.textBody, lineHeight: 20 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 13, color: palette.textBody, lineHeight: 20 },
  small:      { fontFamily: fonts.body, fontSize: 12, color: palette.textMuted, lineHeight: 18 },
  smallMedium:{ fontFamily: fonts.bodyMedium, fontSize: 12, color: palette.textMuted, lineHeight: 18 },
  smallSemi:  { fontFamily: fonts.bodySemi, fontSize: 12, color: palette.ink },
  caption:    { fontFamily: fonts.bodyMedium, fontSize: 11, color: palette.textMuted },
  microMedium:{ fontFamily: fonts.bodyMedium, fontSize: 10, color: palette.textMuted },
  // Section labels and badges. Uppercase via textTransform so fr/nl capitalise correctly.
  label:      { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase' },
};

/**
 * @deprecated The pre-redesign palette. Nothing in `src/` reads it any more —
 * every screen is on `palette` / `mapColors` / `chartColors` / `categoryColors`.
 * Kept only so an in-flight branch does not fail to compile on merge; delete it
 * once those have landed. Do NOT add call sites: `npm run design-audit` treats
 * anything outside the token sets as a regression.
 */
export const colors = {
  // Primary colors
  primary: '#0f2a3f', // Orange color
  primaryDark: '#081d2c',
  primaryLight: '#1a4a6e',
  pinkcolor: '#FF007F',
  
  // Accent colors
  accent: '#4A9EFF',
  accentDark: '#2979FF',
  
  // Status colors
  success: '#4CAF50',
  ligtgreen: '#88E788',
  warning: '#FF9800',
  error: '#DC143C',
  info: '#2196F3',
  
  // Neutral colors
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  
  // Map colors
  routeColor: '#4A9EFF',
  stationColor: '#0f2a3f',
  participantColor: '#DC143C',

  inputBorder: '#d1d5db',      // GRAY_LIGHT
  inputBorderFocus: '#e5e7eb', // BORDER_LIGHT  
  inputBgSelected: '#fff5f5',  // BG_SELECTED
  inputBgItem: '#f3f4f6',      // BG_ITEM

  // ✅ Client-approved lime, matched to my.liviolive.com. Was '#d5da28',
  // which read as too bright next to the web app. Same value as palette.lime.
  themeiColor: '#C7D92C',
  themeblue: '#0f2a40',

  
};

// Spacing
/**
 * Legacy alias of `space`, kept because 380 call sites still read it. The values
 * are NOT duplicated — two independent spacing scales is how they drift apart.
 * `xxxxl` is the one extra step: a bottom-scroll pad that clears the nav bar.
 */
export const spacing = {
  ...space,
  xxxxl: 90,
};

// Typography
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

// Common Styles
// ✅ Redesign: `commonStyles` is the base 276 call sites across the app build on,
// so migrating it is what actually moves the screens that were never touched
// individually. Same keys, same meanings — redrawn on the tokens.
export const commonStyles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: palette.page,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    backgroundColor: palette.page,
  },
  // Was a grey full-width strip; the deck labels sections in small caps on white.
  section: {
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },

  date: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    marginLeft: space.xs,
  },

  // Text
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textBody,
    lineHeight: 20,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    marginBottom: 2,
  },
  textCenter: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: palette.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.textMuted,
    lineHeight: 18,
  },
  subtitlered: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: palette.danger,
    lineHeight: 18,
  },

  // Loading
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: space.md,
  },

  // Error
  errorText: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.danger,
    textAlign: 'center',
  },

  // Buttons — 48pt, radius 14. Prefer <Button> from components/ui in new code;
  // these remain for the call sites that have not migrated yet.
  primaryButton: {
    backgroundColor: palette.navy,
    height: 48,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: radii.md,
  },
  primaryButtonText: {
    color: palette.surface,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  // ── The deck's MENU ROW (07_Profile.png, 14_FanHub.png) ──
  // A white card: a fill-tinted rounded-square icon plate, an ink title over a
  // muted subtitle, and a chevron. Shared because both hub screens draw it, and
  // they had drifted into two different things — bare icons on one, solid navy
  // cards with white uppercase titles on the other.
  menuCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginBottom: space.md,
    ...shadows.card,
  },
  menuIconPlate: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    minWidth: 0,
  },
  menuTitle: {
    fontFamily: fonts.display,
    fontSize: 15,
    color: palette.ink,
  },
  menuSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.textMuted,
    marginTop: 2,
  },

  // The deck uses three button weights and they carry meaning: filled navy is
  // the primary action, OUTLINED is a secondary one of equal importance, and
  // LIME marks the single most-wanted action on a screen. Screens that made
  // every button filled navy lost that ordering.
  outlineButton: {
    backgroundColor: palette.surface,
    borderWidth: 1.5,
    borderColor: palette.navy,
    height: 48,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: radii.md,
  },
  outlineButtonText: {
    color: palette.navy,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  limeButton: {
    backgroundColor: palette.lime,
    height: 48,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: radii.md,
  },
  limeButtonText: {
    color: palette.ink,
    fontFamily: fonts.display,
    fontSize: 15,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    height: 48,
    paddingHorizontal: space.xl,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: palette.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryButtonText: {
    color: palette.navy,
    fontFamily: fonts.display,
    fontSize: 15,
  },

  // Card
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: space.lg,
    ...shadows.card,
  },

  // ✅ Redesign: the deck's list rows carry the lime accent on the row's LEFT
  // EDGE. The old design drew the same 3px lime bar *inside* the row, between
  // the avatar and the text — a device that appears nowhere in the deck.
  // Compose with `card`; deliberately not merged into it, since most cards in
  // the app are not list rows and must stay unaccented.
  cardAccent: {
    borderLeftWidth: 3,
    borderLeftColor: palette.lime,
  },

  shadow: {
    ...shadows.card,
  },

  favoriteButton: {
    backgroundColor: palette.navy,
    height: 48,
    paddingHorizontal: space.xl,
    flex: 1,
    borderBottomRightRadius: radii.md,
    borderTopRightRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  favoriteButtonText: {
    color: palette.surface,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  livetracking: {
    backgroundColor: palette.lime,
    height: 48,
    borderBottomLeftRadius: radii.md,
    borderTopLeftRadius: radii.md,
    paddingHorizontal: space.xl,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
