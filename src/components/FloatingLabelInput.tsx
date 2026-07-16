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
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../styles/common.styles';
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
  multiline?: boolean;
  inputHeight?: number;
  error?: boolean;
  errorMessage?: string;
  required?: boolean;
  showClearButton?: boolean;
  options?: (string | DropdownOption)[];
  onSelect?: (item: DropdownOption) => void;
  datePickerPlaceholder?: string;  // ✅ translatable e.g. t('common:datePicker.placeholder')
  timePickerPlaceholder?: string;  // ✅ translatable e.g. t('common:timePicker.placeholder')
  // ✅ NEW — optional passthrough + iOS modal button labels (defaults are English)
  maximumDate?: Date;              // e.g. DOB field passes new Date() to block future dates
  minimumDate?: Date;
  pickerDoneLabel?: string;        // pass t('common:buttons.done')
  pickerCancelLabel?: string;      // pass t('common:buttons.cancel')
}

// ✅ CONSTANTS
const COLORS = {
  ERROR:        colors.error,        // #DC143C
  PRIMARY:      colors.primary,      // #0f2a3f
  GRAY_LIGHT:   colors.inputBorder,  // #d1d5db
  GRAY_MED:     colors.gray400,      // #9ca3af
  GRAY_DARK:    colors.gray900,      // #111827
  WHITE:        colors.white,        // #ffffff
  BORDER_LIGHT: colors.inputBorderFocus, // #e5e7eb
  BG_SELECTED:  colors.inputBgSelected,  // #fff5f5
  BG_ITEM:      colors.inputBgItem,      // #f3f4f6
} as const;

const ANIMATION_DURATION = 200;
const INPUT_HEIGHT = 56;

// ✅ Pure value <-> Date helpers (module-level — no component state needed)
// Stored string formats: date = "YYYY-MM-DD", time = "HH:MM".
// parse* build a LOCAL Date (avoids the UTC off-by-one of `new Date("YYYY-MM-DD")`).
const formatDateValue = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatTimeValue = (time: Date): string => {
  const hh = String(time.getHours()).padStart(2, '0');
  const mn = String(time.getMinutes()).padStart(2, '0');
  return `${hh}:${mn}`;
};

