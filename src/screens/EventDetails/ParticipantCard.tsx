import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Participant } from '../../services/participantService';
import { commonStyles, spacing, palette, fonts } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { analyticsService } from '../../services/analyticsService';
import { ANALYTICS_SCREENS, ANALYTICS_BUTTONS, ANALYTICS_PARAMS } from '../../constants/analyticsScreens';


interface ParticipantCardProps {
  item: Participant;
  product_app_id: number;
  isFollowed: boolean;
  isLoading: boolean;
  onToggleFollow: () => void;
  password_protected?: 0 | 1;
  showResults?: boolean;
}

const ParticipantCard: React.FC<ParticipantCardProps> = React.memo(({
  item,
  product_app_id,
  isFollowed,
  isLoading,
  onToggleFollow,
   showResults = true, 
}) => {
  const { t } = useTranslation(['details', 'follower']);
  const navigation = useNavigation<any>();
  // ✅ MEMOIZED VALUES
  const fullName = useMemo(() =>
    `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim().toUpperCase() ||
    t('details:participant.unknownName'),
    [item.firstname, item.lastname, t]
  );

  const initials = useMemo(() =>
    [item.firstname?.[0], item.lastname?.[0]]
      .filter(Boolean)
      .join('')
      .toUpperCase() || '?',
    [item.firstname, item.lastname]
  );

  const profileImageUri = useMemo(() =>
    item.profile_picture && item.profile_picture.trim() !== ''
      ? (item.profile_picture)
      : null,
    [item.profile_picture]
  );

  const hasBibNumber = item.bib_number && item.bib_number.trim() !== '';
  const isLiveTracking = item.live_tracking_activated === 1;

  // ✅ Button logic driven by source + race_status
  const isResultSource = item.source === 'race_result';
  // 22_ParticipantList.png shows Follow on every row, including finished ones —
  // and that is right: useFollowManager follows by customer_app_id, "ATHLETE
  // scope ... carries across", so following after a race is what puts that
  // athlete in your favourites for their NEXT one. The real precondition is the
  // one the follow call itself enforces — something to follow them by.
  const showFollow =
    (item.customer_app_id !== null &&
      item.customer_app_id !== undefined &&
      Number(item.customer_app_id) > 0) ||
    !!hasBibNumber;
    const shouldShowResults = showResults;

  const bib = item.bib || item.bib_number || '';
  const wave = item.wave;

  // Navigate to ResultDetails (race_result participants)
  const goToResults = () => {
     analyticsService.logInteraction(
      ANALYTICS_SCREENS.PARTICIPANT_LIST,
      ANALYTICS_BUTTONS.PARTICIPANT_PROFILE,
      'tap',
      {
        [ANALYTICS_PARAMS.BIB_NUMBER]: item.bib_number,
      }
    );
    navigation.navigate('ResultDetails', {
      raceStatus: item.race_status,
      product_app_id,
      product_option_value_app_id: item.product_option_value_app_id,
      bib: item.bib_number,
      from_live: 0,
    });
  };

  // Navigate to ProfileScreen (local participants)
  const goToProfile = () => {
     analyticsService.logInteraction(
        ANALYTICS_SCREENS.PARTICIPANT_LIST,
        ANALYTICS_BUTTONS.VIEW_PROFILE,
        'tap',
        {
           [ANALYTICS_PARAMS.PARTICIPANT_ID]: item.customer_app_id ?? 0,
        }
    );
    navigation.navigate('ProfileScreen', {
      customer_app_id: item.customer_app_id,
    });
  };

  const onPrimaryPress = isResultSource ? goToResults : goToProfile;
  const primaryLabel   = isResultSource
    ? t('details:participant.results')
    : t('follower:button.viewprofile');

  const followLabel = isFollowed
    ? t('follower:button.unfollow')
    : item?.password_protected === 1
      ? `🔒 ${t('follower:button.follower')}`
      : t('follower:button.follower');

  return (
    <View
      style={[
        commonStyles.card,
        detailsStyles.rowAccent,
        { marginBottom: spacing.md, marginHorizontal: spacing.md },
      ]}
    >
      <View style={detailsStyles.topRow}>
        {/* ✅ PROFILE PICTURE WITH FALLBACK TO INITIALS */}
        <View style={detailsStyles.avatar}>
          {profileImageUri ? (
            <Image
              source={{ uri: profileImageUri }}
              cachePolicy="memory-disk"
              style={detailsStyles.avatarImage}
              contentFit="cover"
            />
          ) : (
            <View style={detailsStyles.avatarFallback}>
              <Text style={detailsStyles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        <View style={detailsStyles.info}>
          <Text style={detailsStyles.rowName} numberOfLines={1}>{fullName}</Text>
          <Text style={detailsStyles.rowMeta} numberOfLines={1}>
            {[item.city, item.country].filter(Boolean).join(' \u00b7 ')}
          </Text>
          {/* Distance, bib and wave read as one line in the deck rather than
              three stacked rows. */}
          <Text style={detailsStyles.rowMeta} numberOfLines={1}>
            {[
              item.race_distance,
              hasBibNumber ? `${t('details:tracking.bib')} ${item.bib_number}` : null,
              wave ? `${t('details:wave')} ${item.wave}` : null,
            ].filter(Boolean).join(' \u00b7 ')}
          </Text>
        </View>
      </View>

      {isLiveTracking && (
        <View style={detailsStyles.liveTrackingBadge}>
          <Ionicons name="radio" size={14} color={palette.lime} />
          <Text style={detailsStyles.liveTrackingText}>
            {t('details:tracking.live')}
          </Text>
        </View>
      )}

      {/* ✅ ACTION ROW — Results (filled) and Follow (outlined), per
          22_ParticipantList.png. Follow shows whenever the athlete can be
          followed, which is what the follow call itself requires. */}
      <View style={detailsStyles.cardActionRow}>
        {shouldShowResults && (
          <TouchableOpacity
            style={detailsStyles.cardActionPrimary}
            activeOpacity={0.8}
            onPress={onPrimaryPress}
          >
            <Text style={detailsStyles.cardActionPrimaryText}>{primaryLabel}</Text>
          </TouchableOpacity>
        )}

        {showFollow && (
          <TouchableOpacity
            style={[detailsStyles.cardActionSecondary, isLoading && { opacity: 0.6 }]}
            activeOpacity={0.8}
            onPress={onToggleFollow}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={palette.navy} />
            ) : (
              <Text style={detailsStyles.cardActionSecondaryText}>{followLabel}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // ✅ OPTIMIZED MEMO COMPARISON
  return (
    prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
    prevProps.item.profile_picture === nextProps.item.profile_picture &&
    prevProps.item.bib_number === nextProps.item.bib_number &&
    prevProps.item.race_status === nextProps.item.race_status &&
    prevProps.item.source === nextProps.item.source &&
    prevProps.isFollowed === nextProps.isFollowed &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.password_protected === nextProps.password_protected &&
    prevProps.showResults === nextProps.showResults 
  );
});

ParticipantCard.displayName = 'ParticipantCard';

export default ParticipantCard;