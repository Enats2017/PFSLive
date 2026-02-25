import React, { useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { EventItem } from '../../services/eventService';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { formatEventDate } from '../../utils/dateFormatter';

interface PastTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore }) => {
    const { t } = useTranslation(['event', 'common']);
    const onEndReachedCalledDuringMomentum = useRef(false);
    
    if (events.length === 0) {
        return (
            <View style={{ marginTop: 40 }}>
                <Text style={commonStyles.errorText}>
                    {t('event:empty.past')}
                </Text>
            </View>
        );
    }

    const handleLoadMore = () => {
        if (!onEndReachedCalledDuringMomentum.current && hasMore && !loadingMore) {
            onLoadMore();
            onEndReachedCalledDuringMomentum.current = true;
        }
    };

    return (
        <FlatList
            data={events}
            keyExtractor={(item, index) => `${item.product_app_id}-${index}`}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            onMomentumScrollBegin={() => {
                onEndReachedCalledDuringMomentum.current = false;
            }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            ListFooterComponent={
                loadingMore ? (
                    <ActivityIndicator 
                        size="small" 
                        color="#FF5722"
                        style={{ marginVertical: spacing.sm }} 
                    />
                ) : null
            }
            renderItem={({ item }) => (
                <View style={[
                    commonStyles.card, 
                    { 
                        paddingTop: spacing.xs, 
                        padding: 0, 
                        overflow: 'hidden', 
                        marginBottom: spacing.xs 
                    }
                ]}>
                    <View style={eventStyles.header}>
                        <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
                            {item.name}
                        </Text>
                        <Text style={commonStyles.subtitle}>
                            {formatEventDate(item.race_date, t)}
                        </Text>
                    </View>
                    <TouchableOpacity style={commonStyles.primaryButton}>
                        <Text style={commonStyles.primaryButtonText}>
                            {t('event:past.button')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        />
    );
};

export default PastTab;