import React from 'react';
import { Text } from 'react-native';
import { useCountdown } from '../hooks/useCountdown';
import { useTranslation } from 'react-i18next';
import { detailsStyles } from '../styles/details.styles';
import { colors } from '../styles/common.styles';

interface CountdownBadgeProps {
    days: number;
    hours: number;
    minutes: number;
    status: string;
}

const CountdownBadge: React.FC<CountdownBadgeProps> = ({ days, hours, minutes, status }) => {
    const { t } = useTranslation(['details']);
    const { days: d, hours: h, minutes: m, seconds: s, totalSeconds } = useCountdown(days, hours, minutes, status);

    const badge = (label: string, color: string) => (
        <Text style={[detailsStyles.metaText, { color, fontWeight: '600', flexShrink: 1 }]} numberOfLines={2}>
            {label}
        </Text>
    );

    if (status === 'in_progress' || (status === 'not_started' && totalSeconds <= 0)) {
        return badge(`${t('details:countdown.live')}`, colors.error);
    }

    if (status === 'finished') {
        return badge(t('details:countdown.finished'), colors.gray500);
    }

    if (status === 'not_started') {
        const [label, color] =
            d > 0 ? [`${d}${t('details:countdown.days')} ${h}${t('details:countdown.hours')} ${m}${t('details:countdown.minutes')}`, colors.info] :
            h > 0 ? [`${h}${t('details:countdown.hours')} ${m}${t('details:countdown.minutes')} ${s}${t('details:countdown.seconds')}`, colors.success] :
            m > 0 ? [`${m}${t('details:countdown.minutes')} ${s}${t('details:countdown.seconds')}`, colors.warning] :
                    [`${s}${t('details:countdown.seconds')}`, colors.error];

        return badge(`${t('details:countdown.startsIn')} ${label}`, color);
    }

    return null;
};

export default CountdownBadge;