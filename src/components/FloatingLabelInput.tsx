import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Text,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// ✅ TYPES
type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface DropdownOption {
  label: string;
  value: number;
}

interface FloatingLabelInputProps extends Omit<TextInputProps, 'onChangeText'> {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  iconName?: IoniconsName;
  isPassword?: boolean;
  isDatePicker?: boolean;
  isTimePicker?: boolean;
  isDropdown?: boolean;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
  showClearButton?: boolean;
  options?: (string | DropdownOption)[];
  onSelect?: (item: DropdownOption) => void;
}

// ✅ CONSTANTS
const COLORS = {
  ERROR: '#DC143C',
  PRIMARY: '#FF5722',
  GRAY_LIGHT: '#d1d5db',
  GRAY_MED: '#9ca3af',
  GRAY_DARK: '#111827',
  WHITE: '#ffffff',
  BORDER_LIGHT: '#e5e7eb',
  BG_SELECTED: '#fff5f5',
  BG_ITEM: '#f3f4f6',
} as const;

const ANIMATION_DURATION = 200;
const INPUT_HEIGHT = 56;

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label = 'Label',
  value,
  onChangeText = () => {},
  iconName,
  isPassword = false,
  isDatePicker = false,
  isTimePicker = false,
  isDropdown = false,
  error = false,
  errorMessage,
  required = false,
  showClearButton = true,
  options = [],
  onSelect,
  editable = true,
  ...props
}) => {
  // ✅ STATE
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  // ✅ ANIMATION EFFECT
  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value || showDatePicker || showTimePicker ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, showDatePicker, showTimePicker, animatedValue]);

  // ✅ MEMOIZED STYLES
  const borderColor = useMemo(() => {
    if (error) return COLORS.ERROR;
    if (isFocused || showDatePicker || showTimePicker) return COLORS.PRIMARY;
    return COLORS.GRAY_LIGHT;
  }, [error, isFocused, showDatePicker, showTimePicker]);

  const iconColor = useMemo(() => {
    if (error) return COLORS.ERROR;
    if (isFocused || showDatePicker || showTimePicker) return COLORS.PRIMARY;
    return COLORS.GRAY_MED;
  }, [error, isFocused, showDatePicker, showTimePicker]);

  const labelLeft = iconName ? 44 : 15;

  const labelStyle = useMemo(() => ({
    position: 'absolute' as const,
    left: labelLeft,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [17, -9],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 11],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [COLORS.GRAY_MED, error ? COLORS.ERROR : COLORS.PRIMARY],
    }),
    backgroundColor: COLORS.WHITE,
    paddingHorizontal: 4,
    zIndex: 1,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  }), [animatedValue, labelLeft, error]);

  // ✅ CALLBACKS
  const handleDateChange = useCallback((_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      onChangeText(`${yyyy}-${mm}-${dd}`);
    }
  }, [onChangeText]);

  const handleTimeChange = useCallback((_: any, time?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (time) {
      const hours = String(time.getHours()).padStart(2, '0');
      const minutes = String(time.getMinutes()).padStart(2, '0');
      onChangeText(`${hours}:${minutes}`);
    }
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
  }, [onChangeText]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);
  const togglePassword = useCallback(() => setShowPassword(prev => !prev), []);
  const toggleDropdown = useCallback(() => setShowDropdown(prev => !prev), []);

  // ✅ COMPUTED VALUES
  const displayValue = useMemo(() => {
    if (isDatePicker && value) {
      return value.split('-').reverse().join('-');
    }
    return value;
  }, [isDatePicker, value]);

  const selectedDate = useMemo(() => {
    if (isDatePicker && value) {
      return new Date(value);
    }
    return new Date(2000, 0, 1);
  }, [isDatePicker, value]);

  const selectedTime = useMemo(() => {
    if (isTimePicker && value) {
      return new Date(`1970-01-01T${value}:00`);
    }
    return new Date();
  }, [isTimePicker, value]);

  const showClear = useMemo(() => {
    return showClearButton && !!value && !isPassword && !isDatePicker && !isTimePicker;
  }, [showClearButton, value, isPassword, isDatePicker, isTimePicker]);

  // ✅ RENDER DROPDOWN MODE
  if (isDropdown) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={toggleDropdown}
          disabled={!editable}
          style={[
            styles.container,
            { borderColor },
            showDropdown && styles.containerFocused,
            error && styles.containerError,
          ]}
        >
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          <Animated.Text style={labelStyle}>
            {label}
            {required && <Animated.Text style={{ color: COLORS.ERROR }}> *</Animated.Text>}
          </Animated.Text>

          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: INPUT_HEIGHT,
                color: value ? COLORS.GRAY_DARK : COLORS.GRAY_MED,
              },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>

          <View style={styles.iconRight}>
            <Ionicons
              name={showDropdown ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={18}
              color={iconColor}
            />
          </View>
        </TouchableOpacity>

        {showDropdown && (
          <ScrollView style={styles.dropdown} nestedScrollEnabled>
            {options.map((item, index) => {
              const labelText = typeof item === 'string' ? item : item.label;
              const isSelected = value === labelText;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.selectedItem,
                  ]}
                  onPress={() => {
                    if (typeof item === 'object' && onSelect) {
                      onSelect(item);
                    } else {
                      onChangeText(labelText);
                    }
                    setShowDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownText,
                      isSelected && styles.selectedText,
                    ]}
                  >
                    {labelText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {errorMessage && (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={11} color={COLORS.ERROR} />{' '}
            {errorMessage}
          </Text>
        )}
      </View>
    );
  }

  // ✅ RENDER TIME PICKER MODE
  if (isTimePicker) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowTimePicker(true)}
          disabled={!editable}
          style={[
            styles.container,
            { borderColor },
            showTimePicker && styles.containerFocused,
            error && styles.containerError,
          ]}
        >
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          <Animated.Text style={labelStyle}>
            {label}
            {required && <Animated.Text style={{ color: COLORS.ERROR }}> *</Animated.Text>}
          </Animated.Text>

          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: INPUT_HEIGHT,
                color: value ? COLORS.GRAY_DARK : COLORS.GRAY_MED,
              },
            ]}
          >
            {value || 'HH:MM'}
          </Text>

          <View style={styles.iconRight}>
            {value ? (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={!editable}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.GRAY_MED} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="time-outline" size={18} color={iconColor} />
            )}
          </View>
        </TouchableOpacity>

        {errorMessage && (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={11} color={COLORS.ERROR} />{' '}
            {errorMessage}
          </Text>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}
      </View>
    );
  }

  // ✅ RENDER DATE PICKER MODE
  if (isDatePicker) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDatePicker(true)}
          disabled={!editable}
          style={[
            styles.container,
            { borderColor },
            showDatePicker && styles.containerFocused,
            error && styles.containerError,
          ]}
        >
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          <Animated.Text style={labelStyle}>
            {label}
            {required && <Animated.Text style={{ color: COLORS.ERROR }}> *</Animated.Text>}
          </Animated.Text>

          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: INPUT_HEIGHT,
                color: value ? COLORS.GRAY_DARK : COLORS.GRAY_MED,
              },
            ]}
          >
            {displayValue || 'DD-MM-YYYY'}
          </Text>

          <View style={styles.iconRight}>
            {value ? (
              <TouchableOpacity
                onPress={handleClear}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                disabled={!editable}
              >
                <Ionicons name="close-circle" size={20} color={COLORS.GRAY_MED} />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down-outline" size={18} color={iconColor} />
            )}
          </View>
        </TouchableOpacity>

        {errorMessage && (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={11} color={COLORS.ERROR} />{' '}
            {errorMessage}
          </Text>
        )}

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="spinner"
            onChange={handleDateChange}
          />
        )}
      </View>
    );
  }

  // ✅ RENDER DEFAULT TEXT INPUT MODE
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { borderColor },
          isFocused && styles.containerFocused,
          error && styles.containerError,
        ]}
      >
        {iconName && (
          <View style={styles.iconLeft}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
        )}

        <Animated.Text style={labelStyle}>
          {label}
          {required && <Animated.Text style={{ color: COLORS.ERROR }}> *</Animated.Text>}
        </Animated.Text>

        <TextInput
          style={[
            styles.input,
            { paddingLeft: iconName ? 44 : 15 },
            (isPassword || showClear) && { paddingRight: 46 },
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor={COLORS.GRAY_LIGHT}
          editable={editable}
          {...props}
        />

        {showClear && editable && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={handleClear}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.GRAY_MED} />
          </TouchableOpacity>
        )}

        {isPassword && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={togglePassword}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {errorMessage && (
        <Text style={styles.errorText}>
          <Ionicons name="alert-circle-outline" size={11} color={COLORS.ERROR} />{' '}
          {errorMessage}
        </Text>
      )}
    </View>
  );
};

