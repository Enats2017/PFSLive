import React, { useRef, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { EventItem } from '../../services/eventService';
import { commonStyles, spacing } from '../../styles/common.styles';
import { eventStyles } from '../../styles/event';
import { useTranslation } from 'react-i18next';
import { formatEventDate } from '../../utils/dateFormatter';
import SearchInput from '../../components/SearchInput';
import { useNavigation, useRoute } from '@react-navigation/native';

interface PastTabProps {
    events: EventItem[];
    onLoadMore: () => void;
    loadingMore: boolean;
    hasMore: boolean;
    searchText: string;
    onSearchChange: (text: string) => void;
    searchLoading: boolean;
}

const PastTab: React.FC<PastTabProps> = ({ events, onLoadMore, loadingMore, hasMore, searchText,
    onSearchChange, searchLoading }) => {
    const navigation = useNavigation<any>();
    const { t } = useTranslation(['event', 'common']);
    const searchInputRef = useRef<any>(null);
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
        <>
            <View style={{ paddingHorizontal: spacing.sm }}>
                <SearchInput
                    ref={searchInputRef}
                    placeholder={t('details:participant.search')}
                    value={searchText}
                    onChangeText={onSearchChange}
                    icon="search"
                />
            </View>

            {/* ✅ Show small loader below search instead of full screen */}
            {searchLoading && events.length === 0 ? (
                <ActivityIndicator
                    size="small"
                    color="#FF5722"
                    style={{ marginTop: 20 }}
                />
            ) : events.length === 0 ? (
                <View style={{ marginTop: 40 }}>
                    <Text style={commonStyles.errorText}>
                        {t('event:empty.past')}
                    </Text>
                </View>
            ) : (
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
                        <View style={[commonStyles.card, {
                            paddingTop: spacing.xs,
                            padding: 0,
                            overflow: 'hidden',
                            marginBottom: spacing.xs,
                        }]}>
                            <View style={eventStyles.header}>
                                <Text style={[commonStyles.title, { marginBottom: spacing.xs }]}>
                                    {item.name}
                                </Text>
                                <Text style={commonStyles.subtitle}>
                                    {formatEventDate(item.race_date, t)}
                                </Text>
                            </View>
                            <TouchableOpacity style={commonStyles.primaryButton} onPress={() => navigation.navigate('RaseResultScreen', {
                                product_app_id: item.product_app_id,
                                event_name: item.name
                            })}>
                                <Text style={commonStyles.primaryButtonText}>
                                    {t('event:past.button')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                />
            )}
        </>
    );
};

export default PastTab;