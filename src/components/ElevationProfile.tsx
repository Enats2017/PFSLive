import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { VictoryArea, VictoryChart, VictoryAxis, VictoryScatter, VictoryLine } from 'victory-native';
import { ChartDataPoint, Station } from '../types';

interface ElevationProfileProps {
	chartData: ChartDataPoint[];
	stations: Station[];
	currentDistance: number;
	totalDistance: number;
}

export const ElevationProfile: React.FC<ElevationProfileProps> = ({
	chartData,
	stations,
	currentDistance,
	totalDistance,
}) => {
	const width = Dimensions.get('window').width;
	const height = 200;

	// Find min/max elevation for better scaling
	const elevations = chartData.map(d => d.y);
	const minEle = Math.min(...elevations);
	const maxEle = Math.max(...elevations);
	const eleRange = maxEle - minEle;
	const yDomain = [minEle - eleRange * 0.1, maxEle + eleRange * 0.1];

	// Station points for the chart
	const stationChartPoints = stations
		.filter(s => s.distance !== undefined)
		.map(s => ({
			x: s.distance!,
			y: s.ele,
		}));

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Elevation Profile</Text>
			<VictoryChart
				width={width}
				height={height}
				padding={{ top: 20, bottom: 40, left: 50, right: 20 }}
				domain={{ x: [0, totalDistance], y: yDomain }}
			>
				{/* X Axis */}
				<VictoryAxis
					style={{
						axis: { stroke: '#ccc' },
						tickLabels: { fontSize: 10, fill: '#666' },
						grid: { stroke: '#e0e0e0', strokeDasharray: '3,3' },
					}}
					tickFormat={(t) => `${Math.round(t)}km`}
					tickValues={[0, totalDistance * 0.25, totalDistance * 0.5, totalDistance * 0.75, totalDistance]}
				/>

				{/* Y Axis */}
				<VictoryAxis
					dependentAxis
					style={{
						axis: { stroke: '#ccc' },
						tickLabels: { fontSize: 10, fill: '#666' },
						grid: { stroke: '#e0e0e0', strokeDasharray: '3,3' },
					}}
					tickFormat={(t) => `${Math.round(t)}m`}
				/>

				{/* Elevation Area */}
				<VictoryArea
					data={chartData}
					style={{
						data: {
							fill: 'rgba(220, 20, 60, 0.3)',
							stroke: '#DC143C',
							strokeWidth: 2,
						},
					}}
				/>

				{/* Station vertical lines */}
				{stationChartPoints.map((station, idx) => (
					<VictoryLine
						key={`station-line-${idx}`}
						data={[
							{ x: station.x, y: yDomain[0] },
							{ x: station.x, y: yDomain[1] },
						]}
						style={{
							data: { stroke: '#000', strokeWidth: 1, strokeDasharray: '4,4' },
						}}
					/>
				))}

				{/* Station markers */}
				<VictoryScatter
					data={stationChartPoints}
					size={5}
					style={{
						data: {
							fill: '#000',
							stroke: '#fff',
							strokeWidth: 2,
						},
					}}
				/>

				{/* Current position indicator */}
				<VictoryLine
					data={[
						{ x: currentDistance, y: yDomain[0] },
						{ x: currentDistance, y: yDomain[1] },
					]}
					style={{
						data: { stroke: '#FF6B35', strokeWidth: 3 },
					}}
				/>
			</VictoryChart>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		backgroundColor: 'white',
		paddingVertical: 10,
	},
	title: {
		fontSize: 14,
		fontWeight: 'bold',
		color: '#333',
		marginLeft: 16,
		marginBottom: 8,
	},
});