import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { palette, space, radii, fonts } from '../styles/common.styles';

/**
 * The deck's amber notice card — an inline warning that explains a consequence
 * ("Location must be Always", "Manual selection required").
 *
 * Anatomy is taken from the artboards: a hairline amber border all round, NOT
 * the 4px left bar the old design used, and copy in its own darker ambers —
 * `palette.warning` is the icon accent and is too light to read as body text on
 * `warningBg`.
 */
export const NoticeCard: React.FC<{
  title: string;
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
}> = ({ title, message, icon = 'warning-outline' }) => (
  <View style={styles.card} accessibilityRole="alert">
    <Ionicons name={icon} size={20} color={palette.warning} style={styles.icon} />
    <View style={styles.body}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: palette.warningBg,
    borderWidth: 1,
    borderColor: palette.warningBorder,
    borderRadius: radii.md,
    padding: space.lg,
  },
  icon: {
    flexShrink: 0,
    marginTop: 1,
  },
  body: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: palette.warningTitle,
  },
  message: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.warningText,
    lineHeight: 19,   // deck: 1.55
    marginTop: space.xs,
  },
});

export default NoticeCard;
