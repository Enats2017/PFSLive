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


// ─── Icon name type ─────────────────────────────────────────────
type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

// ─── Props ───────────────────────────────────────────────────────
interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  iconName?: IoniconsName;
  isPassword?: boolean;
  isDatePicker?: boolean;       // ← NEW: turns input into date picker
  error?: string;
  required?: boolean;
   showClearButton?: boolean;
   isDropdown?: boolean;
options?: string[];
   
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
     isDropdown = false,      // 👈 ADD THIS
  options = [],    
  ...props
}) => {
  const { t } = useTranslation('register');
  const [isFocused, setIsFocused]           = useState(false);
  const [showPassword, setShowPassword]     = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value || showDatePicker ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value, showDatePicker]);

  // ── Derived colours ──────────────────────────────────────────
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

  // ── Animated label ───────────────────────────────────────────
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

  // ── Date picker handler ──────────────────────────────────────
  const handleDateChange = (_: any, date?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (date) {
      const yyyy = date.getFullYear();
      const mm   = String(date.getMonth() + 1).padStart(2, "0");
      const dd   = String(date.getDate()).padStart(2, "0");
      onChangeText(`${yyyy}-${mm}-${dd}`); // YYYY-MM-DD → PHP backend
    }
  };

  // Display as DD-MM-YYYY for user
  const displayValue = isDatePicker && value
    ? value.split("-").reverse().join("-")
    : value;

  const selectedDate = isDatePicker && value
    ? new Date(value)
    : new Date(2000, 0, 1);

    const showClear = showClearButton && !!value  && !isPassword && !isDatePicker;

   
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
          {options?.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dropdownItem}
              onPress={() => {
                onChangeText(item);
                setShowDropdown(false);
              }}
            >
              <Text style={styles.dropdownText}>{t(`register:${item}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
  // ════════════════════════════════════════════════════════════
  //  DATE PICKER MODE

  // ════════════════════════════════════════════════════════════

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
            !!error && styles.containerError,
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
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        )}
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════
  //  DEFAULT TEXT INPUT MODE
  // ════════════════════════════════════════════════════════════
  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          { borderColor },
          isFocused && styles.containerFocused,
          !!error && styles.containerError,
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
  containerError: {
    backgroundColor: "#fff5f5",
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
});

export default FloatingLabelInput;
