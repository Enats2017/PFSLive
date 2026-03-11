import { View, Text, TouchableOpacity } from "react-native";
import { useFollow } from "../../hooks/useFollow";
import { Participant } from "../../services/participantService";
import { colors, commonStyles, spacing } from "../../styles/common.styles";
import { detailsStyles } from "../../styles/details.styles";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from 'react-i18next';


const ParticipantCard: React.FC<{ item: Participant; t: any }> = ({ item, t }) => {
  const { isFollowed, isLoading, toggleFollow, canFollow } = useFollow(item.customer_app_id);
  console.log('ParticipantCard useFollow state:', {
    type: typeof item.customer_app_id,
    isFollowed,

  });
  const fullName =
    `${item.firstname ?? ''} ${item.lastname ?? ''}`.trim().toUpperCase() ||
    t('details:participant.unknownName');
  const hasBibNumber = item.bib_number && item.bib_number.trim() !== '';
  const isLiveTracking = item.live_tracking_activated === 1;

  return (
    <View style={[commonStyles.card, { padding: 0, overflow: 'hidden', marginBottom: spacing.lg }]}>
      <View style={detailsStyles.topRow}>
        <View style={detailsStyles.avatar}>
          <Ionicons name="person-circle-outline" size={55} color="#9ca3af" style={detailsStyles.logo} />
        </View>
        <LinearGradient
          colors={['#e8341a', '#f4a100', '#1a73e8']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={detailsStyles.divider}
        />
        <View style={detailsStyles.info}>
          <Text style={commonStyles.title}>{fullName}</Text>
          <Text style={commonStyles.text}>{item.city} | {item.country}</Text>
          <Text style={commonStyles.subtitle}>{item.race_distance}</Text>
          {hasBibNumber && (
            <Text style={[commonStyles.subtitle, { color: colors.primary, fontWeight: '600' }]}>
              {t('details:tracking.bib')}: {item.bib_number}
            </Text>
          )}
        </View>
      </View>

      {isLiveTracking && (
        <View style={detailsStyles.liveTrackingBadge}>
          <Ionicons name="radio" size={14} color={colors.success} />
          <Text style={detailsStyles.liveTrackingText}>{t('details:tracking.live')}</Text>
        </View>
      )}

      {/* ✅ Only show button if customerId > 0 */}

      <TouchableOpacity
        style={[commonStyles.primaryButton, { borderRadius: 0 }]}
        activeOpacity={0.8}
        onPress={toggleFollow}
        disabled={isLoading}
      >
        <Text style={commonStyles.primaryButtonText}>
          {isFollowed ? t('follower:button:unfollow') : t('follower:button.favourite')}
        </Text>
      </TouchableOpacity>

    </View>
  );
};

export default ParticipantCard