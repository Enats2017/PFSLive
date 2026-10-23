// Layout decisions for narrow screens and larger iOS text (confirmation pass,
// 2026-10-22). 320pt is a real width, not a theoretical one: iPhone SE 2/3 and
// 12/13 mini with Display Zoom, the first iPhone SE, and small Android phones
// or a large Android "Display size" all report it.

/** Below this the result cards use their compact spacing (resultListStyle.*Narrow):
 *  at 320pt "CLASSEMENT" / "KLASSEMENT" no longer fit a stat column whole. */
export const NARROW_WIDTH = 360;
export const isNarrowWidth = (width: number | undefined): boolean => !!width && width < NARROW_WIDTH;

// Distance cards (event details, follower distances, past races): the details
// on the left, buttons in a 130-140pt column on the right. On a 320pt screen
// that leaves the date ~70pt ("September" broke mid-word), and two steps of
// larger iOS text no longer fit "Participants" inside the 140pt button. When
// either side cannot keep its longest word whole, the buttons go full width
// under the details instead.
export const DISTANCE_BUTTON_COLUMN = 140;      // detailsStyles.resultsButton maxWidth
const DISTANCE_BUTTON_INSET = 2 * 16 + 3;       // paddingHorizontal space.lg + 1.5 border, both sides
const DISTANCE_ROW_CHROME = 12 + 1 + 12 + 16 + 8;   // gap · divider · gap, meta icon + gap
/** Widest single button word at 100%: "Participants", 14pt display (~87pt). */
export const DISTANCE_LONGEST_BUTTON_WORD = 87;
/** Widest date chunk kept on one line at 100%: "25 September", 14pt (~95pt). */
export const DISTANCE_LONGEST_META = 95;

export const distanceButtonsBelow = (cardInner: number, fontScale: number | undefined): boolean => {
  const s = Math.max(1, fontScale || 1);
  return DISTANCE_LONGEST_BUTTON_WORD * s > DISTANCE_BUTTON_COLUMN - DISTANCE_BUTTON_INSET
    || cardInner - DISTANCE_ROW_CHROME - DISTANCE_BUTTON_COLUMN < DISTANCE_LONGEST_META * s;
};

// Result-list filters: two per row, the type filter the narrowest (1 : 1.6 with
// the distance). At 320pt with larger text "Résultats" no longer fit the type
// filter and "Controlepunt" a half-width one (and at 360pt from ×1.35): words
// broke mid-word. Then each filter gets its own full-width row.
const FILTER_ROW_CHROME = 2 * 20 + 8;            // gutters space.xl, gap space.sm
const FILTER_TAB_CHROME = 2 * 8 + 2 + 18 + 4;    // padding space.sm, border, chevron 18 + margin xs
/** Widest word of a type label at 100%: "Résultats", 14pt (~62pt). */
export const FILTER_LONGEST_TYPE_WORD = 62;
/** Widest word of the other fixed labels: "Controlepunt", 14pt (~88pt). */
export const FILTER_LONGEST_WORD = 88;

export const filtersOnePerRow = (width: number | undefined, fontScale: number | undefined): boolean => {
  if (!width) return false;
  const s = Math.max(1, fontScale || 1);
  const row = width - FILTER_ROW_CHROME;
  return row / 2.6 - FILTER_TAB_CHROME < FILTER_LONGEST_TYPE_WORD * s
    || row / 2 - FILTER_TAB_CHROME < FILTER_LONGEST_WORD * s;
};

// Result-list filter dropdown (components/FilterDropdown.tsx).
export interface DropPos {
  top: number;
  left: number;
  width: number;
  /** Set when the list opens ABOVE the button (more room there). */
  bottom?: number;
  maxHeight: number;
}

export const POPUP_MAX = 420;
const EDGE = 8;

/**
 * Where the option list goes. It used to always open below the button with a
 * fixed 420pt max height — in landscape (~360-430pt tall) most of it, or all of
 * it for a button low on the screen, was off-screen. Now it opens below when
 * there is room, above when there is more room there, and never runs past the
 * screen edge.
 */
export const dropPosition = (
  x: number, y: number, w: number, h: number, screenW: number, screenH: number,
): DropPos => {
  const below = screenH - (y + h) - EDGE;
  const above = y - EDGE;
  const width = Math.max(w, 160);
  const left = Math.max(EDGE, Math.min(x, screenW - width - EDGE));
  if (below >= Math.min(POPUP_MAX, 240) || below >= above) {
    return { top: y + h, left, width, maxHeight: Math.min(POPUP_MAX, below) };
  }
  return { top: 0, bottom: screenH - y, left, width, maxHeight: Math.min(POPUP_MAX, above) };
};

/**
 * ✅ Height of a list that sits inside the profile page's ScrollView, in
 * landscape (device test 2026-10-23): the visible area under the header. The
 * user scrolls the profile card away and the list then fills the screen —
 * whole cards, the list's end on screen. A fixed 360pt (events) was taller
 * than that area (~278pt on an iPhone 15), so the bottom cards sat below the
 * screen edge; the training list measured once and could be ~0 in landscape.
 * Landscape AppHeader: 8 + 44 + 8, band 8 + 18 + 8 = 94 (+ status bar).
 */
export const LANDSCAPE_HEADER = 94;
export const profileListLandscapeHeight = (windowH: number, insetTop: number, insetBottom: number): number =>
  Math.max(200, windowH - insetTop - insetBottom - LANDSCAPE_HEADER);

/**
 * ✅ How far a sheet's body scrolls so the field being typed in shows when the
 * keyboard opens (device test 2026-10-23, landscape): to the field (8pt above
 * it), never past the end. ≤ 0 → no scroll — a body that fits (portrait).
 */
export const fieldScrollY = (fieldY: number, contentH: number, boxH: number): number =>
  Math.min(fieldY - 8, contentH - boxH);
