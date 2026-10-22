// ✅ Side safe-area padding for landscape on gesture-navigation phones.
//
// Screens pass SafeAreaView edges={isLandscape && !isGestureNav ? ['left','right'] : ['bottom']},
// so on an iPhone with a notch / Dynamic Island (and Android with gesture nav)
// landscape gets NO left/right inset: header icons and the result cards' rank
// circles sat under the notch (47-59pt on iPhones). This returns the side
// insets for exactly that case and 0 everywhere else — portrait, and Android
// 3-button landscape where SafeAreaView already pads left/right (no double
// padding). Client feedback 2026-10-22 (results in landscape).
export interface SideInsets { left: number; right: number }

export const landscapeSideInsets = (
  insets: { left: number; right: number; bottom: number },
  width: number,
  height: number,
): SideInsets =>
  width > height && insets.bottom > 0
    ? { left: insets.left, right: insets.right }
    : { left: 0, right: 0 };
