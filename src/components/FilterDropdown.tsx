import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView
} from 'react-native';
import Entypo from '@expo/vector-icons/Entypo';
import { resultListStyle } from '../styles/ResultList.styles';
import { useTranslation } from 'react-i18next';

const { width: SCREEN_W } = Dimensions.get('window');

export interface DropPos {
  top: number;
  left: number;
  width: number;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface DropdownProps {
  label: string;
  options: FilterOption[];
  selected: FilterOption;
  onSelect: (o: FilterOption) => void;
}

const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  selected,
  onSelect,
}) => {
  const { t } = useTranslation(['allrace', 'common']);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropPos>({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<View | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const openMenu = (): void => {
    if (!btnRef.current) return;

    btnRef.current.measureInWindow((x, y, w, h) => {
      setPos({
        top: y + h,
        left: Math.min(x, SCREEN_W - w - 8),
        width: Math.max(w, 160),
      });

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
        style={resultListStyle.filterTab}
        activeOpacity={0.75}
        onPress={open ? closeMenu : openMenu}
      >
        <View style={resultListStyle.tabrow}>
          <Text
            style={resultListStyle.filterTabText}
            numberOfLines={1}
          >
            {label}
          </Text>
          <Entypo
            name="chevron-down"
            size={26}
            color="black"
            style={resultListStyle.filterArrow}
          />
        </View>
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="none" onRequestClose={closeMenu}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeMenu}
          />

          <Animated.View
            style={[
              resultListStyle.popup,
              {
                top: pos.top,
                left: pos.left,
                minWidth: pos.width,
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
                const active = opt.value === selected.value;

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