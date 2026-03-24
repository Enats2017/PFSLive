import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { colors, commonStyles } from '../../styles/common.styles';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { favstyle } from '../../styles/favourite.style';
import { FavouriteItem } from '../../services/favourites';
import { getImageUrl } from '../../constants/config';

const getStatusColors = (status: string) => {
    switch (status) {
        case 'in_progress':
            return {
                backgroundColor: colors.success,
                textColor: colors.white,
            };
        case 'finished':
            return {
                backgroundColor: colors.participantColor,
                textColor: colors.white,
            };
        case 'not_started':
        default:
            return {
                backgroundColor: colors.gray500,
                textColor: colors.white,
            };
    }
};

interface FavouriteCardProps {
    item: FavouriteItem;
    product_app_id: number;
}

const FavouriteCard: React.FC<FavouriteCardProps> = ({ item, product_app_id }) => {
    const { t } = useTranslation(['favourite', 'common', 'resultdetails']);
    const navigation = useNavigation<any>();
    
    const fullName = useMemo(() => 
        `${item.firstname} ${item.lastname}`.trim(),
        [item.firstname, item.lastname]
    );

    const profileImageUri = useMemo(() =>
        item.profile_picture && item.profile_picture.trim() !== ''
            ? getImageUrl(item.profile_picture)
            : null,
        [item.profile_picture]
    );

    const initials = useMemo(() =>
        [item.firstname?.[0], item.lastname?.[0]]
            .filter(Boolean)
            .join('')
            .toUpperCase() || '?',
        [item.firstname, item.lastname]
    );

    const statusColors = useMemo(() => 
        getStatusColors(item.race_status),
        [item.race_status]
    );

    // ✅ Show finish time if: (in_progress OR finished) AND time exists AND time not empty
    const shouldShowFinishTime = useMemo(() => {
        const hasTime = item.finish_time && item.finish_time.trim() !== '' && item.finish_time !== '0:00:00';
        const isInProgressOrFinished = item.race_status === 'in_progress' || item.race_status === 'finished';
        return hasTime && isInProgressOrFinished;
    }, [item.finish_time, item.race_status]);

    const handlePress = () => {
        navigation.navigate('ResultDetails', {
            raceStatus: item.race_status,
            product_app_id,
            product_option_value_app_id: item.product_option_value_app_id,
            bib: item.bib_number,
            from_live: 0,
        });
    };
    
    return (
        <TouchableOpacity 
            style={favstyle.wrapper} 
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <View style={favstyle.card}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={[
                        favstyle.headerLeft,
                        { backgroundColor: statusColors.backgroundColor }
                    ]}>
                        <Text style={[
                            commonStyles.text, 
                            { color: statusColors.textColor, fontWeight: '600' }
                        ]}>
                            {t(`resultdetails:status.${item.race_status}`)}
                        </Text>
                    </View>
                    <View style={[
                        favstyle.diagLeft,
                        { borderTopColor: statusColors.backgroundColor }
                    ]} />
                    <View style={favstyle.headerMiddle} />
                    <View style={favstyle.diagRight} />
                    <View style={favstyle.headerRight}>
                        <Text style={[commonStyles.text, { color: colors.white, fontWeight: '600' }]}>
                            {item.distance_name}
                        </Text>
                    </View>
                </View>

                <View style={favstyle.body}>
                    {/* {profileImageUri ? (
                        <Image
                            source={{ uri: profileImageUri }}
                            style={favstyle.profileImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={favstyle.profilePlaceholder}>
                            <Text style={favstyle.profileInitials}>{initials}</Text>
                        </View>
                    )} */}
                    
                    <Text style={[commonStyles.title, { marginTop: 8 }]}>
                        {item.bib_number}
                    </Text>
                    <Text style={commonStyles.title}>
                        {fullName}
                    </Text>
                    
                    {/* ✅ Show finish time if conditions met */}
                    {shouldShowFinishTime && (
                        <Text style={favstyle.finishTime}>
                            {item.finish_time}
                        </Text>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

export default React.memo(FavouriteCard);