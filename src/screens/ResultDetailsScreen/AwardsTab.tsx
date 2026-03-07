// tabs/AwardsTab.tsx

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

// hardcoded — will come from API later
const AWARDS_DATA = [
    {
        year:          '2024',
        raceName:      'DRAGON, TIGER, PHOENIX TRAIL - KIRIN',
        time:          '26:12:24',
        country:       'Chinese Taipei',
        countryFlag:   '🇹🇼',
        ranking:       '27',
        genderRanking: '- -',
        distance:      '88 km',
        elevationGain: '7000 m+',
    },
];

const AwardsTab: React.FC = () => {
    const { t } = useTranslation('resultDetails');

    return (
        <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
        >
            {AWARDS_DATA.map((award, index) => (
                <View key={index} style={styles.card}>

                    {/* ── blue diagonal corner badge ── */}
                    <View style={styles.cornerBadgeWrap}>
                        <View style={styles.cornerBadge}>
                            <Text style={styles.cornerBadgeText}>{award.year}</Text>
                        </View>
                    </View>

                    {/* ── race name ── */}
                    <Text style={styles.raceName}>{award.raceName}</Text>

                    {/* ── divider ── */}
                    <View style={styles.divider} />

                    {/* ── TIME | COUNTRY ── */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.time')}</Text>
                            <Text style={styles.colValue}>{award.time}</Text>
                        </View>
                        <View style={styles.colDivider} />
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.country')}</Text>
                            <View style={styles.countryRow}>
                                <Text style={styles.flagEmoji}>{award.countryFlag}</Text>
                                <Text style={styles.colValue}>{award.country}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* ── RANKING | GENDER RANKING ── */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.ranking')}</Text>
                            <Text style={styles.colValue}>{award.ranking}</Text>
                        </View>
                        <View style={styles.colDivider} />
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.genderRanking')}</Text>
                            <Text style={styles.colValue}>{award.genderRanking}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* ── DISTANCE | ELEVATION GAIN ── */}
                    <View style={styles.row}>
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.distance')}</Text>
                            <Text style={styles.colValue}>{award.distance}</Text>
                        </View>
                        <View style={styles.colDivider} />
                        <View style={styles.col}>
                            <Text style={styles.colLabel}>{t('awards.elevationGain')}</Text>
                            <Text style={styles.colValue}>{award.elevationGain}</Text>
                        </View>
                    </View>

                </View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        paddingBottom: 8,
    },

    // ── blue diagonal corner badge ─────────────────────────────────────────
    cornerBadgeWrap: {
        marginBottom: 16,
    },
    cornerBadge: {
        backgroundColor: '#3b82f6',
        alignSelf: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomRightRadius: 20,
    },
    cornerBadgeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },

    // ── race name ──────────────────────────────────────────────────────────
    raceName: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111',
        paddingHorizontal: 16,
        marginBottom: 16,
        lineHeight: 22,
    },

    // ── divider ────────────────────────────────────────────────────────────
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginHorizontal: 16,
        marginBottom: 16,
    },

    // ── row / col ──────────────────────────────────────────────────────────
    row: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    col: {
        flex: 1,
        gap: 8,
    },
    colDivider: {
        width: 1,
        backgroundColor: '#eee',
        marginHorizontal: 12,
    },
    colLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#999',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    colValue: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111',
    },

    // ── country with flag ──────────────────────────────────────────────────
    countryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    flagEmoji: {
        fontSize: 22,
    },
});

export default AwardsTab;
