export interface ParticipantMapMarker {
    id: number;
    customer_app_id: number;
    bib: number;
    name: string;
    initials: string;
    lat: number;
    lon: number;
    ele: number;
    gender: string;
    position: string;
    position_gender: string;
    position_category: string;
    category: string;
    race_time: string;
    race_time_seconds: number;
    distance_km: number;
    avg_speed_kmh: number;
    last_checkpoint_name: string;
    distance_to_next_cp: number | null;
    last_update: string;
    last_update_time: number;
    last_update_type: string;
    profile_picture: string | null;
    source: string;
}

export interface AidStationMapMarker {
    id: string;
    name: string;
    lat: number;
    lon: number;
    ele: number;
    distance_km: number;
    accessible_by_car: boolean;
}

export interface CheckpointData {
    name: string;
    distance: number;
    segment_distance: number;
    elevation: number;
    latitude: number;
    longitude: number;
    accessible_by_car: boolean;
    is_start: boolean;
    is_finish: boolean;
}

export type PopupState = {
    type: 'participant' | 'aidstation' | null;
    data: ParticipantMapMarker | AidStationMapMarker | null;
};