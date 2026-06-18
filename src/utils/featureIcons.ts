import { Ionicons } from '@expo/vector-icons';

export const FEATURE_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
    // ── Ravitaillement / aid ──────────────────────────────────────────
    ravitol:        'water-outline',        // ravitaillement liquide (drink only)
    ravitoc:        'restaurant-outline',   // ravitaillement complet (food + drink)
    ravitaillement: 'restaurant-outline',
    biere:          'beer-outline',         // bière — refreshment

    // ── Medical / safety ──────────────────────────────────────────────
    hopital:        'medkit-outline',
    ambulance:      'medkit-outline',       // ambulance / medical post
    secours:        'alert-circle-outline',
    assistance:     'car-outline',

    // ── Timing / control ──────────────────────────────────────────────
    chrono:         'stopwatch-outline',    // chronométrage / timing point
    barriere:       'timer-outline',
    bh:             'timer-outline',         // barrière horaire (time cutoff)
    controle:       'checkbox-outline',
    signaleur:      'flag-outline',

    // ── Access / logistics ────────────────────────────────────────────
    acces:          'car-sport-outline',
    parking:        'car-sport-outline',
    bus:            'bus-outline',           // navette / shuttle
    toilettes:      'body-outline',
    sac:            'bag-handle-outline',
    abri:           'home-outline',

    // ── Ambiance / scenery ────────────────────────────────────────────
    fanzone:        'people-outline',
    animations:     'musical-notes-outline',
    sommet:         'triangle-outline',
    pointdevue:     'eye-outline',

    // ── RouteYou POI types (Dutch exports) ────────────────────────────
    // Only the genuinely useful ones; other RouteYou POIs (Tunnel, Meer,
    // Aanwijzing, Deelgemeente, …) are better filtered out upstream than
    // shown as aid stations — they'll fall back to the neutral star here.
    restaurant:     'restaurant-outline',
    supermarkt:     'cart-outline',          // supermarket
    bakkerij:       'cafe-outline',          // bakery
    water:          'water-outline',
};

// Lowercase + trim the lookup so case/whitespace from any generator never
// causes a silent miss (e.g. a "Parking" token still resolves to `parking`).
// Unknown tokens fall back to a neutral star so the popup never breaks.
export const getFeatureIcon = (feature: string): keyof typeof Ionicons.glyphMap =>
    FEATURE_ICON_MAP[feature.trim().toLowerCase()] ?? 'star-outline';