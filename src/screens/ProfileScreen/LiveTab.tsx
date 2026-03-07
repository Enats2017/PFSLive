import React, { useState, useCallback, useEffect } from 'react'
import {
    View, Text, TouchableOpacity, FlatList,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { commonStyles } from '../../styles/common.styles'
import { fetchMoreLiveEvents, AthleteEvent, Pagination } from '../../services/athleteProfileService'
import { profileStyles } from '../../styles/Profile.styles'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '../../types/navigation'
type NavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'EditPersonalEvent'
>
import { EventCard } from './EventCardLive'


/* ── Props ── */
interface Props {
    customerId: number | string
    initialEvents: AthleteEvent[]
    initialPaging: Pagination
}

const LiveTab = ({ customerId, initialEvents, initialPaging }: Props) => {
    const { t } = useTranslation(['profile'])
    const [events, setEvents] = useState<AthleteEvent[]>(initialEvents)
    const [paging, setPaging] = useState<Pagination>(initialPaging)
    const [refreshing, setRefreshing] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)

    // sync if parent refreshes and passes new initial data
    useEffect(() => {
        setEvents(initialEvents)
        setPaging(initialPaging)
    }, [initialEvents, initialPaging])

    const handleRefresh = useCallback(async () => {
        try {
            setRefreshing(true)
            const data = await fetchMoreLiveEvents(paging.page + 1)
            setEvents(data.live ?? [])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setRefreshing(false)
        }
    }, [customerId])

    const handleLoadMore = useCallback(async () => {
        if (loadingMore || paging.page >= paging.total_pages) return
        try {
            setLoadingMore(true)
            const data = await fetchMoreLiveEvents(paging.page + 1)
            setEvents(prev => [...prev, ...(data.live ?? [])])
            setPaging(data.pagination)
        } catch { /* silent */ } finally {
            setLoadingMore(false)
        }
    }, [customerId, paging, loadingMore])



    const renderItem = useCallback(({ item }: { item: AthleteEvent }) =>
        <EventCard item={item} />, [])

    const keyExtractor = useCallback((item: AthleteEvent) => String(item.id), [])

    return (
        <FlatList
            data={events}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={profileStyles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#e8341a" />
            }
            ListEmptyComponent={
                <View style={profileStyles.empty}>
                    <Ionicons name="radio-outline" size={48} color="#ddd" />
                    <Text style={commonStyles.errorText}> {t('profile:empty.no_live_events')}</Text>
                </View>
            }
            ListFooterComponent={
                paging.page < paging.total_pages ? (
                    <TouchableOpacity style={profileStyles.loadMoreBtn} onPress={handleLoadMore} disabled={loadingMore}>
                        {loadingMore
                            ? <ActivityIndicator size="small" color="#e8341a" />
                            : <Text style={commonStyles.loadingText}>{t('profile:buttons.load_more')}</Text>}
                    </TouchableOpacity>
                ) : null
            }
        />
    )
}



export default LiveTab
