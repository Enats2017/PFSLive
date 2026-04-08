import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform, ViewStyle} from 'react-native';
import { colors, commonStyles } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

export type ErrorType = 'network' | 'server' | 'empty';

const ERROR_CONFIG = {
  network: {
    accent: '#F97316',
    softBg: '#FFF7ED',
    ringBg: '#FFEDD5',
  },
  server: {
    accent: colors.primary,
    softBg: '#EEF2FF',
    ringBg: '#E0E7FF',
  },
  empty: {
    buttonLabel: 'Refresh',
    accent: colors.primary,

  },
} as const;

interface ErrorScreenProps {
  type: ErrorType;
  onRetry: () => void;
  title?: string;
  message?: string;
  buttonLabel?: string;
  style?: ViewStyle;
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  type,
  onRetry,
  title,
  message,
  buttonLabel,
  style,
}) => {
  const { t } = useTranslation('errorScreen');
  const config = ERROR_CONFIG[type];
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const breatheAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.9);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 9, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 55, friction: 9, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [type]);

  return (
    <View style={[styles.root, style]}>
      <Animated.View
        style={[
          styles.inner,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ringOuter,
            { transform: [{ scale: breatheAnim }] },
          ]}
        >
          <View style={[styles.ringInner]}>
            <IllustrationFor type={type} color={config.accent} />
          </View>
        </Animated.View>
        <View style={{alignItems:"center",}}>
        <Text style={commonStyles.textCenter}>
          {title ?? t(`${type}.title`)}
        </Text>
        <Text style={[commonStyles.subtitle, {textAlign:"center", marginTop:5}]}>
          {message ?? t(`${type}.message`)}
        </Text>
        </View>
      </Animated.View>
        <View style={{width:"90%"}}>
        {type !== 'empty' && (
          <TouchableOpacity
            style={[commonStyles.primaryButton, {marginTop:15}]}
            onPress={onRetry}
            activeOpacity={0.82}
          >
            <Text style={commonStyles.primaryButtonText}>
              {buttonLabel ?? t(`${type}.button`)}
            </Text>
          </TouchableOpacity>
        )}
        </View>
    </View>
  );
};

const IllustrationFor: React.FC<{ type: ErrorType; color: string }> = ({ type, color }) => {
  if (type === 'network') return <NetworkIllustration color={color} />;
  if (type === 'server') return <ServerIllustration color={color} />;
  return <EmptyIllustration color={color} />;
};

const NetworkIllustration: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
    {[48, 34, 20].map((size, i) => (
      <View key={i} style={{
        position: 'absolute', width: size, height: size / 2,
        borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2,
        borderWidth: 3, borderBottomWidth: 0, borderColor: color,
        opacity: 0.25 + i * 0.25, top: 8 + i * 7,
      }} />
    ))}
    <View style={{ position: 'absolute', width: 52, height: 3, backgroundColor: color, borderRadius: 2, top: 30, transform: [{ rotate: '45deg' }], opacity: 0.75 }} />
    <View style={{ position: 'absolute', width: 52, height: 3, backgroundColor: color, borderRadius: 2, top: 30, transform: [{ rotate: '-45deg' }], opacity: 0.75 }} />
    <View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color, bottom: 2 }} />
  </View>
);

const ServerIllustration: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    {[0, 1, 2].map(i => (
      <View key={i} style={{
        width: 52, height: 14, borderRadius: 4,
        backgroundColor: color + '18', borderWidth: 1.5,
        borderColor: color + (i === 1 ? 'CC' : '55'),
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 6, justifyContent: 'space-between',
      }}>
        <View style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: color, opacity: 0.3 }} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === 1 ? '#EF4444' : color, opacity: i === 1 ? 1 : 0.3 }} />
      </View>
    ))}
    <View style={{
      position: 'absolute', bottom: 0, right: 0,
      width: 18, height: 18, borderRadius: 9,
      backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 }}>!</Text>
    </View>
  </View>
);

const EmptyIllustration: React.FC<{ color: string }> = ({ color }) => (
  <View style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 52, height: 36, borderRadius: 6, borderWidth: 2, borderColor: color, backgroundColor: color + '14', position: 'absolute', bottom: 6 }} />
    <View style={{ width: 22, height: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderWidth: 2, borderBottomWidth: 0, borderColor: color, backgroundColor: color + '14', position: 'absolute', bottom: 40, left: 6 }} />
    <View style={{ position: 'absolute', bottom: 12, right: 6, width: 20, height: 20, borderRadius: 10, borderWidth: 2.5, borderColor: color }} />
    <View style={{ position: 'absolute', bottom: 6, right: 4, width: 9, height: 2.5, backgroundColor: color, borderRadius: 2, transform: [{ rotate: '45deg' }] }} />
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  ringOuter: {
    borderRadius: 72,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  ringInner: {
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    width: Math.min(width - 72, 320),
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 4 },
    }),
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default ErrorScreen;