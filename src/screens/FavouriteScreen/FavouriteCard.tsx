import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, commonStyles } from '../../styles/common.styles';
import { useTranslation } from 'react-i18next';
import { resultInfoStyles } from '../../styles/resultDetails.styles';
import { resultListStyle } from '../../styles/ResultList.styles';
import { favstyle } from '../../styles/favourite.style';
import { FavouriteItem } from '../../services/favourites';

const statusColor = (status: string) => {
    switch (status) {
        case 'in_progress': return colors.primary;
        case 'finished': return colors.participantColor;
        case 'not_started':
        default: return colors.gray900;
    }
};

const FavouriteCard = ({ item }: { item: FavouriteItem }) => {
    const { t } = useTranslation(['favourite', 'common']);
    
    const fullName = `${item.firstname} ${item.lastname}`.trim();
    
    return (
        <View style={favstyle.wrapper}>
            <View style={favstyle.card}>
                <View style={resultInfoStyles.headerBar}>
                    <View style={favstyle.headerLeft}>
                        <Text style={[commonStyles.text, { color: statusColor(item.race_status) }]}>
                            {t(`status.${item.race_status}`, {
                                defaultValue: t('favourite:status.not_started')
                            })}
                        </Text>
                    </View>
                    <View style={favstyle.diagLeft} />
                    <View style={favstyle.headerMiddle} />
                    <View style={favstyle.diagRight} />
                    <View style={favstyle.headerRight}>
                        <Text style={commonStyles.text}>
                            {item.distance_name}
                        </Text>
                    </View>
                </View>
                <View style={favstyle.body}>
                    <Text style={[commonStyles.title, { marginBottom: 5 }]}>
                        {item.bib_number}
                    </Text>
                    <Text style={commonStyles.title}>
                        {fullName}
                    </Text>

                </View>
            </View>
        </View>
    );
};

export default FavouriteCard;