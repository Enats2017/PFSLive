import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
	return (
		<View style={styles.container}>
			<View style={styles.statItem}>
				<Text style={styles.label}>Distance</Text>
				<Text style={styles.value}>{distance.toFixed(1)} km</Text>
			</View>
			<View style={styles.statItem}>
				<Text style={styles.label}>Elevation</Text>
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
		borderBottomColor: '#e0e0e0',
	},
	statItem: {
		alignItems: 'center',
	},
	label: {
		fontSize: 11,
		color: '#666',
		marginBottom: 2,
		textTransform: 'uppercase',
		fontWeight: '600',
	},
	value: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#000',
	},
});