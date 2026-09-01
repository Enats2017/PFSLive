import React from 'react';
import { Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { ui } from '../../styles/ui.styles';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedFilterProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Live / Past style pill group. Generic over the value type so callers keep
 * their own union (e.g. 'live' | 'past') instead of passing raw strings around.
 */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedFilterProps<T>) {
  return (
    <View style={[ui.segment, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[ui.segmentItem, active && ui.segmentItemActive]}
            onPress={() => onChange(option.value)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text style={[ui.segmentLabel, active && ui.segmentLabelActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
