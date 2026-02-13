export interface TrackPoint {
	lat: number;
	lon: number;
	ele: number;
}

export interface Station {
	lat: number;
	lon: number;
	ele: number;
	name: string;
	distance?: number; // km from start
}

export interface RouteData {
	name: string;
	trackPoints: TrackPoint[];
	stations: Station[];
	totalDistance: number; // km
}

export interface ChartDataPoint {
	x: number; // distance in km
	y: number; // elevation in m
}

export interface ParticipantPosition {
	lat: number;
	lon: number;
	ele: number;
	distance: number; // km from start
	speed: number; // km/h
	rank: number;
}