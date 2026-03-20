import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, commonStyles } from '../../styles/common.styles';
import { useFollowManager } from '../../hooks/useFollowManager';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import { favstyle } from '../../styles/favourite.style';

const RaceCard = ({ item }: any) => {
    const isUser = item.type === 'user';
    const { t } = useTranslation();

    const {
        isFollowed,
        isLoading,
        toggleFollow,
    } = useFollowManager(t);

    const followed = isUser
        ? isFollowed(item.id)
        : isFollowed(item.productId, item.bib);

    const loading = isUser
        ? isLoading(item.id)
        : isLoading(item.productId, item.bib);




    return (
        <View style={favstyle.wrapper}>
            <View style={favstyle.card}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={favstyle.headerLeft}>
                        <Text style={commonStyles.text}>Not Launched</Text>
                    </View>
                    <View style={favstyle.diagLeft} />
                    <View style={favstyle.headerMiddle} />
                    <View style={favstyle.diagRight} />
                    <View style={favstyle.headerRight}>
                        <Text style={commonStyles.text}>UTCC</Text>
                    </View>
                </View>
                <View style={favstyle.body}>
                    <Text style={[commonStyles.title, {marginBottom:5}]}>
                        {isUser ? item.id : item.bib}
                    </Text>
                    <Text style={commonStyles.title}>
                        {isUser
                            ? (item?.name ?? 'User Name')
                            : (item?.runnerName ?? 'Runner Name')}
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default RaceCard;