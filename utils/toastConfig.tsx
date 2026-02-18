import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

/* ✅ Define Toast Types */
type ToastType = "success" | "error" | "info" | "warning";

/* ✅ Define Props Interface */
interface AnimatedToastProps {
  text1?: string;
  text2?: string;
  type?: ToastType;
}

/* ✅ Strongly Typed Config Object */
const TOAST_CONFIG: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    delay: number;
    icon: React.ReactNode;
  }
> = {
  success: {
  bg: "#FFF4E5",          // light orange background
  border: "#FFA94D",      // orange border
  text: "#000000",        // black text
  delay: 180,
  icon: <Ionicons name="checkmark" size={14} color="#FF8C00" />, // orange icon
},
  error: {
    bg: "#FDEDED",
    border: "#F5C2C7",
    text: "#842029",
    delay: 2000,
    icon: <Ionicons name="close" size={14} color="#842029" />,
  },
  info: {
    bg: "#EEF5FF",
    border: "#CFE2FF",
    text: "#084298",
    delay: 180,
    icon: <Ionicons name="information" size={14} color="#084298" />,
  },
  warning: {
    bg: "#FFF8E5",
    border: "#FFE08A",
    text: "#7A5D00",
    delay: 180,
    icon: <Ionicons name="alert" size={14} color="#7A5D00" />,
  },
};

/* ✅ Main Animated Component */
const AnimatedToast: React.FC<AnimatedToastProps> = ({
  text1,
  text2,
  type = "info",
}) => {
  const translateY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  const config = TOAST_CONFIG[type];

  useEffect(() => {
    iconScale.setValue(0.5);
    iconOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.delay(config.delay),
        Animated.parallel([
          Animated.spring(iconScale, {
            toValue: 1,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(iconOpacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, []);

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: config.bg,
            borderColor: config.border,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.icon,
            {
              borderColor: config.border,
              opacity: iconOpacity,
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          {config.icon}
        </Animated.View>

        <View style={{ width: 8 }} />

        <View style={{ flex: 1 }}>
          {text1 ? (
            <Text
              style={[styles.text, { color: config.text }]}
              numberOfLines={1}
            >
              {text1}
            </Text>
          ) : null}

          {text2 ? (
            <Text
              style={[
                styles.text,
                { color: config.text, fontSize: 12, marginTop: 2 },
              ]}
              numberOfLines={2}
            >
              {text2}
            </Text>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
};

/* ✅ Export for App.tsx */
export const toastConfig = {
  success: (props: any) => <AnimatedToast {...props} type="success" />,
  error: (props: any) => <AnimatedToast {...props} type="error" />,
  info: (props: any) => <AnimatedToast {...props} type="info" />,
  warning: (props: any) => <AnimatedToast {...props} type="warning" />,
};

/* ✅ Styles */
const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: width * 0.85,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    flexShrink: 1,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
