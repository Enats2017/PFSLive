import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Participant } from '../../services/participantService';
import { colors, commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../constants/config';

interface ParticipantCardProps {
  item: Participant;
  product_app_id: number; // ✅ ADDED
  isFollowed: boolean;
  isLoading: boolean;
  onToggleFollow: () => void;
  password_protected?: 0 | 1;
}

const ParticipantCard: React.FC<ParticipantCardProps> = React.memo(({
  item,
  product_app_id, // ✅ ADDED
  isFollowed,
  isLoading,
  onToggleFollow
}) => {
  const { t } = useTranslation(['details', 'follower']);

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
      ? getImageUrl(item.profile_picture)
      : null,
    [item.profile_picture]
  );

  const hasBibNumber = item.bib_number && item.bib_number.trim() !== '';
  const isLiveTracking = item.live_tracking_activated === 1;

  // ✅ REMOVED: canFollow check - show button for ALL participants

  return (
    <View
      style={[
        commonStyles.card,
        { padding: 0, overflow: 'hidden', marginBottom: spacing.lg },
      ]}
    >
      <View style={detailsStyles.topRow}>
        {/* ✅ PROFILE PICTURE WITH FALLBACK TO INITIALS */}
        <View style={detailsStyles.avatar}>
          {profileImageUri ? (
            <Image
              source={{ uri: profileImageUri }}
              style={detailsStyles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={detailsStyles.avatarFallback}>
              <Text style={detailsStyles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        <LinearGradient
          colors={['#e8341a', '#f4a100', '#1a73e8']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={detailsStyles.divider}
        />

        <View style={detailsStyles.info}>
          <Text style={commonStyles.title}>{fullName}</Text>
          <Text style={commonStyles.text}>
            {item.city} | {item.country}
          </Text>
          <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
          {hasBibNumber && (
            <Text
              style={[
                commonStyles.subtitle,
                { color: colors.primary, fontWeight: '600' },
              ]}
            >
              {t('details:tracking.bib')}: {item.bib_number}
            </Text>
          )}
        </View>
      </View>

      {isLiveTracking && (
        <View style={detailsStyles.liveTrackingBadge}>
          <Ionicons name="radio" size={14} color={colors.success} />
          <Text style={detailsStyles.liveTrackingText}>
            {t('details:tracking.live')}
          </Text>
        </View>
      )}

      {/* ✅ SHOW BUTTON FOR ALL PARTICIPANTS */}
      <TouchableOpacity
        style={[
          commonStyles.primaryButton,
          { borderRadius: 0, opacity: isLoading ? 0.6 : 1 },
        ]}
        activeOpacity={0.8}
        onPress={onToggleFollow}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={commonStyles.primaryButtonText}>
            {isFollowed
              ? t('follower:button.unfollow')
              : item?.password_protected === 1
                ? `🔒 ${t('follower:button.follower')}`
                : t('follower:button.follower')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}, (prevProps, nextProps) => {
  // ✅ OPTIMIZED MEMO COMPARISON
  return (
    prevProps.item.participant_app_id === nextProps.item.participant_app_id &&
    prevProps.item.profile_picture === nextProps.item.profile_picture &&
    prevProps.item.bib_number === nextProps.item.bib_number &&
    prevProps.isFollowed === nextProps.isFollowed &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.password_protected === nextProps.password_protected
  );
});

ParticipantCard.displayName = 'ParticipantCard';

export default ParticipantCard;