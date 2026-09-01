import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from './ui';

export type ErrorType = 'network' | 'server' | 'empty';

// ✅ Redesign: the three bespoke View-art illustrations are gone. They carried
// their own orange and indigo palettes — the only place those colours appeared —
// and 120 lines of absolutely-positioned decoration. The deck draws every one of
// these states the same way: neutral ring, icon, title, one line, action.
const ERROR_ICON: Record<ErrorType, keyof typeof Ionicons.glyphMap> = {
  network: 'cloud-offline-outline',
  server: 'server-outline',
  empty: 'file-tray-outline',
};

interface ErrorScreenProps {
  type: ErrorType;
  onRetry: () => void;
  title?: string;
  message?: string;
  buttonLabel?: string;
  style?: ViewStyle;
  /**
   * A way FORWARD from an empty state — "Find an athlete", "Browse events".
   * 37_EmptyStates.png is built around this button; without it an empty screen
   * is a dead end, which is why `empty` deliberately has no retry.
   */
  emptyAction?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({
  type,
  onRetry,
  title,
  message,
  buttonLabel,
  style,
  emptyAction,
}) => {
  const { t } = useTranslation('errorScreen');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A single fade-in. The old version also ran an infinite "breathing" loop on
    // the icon, which never stopped on a screen a user may leave open.
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [type, fadeAnim]);

  return (
    <Animated.View style={[{ flex: 1, opacity: fadeAnim }, style]}>
      <EmptyState
        icon={ERROR_ICON[type]}
        title={title ?? t(`${type}.title`)}
        message={message ?? t(`${type}.message`)}
        // 'empty' is not a failure — there is nothing to RETRY. It can still
        // offer a way forward, which the caller supplies as `emptyAction`.
        actionLabel={type === 'empty' ? emptyAction?.label : buttonLabel ?? t(`${type}.button`)}
        onAction={type === 'empty' ? emptyAction?.onPress : onRetry}
        actionIcon={type === 'empty' ? emptyAction?.icon : 'refresh'}
      />
    </Animated.View>
  );
};

export default ErrorScreen;
