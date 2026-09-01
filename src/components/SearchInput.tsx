import React, { forwardRef } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, radii, space, fonts } from '../styles/common.styles';

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  onFocus?: () => void;
  onBlur?: () => void;
  /**
   * Wrap the field in the white sub-header block the deck draws under the lime
   * band. On by default — the exceptions are screens that already sit inside
   * their own white panel.
   */
  framed?: boolean;
}

const SearchInput = forwardRef<TextInput, SearchInputProps>(
  ({ placeholder, value, onChangeText, icon = 'search', onFocus, onBlur, framed = true }, ref) => {
    const field = (
      <View style={styles.field}>
        <Ionicons name={icon} size={18} color={palette.textMuted} />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </View>
    );
    return framed ? <View style={styles.frame}>{field}</View> : field;
  }
);

const styles = StyleSheet.create({
  // ✅ The white sub-header: every search screen in the deck puts the field on
  // white with a hairline beneath, not floating on the page tint.
  frame: {
    backgroundColor: palette.surface,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 40,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
    backgroundColor: palette.page,
    borderWidth: 1,
    borderColor: palette.inputBorder,
  },
  input: {
    flex: 1,
    padding: 0,
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkSoft,
  },
});

export default SearchInput;
