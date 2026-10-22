import React from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

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
}

const ModalScroll: React.FC<Props> = ({ children, contentStyle, style }) => (
  <ScrollView
    // maxWidth 400 = every modal card's own cap: a full-width ScrollView caught
    // the taps beside the card (landscape / tablets), so the backdrop never closed it.
    style={[{ flexGrow: 0, maxHeight: '100%', width: '100%', maxWidth: 400, alignSelf: 'center' }, style]}
    // alignItems stretch (the default): a card sized by width '100%' / maxWidth
    // or by its wrapper's padding keeps its width; pass alignItems: 'center'
    // in contentStyle for a card with a fixed width.
    contentContainerStyle={[{ flexGrow: 1, justifyContent: 'center', paddingVertical: 8 }, contentStyle]}
    bounces={false}
    showsVerticalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
  >
    {children}
  </ScrollView>
);

export default ModalScroll;