const parseDateValue = (v: string): Date => {
  if (v) {
    const [y, m, d] = v.split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  return new Date();
};

const parseTimeValue = (v: string): Date => {
  const d = new Date();
  if (v) {
    const [h, mn] = v.split(':').map(Number);
    d.setHours(h || 0, mn || 0, 0, 0);
  }
  return d;
};

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
  datePickerPlaceholder = 'DD-MM-YYYY',
  timePickerPlaceholder = 'HH:MM',
  maximumDate,
  minimumDate,
  pickerDoneLabel = 'Done',
  pickerCancelLabel = 'Cancel',
   multiline = false,
  inputHeight = 120,
  ...props
}) => {
  // ✅ STATE
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // ✅ Temp values while the iOS spinner is open — committed only on "Done"
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [tempTime, setTempTime] = useState<Date>(new Date());

  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  const inputRef = useRef<TextInput>(null);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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

  // ══════════════════════════════════════════════════════════
  //  DATE / TIME PICKER CALLBACKS
  //
  //  Android: the native dialog dismisses itself. onChange fires once with
  //           type 'set' (commit) or 'dismissed' (cancel) → close + maybe commit.
  //  iOS:     the spinner lives inside our Modal and never self-dismisses, so
  //           onChange only tracks a temp value; we commit on "Done", discard on
  //           "Cancel" / backdrop tap. This is why it now closes on both OSes.
  // ══════════════════════════════════════════════════════════
  const handleDateChange = useCallback((event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (date && event?.type !== 'dismissed') onChangeText(formatDateValue(date));
    } else if (date) {
      setTempDate(date); // iOS — track only, commit on Done
    }
  }, [onChangeText]);

  const handleTimeChange = useCallback((event: any, time?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (time && event?.type !== 'dismissed') onChangeText(formatTimeValue(time));
    } else if (time) {
      setTempTime(time); // iOS — track only, commit on Done
    }
  }, [onChangeText]);

  // iOS open: seed the spinner from the current value (or now), then show modal
  const openDatePicker = useCallback(() => {
    setTempDate(parseDateValue(value));
    setShowDatePicker(true);
  }, [value]);

  const openTimePicker = useCallback(() => {
    setTempTime(parseTimeValue(value));
    setShowTimePicker(true);
  }, [value]);

  // iOS confirm / cancel
  const confirmDate = useCallback(() => {
    onChangeText(formatDateValue(tempDate));
    setShowDatePicker(false);
  }, [onChangeText, tempDate]);

  const cancelDate = useCallback(() => setShowDatePicker(false), []);

  const confirmTime = useCallback(() => {
    onChangeText(formatTimeValue(tempTime));
    setShowTimePicker(false);
  }, [onChangeText, tempTime]);

  const cancelTime = useCallback(() => setShowTimePicker(false), []);

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
      return parseDateValue(value);
    }
    return new Date();
  }, [isDatePicker, value]);

  const selectedTime = useMemo(() => {
    if (isTimePicker && value) {
      return parseTimeValue(value);
    }
    return new Date();
  }, [isTimePicker, value]);

  const showClear = useMemo(() => {
    return showClearButton && !!value && !isPassword && !isDatePicker && !isTimePicker;
  }, [showClearButton, value, isPassword, isDatePicker, isTimePicker]);

  // ✅ Shared iOS bottom-sheet wrapper for either picker
  const renderIosPickerModal = (
    visible: boolean,
    onCancel: () => void,
    onConfirm: () => void,
    picker: React.ReactNode,
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={onCancel}>
        {/* Inner touchable swallows taps so pressing the sheet doesn't cancel */}
        <TouchableOpacity activeOpacity={1} style={styles.pickerSheet} onPress={() => {}}>
          <View style={styles.pickerBar}>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.pickerCancel}>{pickerCancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.pickerDone}>{pickerDoneLabel}</Text>
            </TouchableOpacity>
          </View>
          {picker}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

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
          onPress={openTimePicker}
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
            {value || timePickerPlaceholder}
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

        {/* iOS → modal with Done/Cancel; Android → native dialog (auto-dismiss) */}
        {Platform.OS === 'ios'
          ? renderIosPickerModal(
              showTimePicker,
              cancelTime,
              confirmTime,
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                is24Hour={true}
                themeVariant="light"
                onChange={handleTimeChange}
                style={styles.pickerSpinner}
              />,
            )
          : showTimePicker && (
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
          onPress={openDatePicker}
          disabled={!editable}
          style={[
            styles.container,
            { borderColor },
            showDatePicker && styles.containerFocused,
            error && styles.containerError,
          ]}
        >
          {iconName && (
              <View
                style={[styles.iconLeft, multiline && { top: 16 }]}
                pointerEvents="none"   // ✅ add this
              >
                <Ionicons name={iconName} size={18} color={iconColor} />
              </View>
          )}

         <Animated.Text style={labelStyle} pointerEvents="none">  {/* ✅ add this */}
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
            {displayValue || datePickerPlaceholder}
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

        {/* iOS → modal with Done/Cancel; Android → native dialog (auto-dismiss) */}
        {Platform.OS === 'ios'
          ? renderIosPickerModal(
              showDatePicker,
              cancelDate,
              confirmDate,
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onChange={handleDateChange}
                style={styles.pickerSpinner}
              />,
            )
          : showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onChange={handleDateChange}
              />
            )}
      </View>
    );
  }

  // ✅ RENDER DEFAULT TEXT INPUT MODE
  return (
  <View style={styles.wrapper}>
    <Pressable
      onPress={focusInput}
      style={[
        styles.container,
        { borderColor },
        multiline && { height: inputHeight, alignItems: 'flex-start' },
        isFocused && styles.containerFocused,
        error && styles.containerError,
      ]}
    >
      {iconName && (
        <View style={[styles.iconLeft, multiline && { top: 16 }]} pointerEvents="none">
          <Ionicons name={iconName} size={18} color={iconColor} />
        </View>
      )}

      <Animated.Text style={labelStyle} pointerEvents="none">
        {label}
        {required && <Animated.Text style={{ color: COLORS.ERROR }}> *</Animated.Text>}
      </Animated.Text>

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          { paddingLeft: iconName ? 44 : 15 },
          (isPassword || showClear) && { paddingRight: 46 },
          multiline && { paddingTop: 20, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        secureTextEntry={isPassword && !showPassword}
        placeholderTextColor={COLORS.GRAY_LIGHT}
        editable={editable}
        multiline={multiline}
        {...props}
        placeholder={isFocused ? props.placeholder : undefined}
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
    </Pressable>

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

  // ✅ iOS picker bottom-sheet
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  pickerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BG_ITEM,
  },
  pickerCancel: {
    fontSize: 16,
    color: COLORS.GRAY_MED,
    fontWeight: '500',
  },
  pickerDone: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
  pickerSpinner: {
    alignSelf: 'stretch',
  },
});

export default FloatingLabelInput;