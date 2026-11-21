import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, Platform, View, useWindowDimensions } from 'react-native';

// ✅ Search fields vs the keyboard (audit 2026-10-23). The suggestion lists
// under the search fields (follower, fan and participant screens) opened
// behind the keyboard - in landscape only ~30pt of a 220pt list was above it,
// and nothing could scroll it up. Three pieces, shared by every search:
//   - useKeyboardHeight: the keyboard's height, 0 when hidden;
//   - useSearchFieldKeyboard (screen): room for the keyboard at the end of the
//     scroll content, and the focused search scrolled to the top;
//   - useDropdownMaxHeight (suggestion list): never taller than the room left
//     between its top and the keyboard (it scrolls inside).
// Android is edge-to-edge here (app.config.js), so the window is not resized
// for the keyboard and the padding is needed on both platforms - the same as
// FollowerScreen's athlete search did on its own before.

/** The on-screen keyboard's height in points, 0 when it is hidden. */
export const useKeyboardHeight = (): number => {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => setHeight(e.endCoordinates.height));
        const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);
    return height;
};

/** Gap kept between a list / search and the keyboard or screen top (spacing.sm). */
const GAP = 8;

/** Smallest list worth showing: ~2 suggestion rows. Below that it scrolls behind
 *  the keyboard as before rather than collapse to nothing. */
export const DROPDOWN_MIN = 96;

/**
 * Height for a suggestion list whose top is `top` (window y) while a keyboard
 * of `keyboardH` is up: the room down to the keyboard less an 8pt gap, between
 * DROPDOWN_MIN and the list's normal cap `base`. No keyboard / not measured: base.
 */
export const dropdownRoom = (windowH: number, keyboardH: number, top: number | null, base: number): number =>
    keyboardH > 0 && top != null
        ? Math.max(DROPDOWN_MIN, Math.min(base, Math.floor(windowH - keyboardH - top - GAP)))
        : base;

/** Max height for a suggestion list (see dropdownRoom). `ref` is on the list's
 *  outer View; it is measured once the screen has scrolled the field up. */
export const useDropdownMaxHeight = (ref: RefObject<View | null>, base: number, visible: boolean): number => {
    const keyboardH = useKeyboardHeight();
    const { height } = useWindowDimensions();
    const [top, setTop] = useState<number | null>(null);
    useEffect(() => {
        if (keyboardH <= 0 || !visible) {
            setTop(null);
            return;
        }
        // after the screen's scroll-to-field animation (useSearchFieldKeyboard)
        const timer = setTimeout(() => {
            ref.current?.measureInWindow((_x, y) => setTop(y));
        }, 350);
        return () => clearTimeout(timer);
    }, [keyboardH, visible, ref]);
    return dropdownRoom(height, keyboardH, top, base);
};

/** Where a focused search should scroll to: its section's y, less an 8pt gap. */
export const searchScrollY = (sectionY: number): number => Math.max(0, sectionY - GAP);

/**
 * Screen side. `scrollToY` scrolls the screen's list / ScrollView. Returns
 * `keyboardPad` (add it to the scroll content's bottom padding, so the offset
 * exists) and `focusAt(y)` / `blur` for the search fields' onFocus / onBlur,
 * with y the field's section offset in the scroll content.
 */
export const useSearchFieldKeyboard = (scrollToY: (y: number) => void) => {
    const keyboardHeight = useKeyboardHeight();
    const focusedY = useRef<number | null>(null);
    const scrollRef = useRef(scrollToY);
    scrollRef.current = scrollToY;

    // Runs after the padding has rendered, so the target offset exists.
    useEffect(() => {
        if (keyboardHeight > 0 && focusedY.current != null) scrollRef.current(searchScrollY(focusedY.current));
    }, [keyboardHeight]);

    const focusAt = useCallback((y: number) => {
        focusedY.current = y;
        // moving from one search to another: the keyboard is already up
        if (keyboardHeight > 0) scrollRef.current(searchScrollY(y));
    }, [keyboardHeight]);
    const blur = useCallback(() => { focusedY.current = null; }, []);

    return { keyboardPad: keyboardHeight, focusAt, blur };
};
