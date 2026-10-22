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
