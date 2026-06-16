import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { FollowerItem } from '../../services/followerListService';
import { commonStyles, spacing } from '../../styles/common.styles';
import { detailsStyles } from '../../styles/details.styles';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';

interface FollowerCardProps {
    item: FollowerItem;
   
}

const FollowerListCard: React.FC<FollowerCardProps> = ({
    item,
   
}) => {
    const { t } = useTranslation(['follower', 'common']);
    const navigation = useNavigation<any>();

    const fullName = useMemo(() =>
        `${item.firstname} ${item.lastname}`.trim(),
        [item.firstname, item.lastname]
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
            ? item.profile_picture
            : null,
        [item.profile_picture]
    );

    const flagImageUri = useMemo(() =>
        item.flag_url && item.flag_url.trim() !== ''
            ? item.flag_url
            : null,
        [item.flag_url]
    );

    return (
        <View
            style={[
                commonStyles.card,
                { padding: 0, marginBottom: spacing.xs, marginTop: spacing.xl },
            ]}
        >
            <View style={detailsStyles.topRow}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={commonStyles.text}>{item.city}</Text>
                        {flagImageUri && (
                            <>
                                <Text style={commonStyles.text}>|</Text>
                                <Image
                                    source={{ uri: flagImageUri }}
                                    style={{
                                        width: 20,
                                        height: 14,
                                        borderRadius: 2,
                                    }}
                                    resizeMode="cover"
                                />
                            </>
                        )}
                    </View>
                </View>
            </View>

             <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                    style={[commonStyles.favoriteButton, { borderRadius: 0, flex: 1 }]}
                    activeOpacity={0.8}
                    onPress={() =>
                        navigation.navigate('ProfileScreen', {
                            customer_app_id: item.customer_app_id,
                        })
                    }
                >
                    <Text style={commonStyles.primaryButtonText}>
                        {t('follower:button.viewprofile')}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default FollowerListCard;