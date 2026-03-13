 import React, { memo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
 
 export const PulsingDot: React.FC = () => {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1.6,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 0.3,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 1,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    return (
        <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
            {/* outer ring pulse */}
            <Animated.View
                style={{
                    position: 'absolute',
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: '#FF3B30',
                    opacity,
                    transform: [{ scale }],
                }}
            />
            {/* solid inner dot */}
            <View
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#FF3B30',
                }}
            />
        </View>
    );
};