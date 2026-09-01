import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { palette, fonts } from '../styles/common.styles';
import { useTranslation } from 'react-i18next';

interface StatsCardProps {
	distance: number;
	elevation: number;
	rank: number;
	speed: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
	distance,
	elevation,
	rank,
	speed,
}) => {
  const { t } = useTranslation();
	return (
		<View style={styles.container}>
			<View style={styles.statItem}>
				<Text style={styles.label}>{t('details:chart.distance')}</Text>
				<Text style={styles.value}>{distance.toFixed(1)} km</Text>
			</View>
			<View style={styles.statItem}>
				<Text style={styles.label}>{t('details:chart.elevation')}</Text>
				<Text style={styles.value}>{Math.round(elevation)} m</Text>
			</View>
			<View style={styles.statItem}>
				<Text style={styles.label}>Rank</Text>
				<Text style={styles.value}>#{rank}</Text>
			</View>
			<View style={styles.statItem}>
				<Text style={styles.label}>Speed</Text>
				<Text style={styles.value}>{speed.toFixed(1)} km/h</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		backgroundColor: 'white',
		paddingVertical: 12,
		paddingHorizontal: 16,
		justifyContent: 'space-around',
		borderBottomWidth: 1,
		borderBottomColor: palette.border,
	},
	statItem: {
		alignItems: 'center',
	},
	label: {
		fontFamily: fonts.bodySemi,
        fontSize: 11,
		color: palette.textBody,
		marginBottom: 2,
		textTransform: 'uppercase',
		},
	value: {
		fontFamily: fonts.display,
        fontSize: 15,
		color: palette.ink,
	},
});