import { useWindowDimensions } from 'react-native';
import { Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import { landscapeSideInsets } from '../utils/landscapeInsets';

// ✅ Body padding that keeps a screen's content clear of the notch / Dynamic
// Island in landscape (full audit 2026-10-22: most screens only had it in the
// header — cards, forms and lists sat 27-39pt under the notch). Spread on the
// View that wraps the screen body BELOW AppHeader (AppHeader pads itself):
//   <View style={[{ flex: 1 }, sidePadding]}>
// 0 / 0 in portrait and wherever SafeAreaView already pads the sides.
// The SafeAreaView edges this padding is paired with — the app's standard rule
// (`isLandscape && !isGestureNav ? ['left','right'] : ['bottom']`): on Android
// 3-button landscape (no bottom inset) SafeAreaView pads the sides itself, so
// the padding above is 0 there. A screen that used plain edges={['bottom']}
// left its content under the Android navigation bar in landscape.
export const useSafeAreaEdges = (): Edge[] => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return width > height && insets.bottom === 0 ? ['left', 'right'] : ['bottom'];
};

export const useLandscapeSidePadding = () => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const side = landscapeSideInsets(insets, width, height);
  return { paddingLeft: side.left, paddingRight: side.right };
};

// ✅ Inside a <Modal> nothing is in a SafeAreaView, so the screen rule above
// (0 where SafeAreaView pads) does not apply: a full-width sheet ran under the
// camera / notch / Android nav bar in landscape (device test 2026-10-22). This
// pads by the side insets whenever the window is landscape, on every platform.
// Put it on the sheet's full-screen backdrop: the sheet sits inside the safe
// area, only the dimmed backdrop shows under the camera.
export const useModalSideInsets = () => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  return width > height
    ? { paddingLeft: insets.left, paddingRight: insets.right }
    : { paddingLeft: 0, paddingRight: 0 };
};

/** Landscape on a phone (or any window under 500pt tall): popups go compact. */
export const SHORT_SCREEN_HEIGHT = 500;
export const isShortScreen = (height: number | undefined): boolean => !!height && height < SHORT_SCREEN_HEIGHT;

/** Compact popups (icon hidden, buttons side by side): any landscape window —
 *  a tablet in landscape too, not only a phone (device test 2026-10-23: "icon
 *  hidden in landscape") — or any window under 500pt tall. */
export const isCompactPopup = (width: number | undefined, height: number | undefined): boolean =>
  (!!width && !!height && width > height) || isShortScreen(height);
