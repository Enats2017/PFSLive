import React from 'react';
import { View, Text } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import { useTranslation } from 'react-i18next';
import { detailsStyles } from '../styles/details.styles';
import { colors, commonStyles } from '../styles/common.styles';

interface CountdownBadgeProps {
    days: number;
    hours: number;
    minutes: number;
    status: string;
}

const CountdownBadge: React.FC<CountdownBadgeProps> = ({ days, hours, minutes, status }) => {
    const { t } = useTranslation(['details']);
    const { days: d, hours: h, minutes: m, seconds: s, totalSeconds } = useCountdown(days, hours, minutes, status);

    if (status === 'in_progress') {
        return (
            <View style={[detailsStyles.count, { backgroundColor: colors.success }]}>
                <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
                    {t('details:countdown.live')}
                </Text>
            </View>
        );
    }

    if (status === 'finished') {
        return (
            <View style={[detailsStyles.count, { backgroundColor: colors.gray500 }]}>
                <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
                    {t('details:countdown.finished')}
                </Text>
            </View>
        );
    }

    if (status === 'not_started') {
        // Countdown reached zero
        if (totalSeconds <= 0) {
            return (
                <View style={[detailsStyles.count, { backgroundColor: colors.success }]}>
                    <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
                        {t('details:countdown.live')}
                    </Text>
                </View>
            );
        }

        let label = '';
        let color = colors.gray500;
        if (d > 0) {
            label = `${d}${t('details:countdown.days')} ${h}${t('details:countdown.hours')} ${m}${t('details:countdown.minutes')} `;
            color = colors.info;
        } else if (h > 0) {
            label = `${h}${t('details:countdown.hours')} ${m}${t('details:countdown.minutes')} ${s}${t('details:countdown.seconds')}`;
            color = colors.success;
        } else if (m > 0) {
            label = `${m}${t('details:countdown.minutes')} ${s}${t('details:countdown.seconds')}`;
            color = colors.warning;
        } else {
            label = `${s}${t('details:countdown.seconds')}`;
            color = colors.error;
        }
        return (
            <View style={[detailsStyles.count, { backgroundColor: color }]}>
                <Text style={[commonStyles.text, { color: '#fff', fontWeight: '600' }]}>
                    {t('details:countdown.startsIn')} {label}
                </Text>
            </View>
        );
    }

    return null;
};

export default CountdownBadge;