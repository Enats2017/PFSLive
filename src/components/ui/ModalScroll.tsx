import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ✅ Wrap a centred modal card in this so it can never be taller than the
// screen (full audit 2026-10-22): in landscape (~320-430pt tall) or with larger
// iOS text most popups were taller than the screen — the icon went off the top
// and the buttons (Cancel / Close / Not now) off the bottom, unreachable.
// Short content stays centred exactly as before; tall content scrolls.
//
//   <View style={backdrop}>            // full-screen, already centring
//     <ModalScroll>
//       <View style={card}>…</View>
//     </ModalScroll>
//   </View>
//
// `contentStyle` adds padding / alignment to the scroll content (e.g. the
// wrapper's own padding when the ScrollView replaces it).
interface Props {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Vertical space the wrapper around the ScrollView takes (its padding, a keyboard). Default 40 = 20 + 20. */
  reserve?: number;
}

const ModalScroll: React.FC<Props> = ({ children, contentStyle, style, reserve = 40 }) => {
  // Scroll cue (device test 2026-10-22: in landscape a popup "did not fit" —
  // it scrolled, but nothing showed it). When the card is taller than the
  // space, the scroll bar is shown (kept on Android, flashed on iOS).
  const ref = useRef<ScrollView>(null);
  // A Modal is outside any SafeAreaView, and on Android (edge-to-edge) it draws
  // under the status bar, the side nav bar and the camera cutout: the cap below
  // leaves the top / bottom bars free (the box is centred); sideways the card is
  // centred and capped at 400 / 520.
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  // An explicit cap in points (device test 2026-10-22: in landscape the Home
  // popups "did not scroll" — a percentage maxHeight is not something to rely
  // on inside a Modal). The box is never taller than the window minus the
  // system bars and the wrapper's own padding, so a taller card always scrolls.
  // The box is centred, so each margin is half the space left: twice the LARGER
  // bar keeps both bars clear (an Android status bar of 32 with no bottom bar
  // would otherwise put the card's top edge under it).
  const maxBoxHeight = Math.max(120, windowHeight - 2 * Math.max(insets.top, insets.bottom) - reserve);
  const [boxH, setBoxH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const overflows = boxH > 0 && contentH > boxH + 1;
  useEffect(() => {
    if (overflows) ref.current?.flashScrollIndicators();
  }, [overflows]);

  return (
    <ScrollView
      ref={ref}
      // maxWidth 400 = every modal card's own cap: a full-width ScrollView caught
      // the taps beside the card (landscape / tablets), so the backdrop never closed it.
      style={[{ flexGrow: 0, flexShrink: 1, maxHeight: maxBoxHeight, width: '100%', maxWidth: 400, alignSelf: 'center' }, style]}
      // alignItems stretch (the default): a card sized by width '100%' / maxWidth
      // or by its wrapper's padding keeps its width; pass alignItems: 'center'
      // in contentStyle for a card with a fixed width.
      contentContainerStyle={[{ flexGrow: 1, justifyContent: 'center', paddingVertical: 8 }, contentStyle]}
      bounces={false}
      showsVerticalScrollIndicator={overflows}
      persistentScrollbar={overflows}
      onLayout={(e) => setBoxH(e.nativeEvent.layout.height)}
      onContentSizeChange={(_w, h) => setContentH(h)}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
};

export default ModalScroll;
