import React from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { EventItem } from '../../services/eventService';
import { commonStyles } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { formatEventDate } from '../../utils/dateFormatter';

const PastTab = ({ events, onLoadMore, loadingMore }: {
    events: EventItem[],
    onLoadMore: () => void,
    loadingMore: boolean
}) => {
    const { t } = useTranslation(['event', 'common']);
    
    if (events.length === 0) {
        return (
            <View style={{ marginTop: 40 }}>
                <Text style={commonStyles.errorText}>{t('empty.past', 'No past events found.')}</Text>
            </View>
        );
    }

    return (
        <FlatList
            data={events}
            keyExtractor={(item) => item.product_app_id}
            onEndReached={() => {
                console.log('Past: End reached, loadingMore:', loadingMore);
                if (!loadingMore) {
                    onLoadMore();
                }
            }}
            onEndReachedThreshold={0.1}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 10 }}
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator size="small" color="#f4a100" style={{ marginVertical: 10 }} />
                ) : null
            }
            renderItem={({ item }) => (
                <View style={[commonStyles.card, { paddingTop: 1, padding: 0, overflow: 'hidden', marginBottom: 5 }]}>
                    <View style={eventStyles.header}>
                        <Text style={[commonStyles.title, { marginBottom: 5 }]}>{item.name}</Text>
                        <Text style={commonStyles.subtitle}>{formatEventDate(item.race_date, t)}</Text>
                    </View>
                    <TouchableOpacity style={commonStyles.primaryButton}>
                        <Text style={commonStyles.primaryButtonText}>{t('past.button')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        />
    );
};

export default PastTab;