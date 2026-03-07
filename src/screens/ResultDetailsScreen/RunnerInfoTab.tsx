// tabs/RunnerInfoTab.tsx

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const RunnerInfoTab: React.FC = () => {
    const { t } = useTranslation('resultDetails');

    return (
        <View style={styles.container}>
            <View style={styles.card}>

                {/* ── avatar circle ── */}
                <View style={styles.avatarCircle}>
                    <Ionicons name="person-outline" size={64} color="#3b82f6" />
                </View>

                {/* ── name — comes from API ── */}
                <Text style={styles.name}>CHEN Weiting</Text>

                {/* ── divider ── */}
                <View style={styles.divider} />

                {/* ── club | category ── */}
                <View style={styles.row}>
                    <View style={styles.col}>
                        <Text style={styles.colLabel}>{t('runnerInfo.club')}</Text>
                        <Text style={styles.colValue}>{t('runnerInfo.noClub')}</Text>
                    </View>
                    <View style={styles.colDivider} />
                    <View style={styles.col}>
                        <Text style={styles.colLabel}>{t('runnerInfo.category')}</Text>
                        {/* value from API */}
                        <Text style={styles.colValue}>Open ()</Text>
                    </View>
                </View>

                {/* ── divider ── */}
                <View style={styles.divider} />

                {/* ── UTMB Index | UTMB World Series ── */}
                <View style={styles.row}>
                    {/* UTMB INDEX */}
                    <View style={styles.col}>
                        <View style={styles.utmbIndexBadge}>
                            <Text style={styles.utmbText}>UTMB</Text>
                            <View style={styles.utmbIndexTag}>
                                <Text style={styles.utmbIndexText}>INDEX</Text>
                            </View>
                        </View>
                        {/* value from API */}
                        <Text style={styles.utmbValue}>512</Text>
                    </View>

                    <View style={styles.colDivider} />

                    {/* UTMB WORLD SERIES */}
                    <View style={styles.col}>
                        <View style={styles.utmbSeriesBadge}>
                            <Text style={styles.utmbSeriesTitle}>UTMB®</Text>
                            <Text style={styles.utmbSeriesSub}>WORLD SERIES</Text>
                        </View>
                        {/* icon — static */}
                        <View style={styles.seriesIconBox}>
                            <Ionicons name="card-outline" size={28} color="#333" />
                        </View>
                    </View>
                </View>

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingVertical: 28,
        paddingHorizontal: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },

    // ── avatar ─────────────────────────────────────────────────────────────
    avatarCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: '#3b82f6',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },

    // ── name ───────────────────────────────────────────────────────────────
    name: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111',
        textAlign: 'center',
        marginBottom: 24,
    },

    // ── divider ────────────────────────────────────────────────────────────
    divider: {
        height: 1,
        backgroundColor: '#eee',
        marginBottom: 20,
    },

    // ── row / col layout ───────────────────────────────────────────────────
    row: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    col: {
        flex: 1,
        alignItems: 'center',
        gap: 12,
    },
    colDivider: {
        width: 1,
        backgroundColor: '#eee',
        marginHorizontal: 8,
    },
    colLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#888',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    colValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111',
    },

    // ── UTMB Index badge ───────────────────────────────────────────────────
    utmbIndexBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    utmbText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    utmbIndexTag: {
        backgroundColor: '#3b82f6',
        borderRadius: 3,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    utmbIndexText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    utmbValue: {
        fontSize: 22,
        fontWeight: '900',
        color: '#111',
    },

    // ── UTMB World Series badge ────────────────────────────────────────────
    utmbSeriesBadge: {
        alignItems: 'center',
    },
    utmbSeriesTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#1a1a2e',
        letterSpacing: 1,
    },
    utmbSeriesSub: {
        fontSize: 9,
        fontWeight: '700',
        color: '#1a1a2e',
        letterSpacing: 1,
    },
    seriesIconBox: {
        width: 44,
        height: 36,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default RunnerInfoTab;
