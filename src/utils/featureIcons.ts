import { Ionicons } from '@expo/vector-icons';

export const FEATURE_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
    ravitol:        'water-outline',
    ravitaillement: 'restaurant-outline',
    hopital:        'medkit-outline',
    assistance:     'car-outline',
    fanzone:        'people-outline',
    acces:          'car-sport-outline',
    animations:     'musical-notes-outline',
    toilettes:      'body-outline',
    sac:            'bag-handle-outline',
    abri:           'home-outline',
    barriere:       'timer-outline',
    controle:       'checkbox-outline',
    signaleur:      'flag-outline',
    secours:        'alert-circle-outline',
    parking:        'car-sport-outline',
    sommet:         'triangle-outline',
    pointdevue:     'eye-outline',
};

export const getFeatureIcon = (feature: string): keyof typeof Ionicons.glyphMap =>
    FEATURE_ICON_MAP[feature] ?? 'star-outline';