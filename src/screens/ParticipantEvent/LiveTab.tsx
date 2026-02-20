import React, { useRef } from 'react'
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native'
import { EventItem } from '../../services/eventService'
import { commonStyles } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';

const LiveTab = ({ events, onLoadMore, loadingMore }: {
    events: EventItem[],
    onLoadMore: () => void,
    loadingMore: boolean
}) => {
   const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { t } = useTranslation(['event', 'common']);
    if (events.length === 0) {
        return <Text style={[commonStyles.errorText, { marginTop: 40 }]}>No live events at the moment.</Text>;
    }
    const hasTriggered = useRef(false);
    const handleLoadMore = () => {
        if (hasTriggered.current || loadingMore) return;
        hasTriggered.current = true;
        onLoadMore();
        // reset after delay
        setTimeout(() => { hasTriggered.current = false; }, 100);
    };

    return (
        <FlatList
            data={events}
            keyExtractor={(item, index) => `${item.product_app_id}_${index}`}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}  // ✅ lower = less eager
            showsVerticalScrollIndicator={false}
            ListFooterComponent={
                loadingMore
                    ? <ActivityIndicator size="small" color="#f4a100" style={{ marginVertical: 16 }} />
                    : null
            }
            renderItem={({ item }) => (
                <View style={[commonStyles.card, { paddingTop: 18, padding: 0, overflow: 'hidden', marginBottom: 20 }]}>
                    <View style={eventStyles.header}>
                        <Text style={[commonStyles.title, { marginBottom: 5 }]}>{item.name}</Text>
                        <Text style={commonStyles.subtitle}>{item.race_date} at {item.race_time}</Text>
                    </View>
                    <TouchableOpacity style={commonStyles.primaryButton} onPress={()=>navigation.navigate('EventDetails', { product_app_id: item.product_app_id, event_name: item.name })}>
                        <Text style={commonStyles.primaryButtonText}>{t('official.button')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        />
    );
};

export default LiveTab;