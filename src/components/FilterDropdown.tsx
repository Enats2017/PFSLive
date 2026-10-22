import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import { resultListStyle } from '../styles/ResultList.styles';
import { useTranslation } from 'react-i18next';
import { palette } from '../styles/common.styles';
import { dropPosition, DropPos, POPUP_MAX } from '../utils/screenFit';
import { useModalSideInsets } from '../hooks/useLandscapeSidePadding';

export type { DropPos };
import { MODAL_ORIENTATIONS } from '../constants/modalOrientations';



export interface FilterOption {
  label: string;
  value: string;
}

export interface DropdownProps {
  label: string;
  options: FilterOption[];
   selected?: FilterOption;  
  onSelect: (o: FilterOption) => void;
  /** Extra style for the button, e.g. a larger flex share in its row. */
  style?: StyleProp<ViewStyle>;
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  selected,
  onSelect,
  style,
}) => {
  const { t } = useTranslation(['allrace', 'common']);
  const modalSides = useModalSideInsets();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropPos>({ top: 0, left: 0, width: 0, maxHeight: POPUP_MAX });
  // Room to the right of the popup's left edge, measured at open time. The
  // popup had a minWidth only, so a long option ran past the screen edge.
  const [maxW, setMaxW] = useState<number | undefined>(undefined);
  const btnRef = useRef<View | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const openMenu = (): void => {
    if (!btnRef.current) return;

    btnRef.current.measureInWindow((x, y, w, h) => {
      const { width: screenW, height: screenH } = Dimensions.get('window');
      const p = dropPosition(x, y, w, h, screenW, screenH);
      setPos(p);
      // never past a right-side camera / nav bar in landscape (popup is outside any SafeAreaView)
      setMaxW(Math.max(p.width, screenW - p.left - 8 - modalSides.paddingRight));

      setOpen(true);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const closeMenu = (): void => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setOpen(false));
  };

  const choose = (opt: FilterOption): void => {
    onSelect(opt);
    closeMenu();
  };

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={[resultListStyle.filterTab, style]}
        activeOpacity={0.75}
        onPress={open ? closeMenu : openMenu}
      >
        <View style={resultListStyle.tabrow}>
          {/* 2 lines (was 1): at 320pt / larger iOS text "Point de contrôle"
              ended in "…"; the button has a minHeight, so it grows. */}
          <Text
            style={resultListStyle.filterTabText}
            numberOfLines={2}
          >
            {label}
          </Text>
          {/* 18, was 26: in a half-width filter the 26pt chevron took a third
              of the label's room (labels ended in "…", 2026-10-22). */}
          <Entypo
            name="chevron-down"
            size={18}
            color={palette.ink}
            style={resultListStyle.filterArrow}
          />
        </View>
      </TouchableOpacity>

      {open && (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} transparent animationType="none" onRequestClose={closeMenu}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeMenu}
          />

          <Animated.View
            style={[
              resultListStyle.popup,
              {
                ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
                left: pos.left,
                minWidth: pos.width,
                maxWidth: maxW,
                maxHeight: pos.maxHeight,
                opacity: fadeAnim,
                transform: [{ scaleY: scaleAnim }],
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={{flexGrow:1,paddingBottom:20}}
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((opt, i) => {
                const active = opt.value === selected?.value;

                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      resultListStyle.popupRow,
                      i === options.length - 1 &&
                      resultListStyle.popupRowLast,
                      active && resultListStyle.popupRowActive,
                    ]}
                    activeOpacity={0.6}
                    onPress={() => choose(opt)}
                  >
                    <Text
                      style={[
                        resultListStyle.popupRowText,
                        active &&
                        resultListStyle.popupRowTextActive,
                      ]}
                    >
                      {t(opt.label)} 
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        </Modal>
      )}
    </>
  );
};

export default Dropdown;