// ✅ OPTIMIZED STYLES
const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: INPUT_HEIGHT,
    borderWidth: 1.5,
    borderRadius: 12,
    backgroundColor: COLORS.WHITE,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 0,
  },
  containerFocused: {
    shadowOpacity: 0.12,
    elevation: 3,
  },
  containerError: {
    borderColor: COLORS.ERROR,
    borderWidth: 2,
  },
  iconLeft: {
    position: 'absolute',
    left: 14,
    zIndex: 2,
  },
  iconRight: {
    position: 'absolute',
    right: 14,
    zIndex: 2,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: COLORS.GRAY_DARK,
    paddingHorizontal: 15,
    paddingTop: 6,
  },
  errorText: {
    marginTop: 5,
    marginLeft: 4,
    fontSize: 11.5,
    color: COLORS.ERROR,
    fontWeight: '500',
  },
  dropdown: {
    borderWidth: 1,
    borderColor: COLORS.BORDER_LIGHT,
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: COLORS.WHITE,
    maxHeight: 200,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BG_ITEM,
  },
  dropdownText: {
    fontSize: 14,
    color: COLORS.GRAY_DARK,
  },
  selectedItem: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
    backgroundColor: COLORS.BG_SELECTED,
  },
  selectedText: {
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
});

export default FloatingLabelInput;