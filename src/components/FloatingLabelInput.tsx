import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TextInputProps,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from 'react-i18next';

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  iconName?: IoniconsName;
  isPassword?: boolean;
  isDatePicker?: boolean;
  error?: string;
  required?: boolean;
  showClearButton?: boolean;
  isDropdown?: boolean;
  options?: (string | { label: string; value: number })[];
  onSelect?: (item: { label: string; value: number }) => void;
  isTimePicker?: boolean;

}

const FloatingLabelInput: React.FC<FloatingLabelInputProps> = ({
  label = "Label",
  value,
  onChangeText,
  iconName,
  isPassword = false,
  isDatePicker = false,
  error,
  required = false,
  showClearButton = true,
  isDropdown = false,
  options = [],
  onSelect,
  isTimePicker = false,
  ...props
}) => {
  const { t } = useTranslation('register');
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value || showDatePicker || showTimePicker ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, showDatePicker, showTimePicker]);

  const borderColor = error
    ? "#ef4444"
    : isFocused || showDatePicker
      ? "#FF5722"
      : "#d1d5db";

  const iconColor = error
    ? "#ef4444"
    : isFocused || showDatePicker
      ? "#FF5722 "
      : "#9ca3af";

  const labelLeft = iconName ? 44 : 15;

  const labelStyle = {
    position: "absolute" as const,
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
      outputRange: ["#9ca3af", error ? "#ef4444" : "#6366f1"],
    }),
    backgroundColor: "#ffffff",
    paddingHorizontal: 4,
    zIndex: 1,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  };

  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      onChangeText(`${yyyy}-${mm}-${dd}`); // YYYY-MM-DD → PHP backend
    }
  };

  const handleTimeChange = (_: any, time?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);

    if (time) {
      const hours = String(time.getHours()).padStart(2, "0");
      const minutes = String(time.getMinutes()).padStart(2, "0");

      onChangeText(`${hours}:${minutes}`); // HH:MM
    }
  };

  // Display as DD-MM-YYYY for user
  const displayValue = isDatePicker && value
    ? value.split("-").reverse().join("-")
    : value;

  const selectedDate = isDatePicker && value
    ? new Date(value)
    : new Date(2000, 0, 1);
  const showClear = showClearButton && !!value && !isPassword && !isDatePicker;


  if (isDropdown) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDropdown(!showDropdown)}
          style={[
            styles.container,
            { borderColor },
            showDropdown && styles.containerFocused,
          ]}
        >
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          <Animated.Text style={labelStyle}>
            {label}
          </Animated.Text>

          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: 56,
                color: value ? "#111827" : "#9ca3af",
              },
            ]}
          >
            {value}
          </Text>

          <View style={styles.iconRight}>
            <Ionicons
              name={showDropdown ? "chevron-up-outline" : "chevron-down-outline"}
              size={18}
              color={iconColor}
            />
          </View>
        </TouchableOpacity>

        {showDropdown && (
          <View style={styles.dropdown}>
            {options?.map((item, index) => {
              const labelText =
                typeof item === "string" ? item : item.label;

              const isSelected = value === labelText;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.selectedItem,
                  ]}
                  onPress={() => {
                    if (typeof item === "object" && onSelect) {
                      onSelect(item); // 🔥 send ID only if needed
                    } else {
                      onChangeText(labelText); // normal string mode
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
          </View>
        )}
      </View>
    );
  }

  // TIME PICKER MODE
  if (isTimePicker) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowTimePicker(true)}
          style={[
            styles.container,
            { borderColor },
            showTimePicker && styles.containerFocused,
          ]}
        >
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          <Animated.Text style={labelStyle}>
            {label}
            {required && (
              <Animated.Text style={{ color: "#ef4444" }}> *</Animated.Text>
            )}
          </Animated.Text>

          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: 56,
                color: value ? "#111827" : "#9ca3af",
              },
            ]}
          >
            {value || "HH:MM"}
          </Text>

          <View style={styles.iconRight}>
            {value ? (
              <TouchableOpacity
                onPress={() => onChangeText("")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="time-outline" size={18} color={iconColor} />
            )}
          </View>
        </TouchableOpacity>

        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {showTimePicker && (
          <DateTimePicker
            value={value ? new Date(`1970-01-01T${value}:00`) : new Date()}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={handleTimeChange}
          />
        )}
      </View>
    );
  }

  //  DATE PICKER MODE
  if (isDatePicker) {
    return (
      <View style={styles.wrapper}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.container,
            { borderColor },
            showDatePicker && styles.containerFocused,
          ]}
        >
          {/* Left Icon */}
          {iconName && (
            <View style={styles.iconLeft}>
              <Ionicons name={iconName} size={18} color={iconColor} />
            </View>
          )}

          {/* Floating Label */}
          <Animated.Text style={labelStyle}>
            {label}
            {required && (
              <Animated.Text style={{ color: "#ef4444" }}> *</Animated.Text>
            )}
          </Animated.Text>

          {/* Display value or placeholder */}
          <Text
            style={[
              styles.input,
              {
                paddingLeft: iconName ? 44 : 15,
                lineHeight: 56,
                color: value ? "#111827" : "#9ca3af",
              },
            ]}
          >
            {displayValue || "DD-MM-YYYY"}
          </Text>

          {/* Right chevron */}
          <View style={styles.iconRight}>
            {value ? (
              <TouchableOpacity
                onPress={() => onChangeText('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#9ca3af" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="chevron-down-outline" size={18} color={iconColor} />
            )}
          </View>
        </TouchableOpacity>

        {/* Error Message */}
        {!!error && (
          <Text style={styles.errorText}>
            <Ionicons name="alert-circle-outline" size={11} color="#ef4444" />{" "}
            {error}
          </Text>
        )}

        {/* Native Date Picker */}
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
  //  DEFAULT TEXT INPUT MODE
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { borderColor },
          isFocused && styles.containerFocused,

        ]}
      >
        {/* Left Icon */}
        {iconName && (
          <View style={styles.iconLeft}>
            <Ionicons name={iconName} size={18} color={iconColor} />
          </View>
        )}
        <Animated.Text style={labelStyle}>
          {label}
          {required && (
            <Animated.Text style={{ color: "#ef4444" }}> *</Animated.Text>
          )}
        </Animated.Text>

        {/* Text Input */}
        <TextInput
          style={[
            styles.input,
            { paddingLeft: iconName ? 44 : 15 },
            (isPassword || showClear) && { paddingRight: 46 },
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          placeholderTextColor="#d1d5db"
          {...props}
        />
        {showClear && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => onChangeText('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}


        {/* Eye toggle for password */}
        {isPassword && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? "eye-outline" : "eye-off-outline"}
              size={20}
              color={iconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {!!error && (
        <Animated.Text style={styles.errorText}>
          <Ionicons name="alert-circle-outline" size={11} color="#ef4444" />{" "}
          {error}
        </Animated.Text>
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 0,
  },
  containerFocused: {
    shadowOpacity: 0.12,
    elevation: 3,
  },

  iconLeft: {
    position: "absolute",
    left: 14,
    zIndex: 2,
  },
  iconRight: {
    position: "absolute",
    right: 14,
    zIndex: 2,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    color: "#111827",
    paddingHorizontal: 15,
    paddingTop: 6,
  },
  errorText: {
    marginTop: 5,
    marginLeft: 4,
    fontSize: 11.5,
    color: "#ef4444",
    fontWeight: "500",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginTop: 6,
    backgroundColor: "#fff",
    overflow: "hidden",
  },

  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },

  dropdownText: {
    fontSize: 14,
    color: "#111827",
  },
  selectedItem: {
  borderLeftWidth: 4,
  borderLeftColor: "#ef4444",
  backgroundColor: "#fff5f5",
},

selectedText: {
  color: "#ef4444",
  fontWeight: "600",
},
});

export default FloatingLabelInput;
