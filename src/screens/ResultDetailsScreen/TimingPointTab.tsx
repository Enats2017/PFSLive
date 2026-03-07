// tabs/TimingPointTab.tsx

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

// hardcoded data — will come from API later
const TIMING_DATA = [
    { name: '5 KM',    time: '0:22:22', ranking: '(1.)', done: true  },
    { name: '10 KM',   time: '0:48:10', ranking: '(1.)', done: true  },
    { name: '21 KM',   time: '1:42:05', ranking: '(1.)', done: true  },
    { name: '42 KM',   time: '3:55:30', ranking: '(1.)', done: true  },
    { name: 'Finish',  time: '13:00:05',ranking: '(1.)', done: true  },
];

const TimingPointTab: React.FC = () => {
    const { t } = useTranslation('resultDetails');

    return (
        <ScrollView
            contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
        >
            {TIMING_DATA.map((item, index) => (
                <View key={index} style={styles.row}>

                    {/* ── left: icon + vertical line ── */}
                    <View style={styles.iconCol}>
                        <View style={[styles.iconCircle, item.done && styles.iconCircleDone]}>
                            <Ionicons
                                name={item.name === 'Finish' ? 'flag' : 'location'}
                                size={16}
                                color={item.done ? '#fff' : '#aaa'}
                            />
                        </View>
                        {/* vertical connector line — hidden for last item */}
                        {index < TIMING_DATA.length - 1 && (
                            <View style={styles.connector} />
                        )}
                    </View>

                    {/* ── right: card ── */}
                    <View style={styles.card}>
                        <Text style={styles.checkpointName}>{item.name}</Text>
                        <View style={styles.cardRow}>
                            <View style={styles.cardCol}>
                                <Text style={styles.cardLabel}>{t('timingPoint.time')}</Text>
                                <Text style={styles.cardValue}>{item.time}</Text>
                            </View>
                            <View style={[styles.cardCol, styles.cardColBorder]}>
                                <Text style={styles.cardLabel}>{t('timingPoint.ranking')}</Text>
                                <Text style={styles.cardValue}>{item.ranking}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        marginBottom: 0,
    },

    // ── icon column ────────────────────────────────────────────────────────
    iconCol: {
        alignItems: 'center',
        width: 40,
        paddingTop: 16,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#ddd',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleDone: {
        backgroundColor: '#27ae60',
    },
    connector: {
        width: 2,
        flex: 1,
        minHeight: 24,
        backgroundColor: '#27ae60',
        marginVertical: 4,
    },

    // ── card ───────────────────────────────────────────────────────────────
    card: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginLeft: 12,
        marginBottom: 12,
        paddingTop: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
        elevation: 2,
    },
    checkpointName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    cardRow: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardCol: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
    },
    cardColBorder: {
        borderLeftWidth: 1,
        borderColor: '#f0f0f0',
    },
    cardLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#999',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    cardValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111',
    },
});

export default TimingPointTab;
