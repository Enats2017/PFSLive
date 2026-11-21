import React from 'react';
import { Text, View, ScrollView, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '../../styles/ui.styles';
import { palette } from '../../styles/common.styles';
import { Button } from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** One sentence saying what to do next — not an apology. */
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  style,
}) => (
  // ScrollView (content flexGrow 1, block still centred): the block is ~260-300pt
  // and did not scroll — in landscape under a header the Retry button fell
  // outside its parent and could not be tapped (audit 2026-10-22).
  <ScrollView
    contentContainerStyle={{ flexGrow: 1 }}
    showsVerticalScrollIndicator={false}
    bounces={false}
  >
    <View style={[ui.empty, style]}>
      <View style={ui.emptyRing}>
        <Ionicons name={icon} size={34} color={palette.navy} />
      </View>
      <Text style={ui.emptyTitle}>{title}</Text>
      {!!message && <Text style={ui.emptyBody}>{message}</Text>}
      {!!actionLabel && !!onAction && (
        <Button
          label={actionLabel}
          onPress={onAction}
          icon={actionIcon}
          fullWidth={false}
          style={ui.emptyAction}
        />
      )}
    </View>
  </ScrollView>
);
