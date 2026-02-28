import React, { useEffect, useRef } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface Props {
  visible: boolean;
  message: string;
  onClose: () => void;
  duration?: number;
}

const SuccessCelebrationModal: React.FC<Props> = ({
  visible,
  message,
  onClose,
  duration = 10000,
}) => {

  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const float1 = useRef(new Animated.Value(0)).current;
  const float2 = useRef(new Animated.Value(0)).current;
  const float3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Fade + Scale animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating dots animation
    const floatAnimation = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -20,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    floatAnimation(float1, 0);
    floatAnimation(float2, 300);
    floatAnimation(float3, 600);

    const timer = setTimeout(() => {
      onClose();
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
    }, duration);

    return () => clearTimeout(timer);

  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>

        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >

          {/* Floating dots (simple confetti vibe) */}
          <Animated.View style={[styles.dot, { transform: [{ translateY: float1 }] }]} />
          <Animated.View style={[styles.dot2, { transform: [{ translateY: float2 }] }]} />
          <Animated.View style={[styles.dot3, { transform: [{ translateY: float3 }] }]} />

          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />

          <Text style={styles.title}>Registration Successful 🎉</Text>

          <Text style={styles.message}>
            {message}
          </Text>

        </Animated.View>

      </View>
    </Modal>
  );
};

export default SuccessCelebrationModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    alignItems: "center",
    overflow: "hidden",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 10,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    color: "#555",
  },
  dot: {
    position: "absolute",
    top: -10,
    left: width * 0.2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF5722",
  },
  dot2: {
    position: "absolute",
    top: -10,
    right: width * 0.2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2196F3",
  },
  dot3: {
    position: "absolute",
    top: -10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFC107",
  },
});