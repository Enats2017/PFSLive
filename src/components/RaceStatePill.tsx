import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { liveTrackingStyles } from '../styles/liveTracking.styles';

export type RaceState = 'live' | 'finished' | 'upcoming';

interface RaceStatePillProps {
  raceState: RaceState;
}

/**
 * The map's status pill: Live / Finished / Upcoming.
 *
 * Its own component because it renders in two places — beside the distance
 * dropdown on a partner event, and on its own header row for a custom event,
 * which has no dropdown to hang it from. Two copies of the markup is exactly
 * how this codebase has drifted before.
 *
 * Only a live race gets the lime tint; a finished or not-yet-started one takes
 * the neutral fill, so "happening now" stays a colour you can trust.
 */
export const RaceStatePill: React.FC<RaceStatePillProps> = ({ raceState }) => {
  const { t } = useTranslation(['livetracking']);

  return (
    <View
      style={[
        liveTrackingStyles.mapLivePill,
        raceState === 'finished' && liveTrackingStyles.mapPillFinished,
        raceState === 'upcoming' && liveTrackingStyles.mapPillUpcoming,
      ]}
    >
      <Text
        style={[
          liveTrackingStyles.mapLiveText,
          raceState !== 'live' && liveTrackingStyles.mapPillMutedText,
        ]}
      >
        {t(`livetracking:raceState_${raceState}`)}
      </Text>
    </View>
  );
};

export default RaceStatePill;
