import React from 'react';
import { Text, View, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ui } from '../../styles/ui.styles';
import { palette } from '../../styles/common.styles';

interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Avatar, rank badge or icon shown before the text. */
  leading?: React.ReactNode;
  /** Badge, time or any node shown after the text, before the chevron. */
  trailing?: React.ReactNode;
  /** The lime left edge that marks athlete rows. */
  accent?: boolean;
  onPress?: () => void;
  showChevron?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ListRow: React.FC<ListRowProps> = React.memo(({
  title,
  subtitle,
  leading,
  trailing,
  accent = false,
  onPress,
  showChevron = false,
  style,
}) => {
  const content = (
    <>
      {leading}
      <View style={ui.rowBody}>
        <Text style={ui.rowTitle} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={ui.rowSubtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {trailing}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
      )}
    </>
  );

  const rowStyle = [ui.row, accent && ui.rowAccent, style];

  // A row without onPress is presentational, so it must not look or read as a button.
  if (!onPress) return <View style={rowStyle}>{content}</View>;

  return (
    <TouchableOpacity
      style={rowStyle}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      {content}
    </TouchableOpacity>
  );
});

ListRow.displayName = 'ListRow';

/** The lime circle carrying a finishing position. */
export const RankBadge: React.FC<{ rank: number | string }> = React.memo(({ rank }) => (
  <View style={ui.rank}>
    <Text style={ui.rankText}>{rank}</Text>
  </View>
));

RankBadge.displayName = 'RankBadge';
